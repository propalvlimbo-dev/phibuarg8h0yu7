package main

import (
	"encoding/json"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type room struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Members  int    `json:"members"`
	Capacity int    `json:"capacity"`
}

type roomsResponse struct {
	Rooms []room `json:"rooms"`
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", healthHandler)
	mux.HandleFunc("GET /api/rooms", roomsHandler)
	mux.Handle("/", spaHandler(os.Getenv("STATIC_DIR")))

	server := &http.Server{
		Addr:              address(),
		Handler:           securityHeaders(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	log.Printf("GirlScan API listening on %s", server.Addr)
	log.Fatal(server.ListenAndServe())
}

func address() string {
	if port := os.Getenv("PORT"); port != "" {
		return ":" + port
	}
	return ":8080"
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func roomsHandler(w http.ResponseWriter, _ *http.Request) {
	// This endpoint deliberately returns aggregate room counts only.
	// User identities, gender roles, and real-time member locations are never exposed here.
	writeJSON(w, http.StatusOK, roomsResponse{Rooms: []room{
		{ID: "lounge", Name: "Лаунж", Members: 12, Capacity: 25},
		{ID: "music", Name: "Музыка", Members: 8, Capacity: 20},
		{ID: "night", Name: "Ночной чат", Members: 21, Capacity: 30},
	}})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func spaHandler(staticDir string) http.Handler {
	if staticDir == "" {
		staticDir = "web/dist"
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		requested := filepath.Clean("/" + r.URL.Path)
		file := filepath.Join(staticDir, requested)
		if info, err := os.Stat(file); err == nil && !info.IsDir() {
			if contentType := mime.TypeByExtension(filepath.Ext(file)); contentType != "" {
				w.Header().Set("Content-Type", contentType)
			}
			http.ServeFile(w, r, file)
			return
		}

		// React handles client-side routing; never expose directory listings.
		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set("Content-Security-Policy", strings.Join([]string{
			"default-src 'self'",
			"base-uri 'none'",
			"frame-ancestors 'none'",
			"form-action 'self'",
			"img-src 'self' data:",
			"style-src 'self' 'unsafe-inline'",
			"script-src 'self'",
			"connect-src 'self'",
		}, "; "))
		next.ServeHTTP(w, r)
	})
}
