package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"auvi/internal/analytics"
	"auvi/internal/api/handlers"
	"auvi/internal/api/middleware"
	"auvi/internal/api/server"
	"auvi/internal/auth"
	"auvi/internal/cache"
	"auvi/internal/config"
	db "auvi/internal/repository/database"
	"auvi/internal/seeder"
	"auvi/internal/services"
	"auvi/internal/storage"
	"auvi/pkg/token"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	// 1. Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 2. Connect to PostgreSQL via pgx (binary protocol, ~40% faster than lib/pq)
	conn, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer conn.Close()

	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(5 * time.Minute)

	if err := conn.PingContext(context.Background()); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("✅ Connected to PostgreSQL")

	// 3. Initialize repository
	queries := db.New(conn)

	// 4. Seed built-in presets (idempotent — skips if already seeded)
	if err := seeder.Run(context.Background(), conn); err != nil {
		log.Printf("⚠️  Seeder warning: %v", err)
	}

	// 5. Initialize storage
	store, err := storage.NewLocalStorage(cfg.UploadDir)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	log.Printf("📁 File storage at: %s", cfg.UploadDir)

	// 6. JWT token manager
	tokenMgr := token.NewManager(cfg.JWTSecret, cfg.AccessTokenTTL)

	// 7. Gallery cache (60-second TTL, lazy expiry)
	galleryCache := cache.NewGalleryCache(60 * time.Second)

	// 8. Analytics batcher — flushes on graceful shutdown
	batcher := analytics.NewEventBatcher(queries, 1000, 5*time.Second)
	batcherCtx, batcherCancel := context.WithCancel(context.Background())
	go batcher.Start(batcherCtx)

	// 9. Services
	authService := auth.NewService(queries, tokenMgr, cfg.RefreshTokenTTL)
	trackService := services.NewTrackService(queries, store, galleryCache)
	tagService := services.NewTagService(queries, galleryCache)
	galleryService := services.NewGalleryService(queries, galleryCache)
	presetService := services.NewPresetService(queries)

	// 10. Handlers
	authHandler := handlers.NewAuthHandler(authService)
	trackHandler := handlers.NewTrackHandler(trackService, tagService)
	tagHandler := handlers.NewTagHandler(tagService)
	galleryHandler := handlers.NewGalleryHandler(galleryService)
	presetHandler := handlers.NewPresetHandler(presetService)

	// 11. Build router + middleware chain
	srv := server.New(cfg.Port, tokenMgr, authHandler, trackHandler, tagHandler, galleryHandler, presetHandler)

	// Middleware chain (outermost → innermost):
	// Recover → RequestID → Logger → CORS → Gzip → SecurityHeaders → PathTraversalGuard → PerUserRateLimiter
	handler := srv.Handler(
		middleware.Recover,
		middleware.RequestID,
		middleware.Logger,
		middleware.CORS(cfg.CORSOrigins),
		middleware.Gzip,
		middleware.SecurityHeaders,
		middleware.PathTraversalGuard,
		middleware.PerUserRateLimiter(100, 200),
	)

	// 12. HTTP server with graceful shutdown support
	httpSrv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 0, // 0 = unlimited (streaming routes need this)
		IdleTimeout:  120 * time.Second,
	}

	// 13. Graceful shutdown on SIGINT/SIGTERM
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("\n🛑 Shutting down gracefully...")

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		// Stop analytics batcher and flush remaining events
		batcherCancel()
		batcher.Flush(shutdownCtx)

		if err := httpSrv.Shutdown(shutdownCtx); err != nil {
			log.Printf("HTTP shutdown error: %v", err)
		}
	}()

	log.Printf("🎵 Auvi backend listening on :%d", cfg.Port)
	if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
	log.Println("✅ Server stopped")
}
