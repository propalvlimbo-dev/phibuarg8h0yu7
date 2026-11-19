package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	discordAPI      = "https://discord.com/api/v10"
	discordAuthURL  = "https://discord.com/oauth2/authorize"
	sessionCookie   = "gs_session"
	stateCookie     = "gs_oauth_state"
	sessionLifetime = 30 * 24 * time.Hour
)

// session is what we keep about a logged-in user. It lives in a signed cookie (no database yet).
// The Discord access token is not stored: we only need the profile at login time.
type session struct {
	ID         string `json:"id"`
	Username   string `json:"u"`
	GlobalName string `json:"g,omitempty"`
	Avatar     string `json:"a,omitempty"`
	Expires    int64  `json:"exp"`
}

type auth struct {
	cfg    config
	client *http.Client
}

func newAuth(cfg config) *auth {
	return &auth{cfg: cfg, client: &http.Client{Timeout: 10 * time.Second}}
}

// GET /api/auth/status — lets the login animation know whether it can redirect.
func (a *auth) status(w http.ResponseWriter, r *http.Request) {
	_, loggedIn := a.readSession(r)
	writeJSON(w, http.StatusOK, map[string]bool{"configured": a.cfg.discordConfigured(), "loggedIn": loggedIn})
}

// GET /api/auth/login — redirect to Discord's consent screen.
func (a *auth) login(w http.ResponseWriter, r *http.Request) {
	if !a.cfg.discordConfigured() {
		http.Redirect(w, r, "/?auth_error=not_configured", http.StatusFound)
		return
	}
	state, err := randomToken(32)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookie,
		Value:    state,
		Path:     "/api/auth",
		MaxAge:   600,
		HttpOnly: true,
		Secure:   a.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	q := url.Values{
		"response_type": {"code"},
		"client_id":     {a.cfg.DiscordClientID},
		"scope":         {"identify"},
		"state":         {state},
		"redirect_uri":  {a.cfg.DiscordRedirectURI},
		"prompt":        {"none"}, // skip the consent screen if the user already allowed GirlScan
	}
	http.Redirect(w, r, discordAuthURL+"?"+q.Encode(), http.StatusFound)
}

// GET /api/auth/callback — Discord sends the user back here with ?code=…&state=…
func (a *auth) callback(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	clearCookie(w, stateCookie, "/api/auth", a.cfg.CookieSecure)

	if q.Get("error") != "" {
		http.Redirect(w, r, "/?auth_error=denied", http.StatusFound)
		return
	}
	saved, err := r.Cookie(stateCookie)
	if err != nil || q.Get("state") == "" || subtle.ConstantTimeCompare([]byte(saved.Value), []byte(q.Get("state"))) != 1 {
		http.Redirect(w, r, "/?auth_error=state", http.StatusFound)
		return
	}
	code := q.Get("code")
	if code == "" {
		http.Redirect(w, r, "/?auth_error=failed", http.StatusFound)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	token, err := a.exchangeCode(ctx, code)
	if err != nil {
		log.Printf("discord token exchange: %v", err)
		http.Redirect(w, r, "/?auth_error=failed", http.StatusFound)
		return
	}
	user, err := a.fetchUser(ctx, token)
	if err != nil {
		log.Printf("discord user fetch: %v", err)
		http.Redirect(w, r, "/?auth_error=failed", http.StatusFound)
		return
	}

	s := session{
		ID:         user.ID,
		Username:   user.Username,
		GlobalName: user.GlobalName,
		Avatar:     user.Avatar,
		Expires:    time.Now().Add(sessionLifetime).Unix(),
	}
	value, err := a.sign(s)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    value,
		Path:     "/",
		MaxAge:   int(sessionLifetime.Seconds()),
		HttpOnly: true,
		Secure:   a.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, "/cabinet", http.StatusFound)
}

