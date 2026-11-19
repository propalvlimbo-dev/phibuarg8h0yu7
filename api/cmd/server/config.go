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
		generated, err := randomToken(32)
		if err != nil {
			log.Fatal(err)
		}
		cfg.SessionSecret = []byte(generated)
		// Persist it next to the other settings so logins survive restarts. Fails harmlessly on read-only
		// filesystems (Docker), where sessions then reset on restart.
		if _, statErr := os.Stat(".env"); statErr == nil && secret == "" && appendDotEnv(".env", "SESSION_SECRET", generated) == nil {
			log.Printf("SESSION_SECRET was missing: generated one and saved it to .env")
		} else {
			log.Printf("SESSION_SECRET is not set (or shorter than 32 chars): using a random one, sessions reset on restart")
		}
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

// appendDotEnv adds KEY=value as a new line at the end of the file.
func appendDotEnv(path, key, value string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		return err
	}
	defer f.Close()
	prefix := ""
	if len(data) > 0 && data[len(data)-1] != '\n' {
		prefix = "\n"
	}
	_, err = f.WriteString(prefix + key + "=" + value + "\n")
	return err
}

func randomToken(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
