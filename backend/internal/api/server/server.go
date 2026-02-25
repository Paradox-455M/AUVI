package server

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"auvi/internal/api/handlers"
	"auvi/internal/api/middleware"
	"auvi/pkg/token"
)

// Server wraps the HTTP mux and config.
type Server struct {
	mux  *http.ServeMux
	port int
}

// New creates a server with all routes mounted.
func New(
	port int,
	tokenMgr *token.Manager,
	authHandler *handlers.AuthHandler,
	trackHandler *handlers.TrackHandler,
	tagHandler *handlers.TagHandler,
	galleryHandler *handlers.GalleryHandler,
	presetHandler *handlers.PresetHandler,
) *Server {
	mux := http.NewServeMux()
	authMW := middleware.Authenticate(tokenMgr)

	// ---- Public routes (no auth) ----
	mux.HandleFunc("POST /api/v1/auth/register", authHandler.Register)
	mux.HandleFunc("POST /api/v1/auth/login", authHandler.Login)
	mux.HandleFunc("POST /api/v1/auth/refresh", authHandler.Refresh)
	mux.HandleFunc("POST /api/v1/auth/logout", authHandler.Logout)

	mux.Handle("GET /api/v1/presets", http.HandlerFunc(presetHandler.List))
	mux.Handle("GET /api/v1/presets/{id}", http.HandlerFunc(presetHandler.GetOne))

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"status":"ok"}`)
	})

	// ---- Protected routes (require valid JWT) ----
	protect := func(method, pattern string, h http.HandlerFunc, timeout time.Duration) {
		handler := authMW(middleware.Timeout(timeout)(h))
		mux.Handle(method+" "+pattern, handler)
	}

	const (
		std    = 30 * time.Second
		upload = 120 * time.Second
		stream = 0 // no timeout for streaming
	)

	// Tracks
	protect("POST", "/api/v1/tracks", trackHandler.Create, upload)
	protect("GET", "/api/v1/tracks", trackHandler.List, std)
	protect("GET", "/api/v1/tracks/{id}", trackHandler.Get, std)
	protect("DELETE", "/api/v1/tracks/{id}", trackHandler.Delete, std)
	protect("POST", "/api/v1/tracks/{id}/tags", trackHandler.AssignTag, std)
	protect("PATCH", "/api/v1/tracks/{id}/mood", trackHandler.PatchMood, std)
	protect("GET", "/api/v1/tracks/{id}/stream", trackHandler.Stream, stream)

	// Tags
	protect("POST", "/api/v1/tags", tagHandler.Create, std)
	protect("GET", "/api/v1/tags", tagHandler.List, std)
	protect("DELETE", "/api/v1/tags/{id}", tagHandler.Delete, std)

	// Gallery
	protect("GET", "/api/v1/gallery", galleryHandler.Get, std)

	// Presets (auth)
	protect("POST", "/api/v1/presets", presetHandler.Create, std)
	protect("DELETE", "/api/v1/presets/{id}", presetHandler.Delete, std)
	protect("POST", "/api/v1/presets/{id}/favorite", presetHandler.ToggleFavorite, std)

	// User
	protect("GET", "/api/v1/users/me/favorites", presetHandler.ListFavorites, std)

	return &Server{mux: mux, port: port}
}

// Handler returns the server's handler, wrapped with middleware.
// Middleware chain: Recover → RequestID → Logger → CORS → Gzip → SecurityHeaders → PathTraversalGuard → PerUserRateLimiter
func (s *Server) Handler(middlewares ...func(http.Handler) http.Handler) http.Handler {
	var handler http.Handler = s.mux
	for i := len(middlewares) - 1; i >= 0; i-- {
		handler = middlewares[i](handler)
	}
	return handler
}

// Start begins listening for HTTP requests.
func (s *Server) Start(middlewares ...func(http.Handler) http.Handler) error {
	addr := fmt.Sprintf(":%d", s.port)
	log.Printf("🎵 Auvi backend listening on %s", addr)
	return http.ListenAndServe(addr, s.Handler(middlewares...))
}
