package main

import (
	"bufio"
	"crypto/rand"
	"encoding/base64"
	"log"
	"os"
	"strings"
)

// config holds everything the server reads from the environment (or a local .env file).
type config struct {
	DiscordClientID     string
	DiscordClientSecret string
	DiscordRedirectURI  string
	SessionSecret       []byte
	CookieSecure        bool
}

func (c config) discordConfigured() bool {
	return c.DiscordClientID != "" && c.DiscordClientSecret != "" && c.DiscordRedirectURI != ""
}

func loadConfig() config {
	loadDotEnv(".env")

	cfg := config{
		DiscordClientID:     strings.TrimSpace(os.Getenv("DISCORD_CLIENT_ID")),
		DiscordClientSecret: strings.TrimSpace(os.Getenv("DISCORD_CLIENT_SECRET")),
		DiscordRedirectURI:  strings.TrimSpace(os.Getenv("DISCORD_REDIRECT_URI")),
	}
	if cfg.DiscordRedirectURI == "" {
		cfg.DiscordRedirectURI = "http://localhost:5173/api/auth/callback"
	}
	cfg.CookieSecure = strings.HasPrefix(cfg.DiscordRedirectURI, "https://")

	secret := os.Getenv("SESSION_SECRET")
	switch {
	case len(secret) >= 32:
		cfg.SessionSecret = []byte(secret)
	default:
		// Without a fixed secret sessions still work, but everyone is logged out on restart.
		buf := make([]byte, 32)
		if _, err := rand.Read(buf); err != nil {
			log.Fatal(err)
		}
		cfg.SessionSecret = buf
		log.Printf("SESSION_SECRET is not set (or shorter than 32 chars): using a random one, sessions reset on restart")
	}

	if cfg.discordConfigured() {
		log.Printf("Discord OAuth enabled, redirect URI %s", cfg.DiscordRedirectURI)
	} else {
		log.Printf("Discord OAuth is not configured: set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET (see .env.example)")
	}
	return cfg
}

// loadDotEnv reads KEY=VALUE lines from a file without overriding variables that are already set.
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(strings.TrimPrefix(key, "export "))
		value = strings.TrimSpace(value)
		if len(value) >= 2 && (value[0] == '"' && value[len(value)-1] == '"' || value[0] == '\'' && value[len(value)-1] == '\'') {
			value = value[1 : len(value)-1]
		}
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, value)
		}
	}
}

func randomToken(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