// POST /api/auth/logout
func (a *auth) logout(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	clearCookie(w, sessionCookie, "/", a.cfg.CookieSecure)
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/me — the cabinet's source of truth about the current user.
func (a *auth) me(w http.ResponseWriter, r *http.Request) {
	s, ok := a.readSession(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	display := s.GlobalName
	if display == "" {
		display = s.Username
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"user": map[string]string{
			"id":          s.ID,
			"username":    s.Username,
			"displayName": display,
			"avatarUrl":   avatarURL(s.ID, s.Avatar),
		},
		// Subscriptions come later; everyone is on the free tier for now.
		"subscription": map[string]any{"active": false, "plan": nil},
	})
}

type discordUser struct {
	ID         string `json:"id"`
	Username   string `json:"username"`
	GlobalName string `json:"global_name"`
	Avatar     string `json:"avatar"`
}

func (a *auth) exchangeCode(ctx context.Context, code string) (string, error) {
	form := url.Values{
		"grant_type":   {"authorization_code"},
		"code":         {code},
		"redirect_uri": {a.cfg.DiscordRedirectURI},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, discordAPI+"/oauth2/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(a.cfg.DiscordClientID, a.cfg.DiscordClientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	var out struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
	}
	if err := a.doJSON(req, &out); err != nil {
		return "", err
	}
	if out.AccessToken == "" {
		return "", errors.New("empty access token")
	}
	return out.AccessToken, nil
}

func (a *auth) fetchUser(ctx context.Context, token string) (discordUser, error) {
	var u discordUser
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, discordAPI+"/users/@me", nil)
	if err != nil {
		return u, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	if err := a.doJSON(req, &u); err != nil {
		return u, err
	}
	if u.ID == "" {
		return u, errors.New("discord user without id")
	}
	return u, nil
}

func (a *auth) doJSON(req *http.Request, out any) error {
	req.Header.Set("User-Agent", "GirlScan (https://github.com/propalvlimbo-dev/phibuarg8h0yu7, 1.0)")
	res, err := a.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return err
	}
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("discord %s: %d %s", req.URL.Path, res.StatusCode, strings.TrimSpace(string(body)))
	}
	return json.Unmarshal(body, out)
}

// sign encodes a session as base64url(json).base64url(hmac-sha256).
func (a *auth) sign(s session) (string, error) {
	payload, err := json.Marshal(s)
	if err != nil {
		return "", err
	}
	body := base64.RawURLEncoding.EncodeToString(payload)
	return body + "." + a.mac(body), nil
}

func (a *auth) mac(body string) string {
	m := hmac.New(sha256.New, a.cfg.SessionSecret)
	m.Write([]byte(body))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

func (a *auth) readSession(r *http.Request) (session, bool) {
	var s session
	c, err := r.Cookie(sessionCookie)
	if err != nil {
		return s, false
	}
	body, sig, ok := strings.Cut(c.Value, ".")
	if !ok || !hmac.Equal([]byte(sig), []byte(a.mac(body))) {
		return s, false
	}
	payload, err := base64.RawURLEncoding.DecodeString(body)
	if err != nil || json.Unmarshal(payload, &s) != nil {
		return s, false
	}
	if s.ID == "" || time.Now().Unix() > s.Expires {
		return s, false
	}
	return s, true
}

func clearCookie(w http.ResponseWriter, name, path string, secure bool) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: "", Path: path, MaxAge: -1, HttpOnly: true, Secure: secure, SameSite: http.SameSiteLaxMode})
}

// sameOrigin rejects cross-site POSTs (defence in depth on top of SameSite cookies).
func sameOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	return err == nil && u.Host == r.Host
}

func avatarURL(id, hash string) string {
	if hash == "" {
		// Default avatar index for the new username system: (id >> 22) % 6.
		n, err := strconv.ParseUint(id, 10, 64)
		if err != nil {
			n = 0
		}
		return fmt.Sprintf("https://cdn.discordapp.com/embed/avatars/%d.png", (n>>22)%6)
	}
	ext := "png"
	if strings.HasPrefix(hash, "a_") {
		ext = "gif"
	}
	return fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.%s?size=128", id, hash, ext)
}
