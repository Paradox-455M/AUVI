package middleware

import (
	"compress/gzip"
	"context"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"auvi/pkg/token"

	"github.com/google/uuid"
	"golang.org/x/time/rate"
)

// contextKey is a private type for context values to avoid collisions.
type contextKey string

const userIDKey contextKey = "userID"

// UserIDFromContext retrieves the authenticated user's UUID from the request context.
func UserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	v := ctx.Value(userIDKey)
	if v == nil {
		return uuid.UUID{}, false
	}
	id, ok := v.(uuid.UUID)
	return id, ok
}

// Authenticate validates the Bearer JWT and injects the userID into the context.
// Returns 401 if the token is missing or invalid.
func Authenticate(tokenMgr *token.Manager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			var tokenStr string
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
			} else if t := r.URL.Query().Get("t"); t != "" {
				tokenStr = t // fallback for <audio> stream requests
			}
			if tokenStr == "" {
				writeJSON401(w)
				return
			}
			claims, err := tokenMgr.Validate(tokenStr)
			if err != nil {
				writeJSON401(w)
				return
			}
			userID, err := uuid.Parse(claims.UserID)
			if err != nil {
				writeJSON401(w)
				return
			}
			ctx := context.WithValue(r.Context(), userIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequestID injects a unique X-Request-ID header. Uses the provided value or generates a new UUID.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		w.Header().Set("X-Request-ID", requestID)
		next.ServeHTTP(w, r)
	})
}

// Timeout wraps a handler with a context deadline. Set d=0 to skip (e.g. for streaming).
func Timeout(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if d == 0 {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), d)
			defer cancel()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// Gzip compresses JSON responses when the client accepts gzip encoding.
// Audio streams (Content-Type: audio/*) are never compressed.
func Gzip(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		gw := &gzipResponseWriter{ResponseWriter: w}
		defer gw.close()
		next.ServeHTTP(gw, r)
	})
}

type gzipResponseWriter struct {
	http.ResponseWriter
	gz     *gzip.Writer
	once   sync.Once
	skip   bool
}

func (g *gzipResponseWriter) Write(b []byte) (int, error) {
	g.once.Do(func() {
		ct := g.ResponseWriter.Header().Get("Content-Type")
		if strings.HasPrefix(ct, "audio/") || strings.HasPrefix(ct, "video/") {
			g.skip = true
			return
		}
		g.ResponseWriter.Header().Set("Content-Encoding", "gzip")
		g.ResponseWriter.Header().Del("Content-Length")
		g.gz = gzip.NewWriter(g.ResponseWriter)
	})
	if g.skip || g.gz == nil {
		return g.ResponseWriter.Write(b)
	}
	return g.gz.Write(b)
}

func (g *gzipResponseWriter) close() {
	if g.gz != nil {
		g.gz.Close()
	}
}

// Flush implements http.Flusher for streaming responses.
func (g *gzipResponseWriter) Flush() {
	if g.gz != nil {
		g.gz.Flush()
	}
	if f, ok := g.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// perUserLimiterEntry holds a rate limiter and its last-seen timestamp.
type perUserLimiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// PerUserRateLimiter creates per-user (or per-IP for unauthenticated) rate limiters.
// Idle entries are pruned every 5 minutes.
func PerUserRateLimiter(rps float64, burst int) func(http.Handler) http.Handler {
	var mu sync.Map

	// Background goroutine to prune idle entries
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			now := time.Now()
			mu.Range(func(k, v interface{}) bool {
				if now.Sub(v.(*perUserLimiterEntry).lastSeen) > 10*time.Minute {
					mu.Delete(k)
				}
				return true
			})
		}
	}()

	getLimiter := func(key string) *rate.Limiter {
		v, _ := mu.LoadOrStore(key, &perUserLimiterEntry{
			limiter:  rate.NewLimiter(rate.Limit(rps), burst),
			lastSeen: time.Now(),
		})
		entry := v.(*perUserLimiterEntry)
		entry.lastSeen = time.Now()
		return entry.limiter
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.RemoteAddr
			if userID, ok := UserIDFromContext(r.Context()); ok {
				key = userID.String()
			}
			if !getLimiter(key).Allow() {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				io.WriteString(w, `{"success":false,"error":{"code":"RATE_LIMITED","message":"Too many requests"}}`)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Logger logs every HTTP request with method, path, status, and duration.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(sw, r)
		log.Printf("[%s] %s %s %d %s",
			r.Header.Get("X-Request-ID"),
			r.Method, r.URL.Path, sw.status,
			time.Since(start).Round(time.Millisecond))
	})
}

// CORS validates the request Origin against an allowlist and sets appropriate headers.
// allowedOrigins is a comma-separated list of origins (e.g. "http://localhost:5173,https://auvi.app")
// or "*" to allow all origins (dev only).
func CORS(allowedOrigins string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool)
	for _, o := range strings.Split(allowedOrigins, ",") {
		if t := strings.TrimSpace(o); t != "" {
			allowed[t] = true
		}
	}
	wildcard := allowed["*"]

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if wildcard {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			} else if origin != "" && allowed[origin] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Add("Vary", "Origin")
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")
			w.Header().Set("Access-Control-Max-Age", "86400")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// SecurityHeaders adds basic security headers.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}

// PathTraversalGuard rejects requests with path traversal patterns.
func PathTraversalGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "..") || strings.Contains(r.URL.RawQuery, "..") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			io.WriteString(w, `{"success":false,"error":{"code":"INVALID_PATH","message":"Path traversal detected"}}`)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Recover catches panics and returns a 500 instead of crashing the server.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("PANIC: %v", err)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				io.WriteString(w, `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}}`)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// RateLimiter limits requests per second globally (kept for compatibility).
func RateLimiter(requestsPerSecond float64, burst int) func(http.Handler) http.Handler {
	limiter := rate.NewLimiter(rate.Limit(requestsPerSecond), burst)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !limiter.Allow() {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				io.WriteString(w, `{"success":false,"error":{"code":"RATE_LIMITED","message":"Too many requests"}}`)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// statusWriter intercepts WriteHeader to capture the status code.
type statusWriter struct {
	http.ResponseWriter
	status int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.status = code
	sw.ResponseWriter.WriteHeader(code)
}

func writeJSON401(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	io.WriteString(w, `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`)
}
