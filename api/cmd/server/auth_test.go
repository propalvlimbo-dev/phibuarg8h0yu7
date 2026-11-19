package main

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func testAuth() *auth {
	return newAuth(config{
		DiscordClientID:     "123",
		DiscordClientSecret: "secret",
		DiscordRedirectURI:  "http://localhost:5173/api/auth/callback",
		SessionSecret:       []byte("0123456789abcdef0123456789abcdef"),
	})
}

func TestSessionRoundTrip(t *testing.T) {
	a := testAuth()
	value, err := a.sign(session{ID: "42", Username: "neo", Expires: time.Now().Add(time.Hour).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: value})
	s, ok := a.readSession(req)
	if !ok || s.ID != "42" || s.Username != "neo" {
		t.Fatalf("session not restored: %+v %v", s, ok)
	}

	// Tampered payload must be rejected.
	body, sig, _ := strings.Cut(value, ".")
	req = httptest.NewRequest(http.MethodGet, "/api/me", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: body + "x." + sig})
	if _, ok := a.readSession(req); ok {
		t.Fatal("tampered session accepted")
	}

	// Expired session must be rejected.
	old, _ := a.sign(session{ID: "42", Expires: time.Now().Add(-time.Minute).Unix()})
	req = httptest.NewRequest(http.MethodGet, "/api/me", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: old})
	if _, ok := a.readSession(req); ok {
		t.Fatal("expired session accepted")
	}
}

func TestLoginRedirectsToDiscordWithState(t *testing.T) {
	a := testAuth()
	rec := httptest.NewRecorder()
	a.login(rec, httptest.NewRequest(http.MethodGet, "/api/auth/login", nil))
	if rec.Code != http.StatusFound {
		t.Fatalf("status %d", rec.Code)
	}
	loc, _ := url.Parse(rec.Header().Get("Location"))
	if loc.Host != "discord.com" || loc.Query().Get("client_id") != "123" || loc.Query().Get("scope") != "identify" {
		t.Fatalf("bad redirect %s", loc)
	}
	var state string
	for _, c := range rec.Result().Cookies() {
		if c.Name == stateCookie {
			state = c.Value
		}
	}
	if state == "" || state != loc.Query().Get("state") {
		t.Fatal("state cookie missing or not matching")
	}
}

func TestCallbackRejectsWrongState(t *testing.T) {
	a := testAuth()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/callback?code=abc&state=evil", nil)
	req.AddCookie(&http.Cookie{Name: stateCookie, Value: "good"})
	rec := httptest.NewRecorder()
	a.callback(rec, req)
	if got := rec.Header().Get("Location"); got != "/?auth_error=state" {
		t.Fatalf("expected state error redirect, got %q", got)
	}
}

func TestMeUnauthorized(t *testing.T) {
	rec := httptest.NewRecorder()
	testAuth().me(rec, httptest.NewRequest(http.MethodGet, "/api/me", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestAvatarURL(t *testing.T) {
	if got := avatarURL("80351110224678912", "a_abc"); !strings.HasSuffix(got, "/a_abc.gif?size=128") {
		t.Fatal(got)
	}
	if got := avatarURL("80351110224678912", ""); !strings.HasPrefix(got, "https://cdn.discordapp.com/embed/avatars/") {
		t.Fatal(got)
	}
}
