package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds all application configuration.
// Loaded exclusively from environment variables for 12-factor compliance.
type Config struct {
	Port            int
	DatabaseURL     string
	UploadDir       string
	MaxFileMB       int
	JWTSecret       string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	CORSOrigins     string // comma-separated list of allowed origins, or "*"
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	cfg := &Config{
		Port:            8080,
		UploadDir:       "./uploads",
		MaxFileMB:       100,
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 720 * time.Hour, // 30 days
	}

	if p := os.Getenv("PORT"); p != "" {
		port, err := strconv.Atoi(p)
		if err != nil {
			return nil, fmt.Errorf("invalid PORT: %w", err)
		}
		cfg.Port = port
	}

	cfg.DatabaseURL = os.Getenv("DATABASE_URL")
	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = "postgres://localhost:5432/auvi?sslmode=disable"
	}

	if d := os.Getenv("UPLOAD_DIR"); d != "" {
		cfg.UploadDir = d
	}

	if m := os.Getenv("MAX_FILE_MB"); m != "" {
		max, err := strconv.Atoi(m)
		if err != nil {
			return nil, fmt.Errorf("invalid MAX_FILE_MB: %w", err)
		}
		cfg.MaxFileMB = max
	}

	cfg.JWTSecret = os.Getenv("JWT_SECRET")
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is required")
	}

	cfg.CORSOrigins = os.Getenv("CORS_ORIGINS")
	if cfg.CORSOrigins == "" {
		cfg.CORSOrigins = "http://localhost:5173" // Vite dev default
	}

	if v := os.Getenv("ACCESS_TOKEN_TTL"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return nil, fmt.Errorf("invalid ACCESS_TOKEN_TTL: %w", err)
		}
		cfg.AccessTokenTTL = d
	}

	if v := os.Getenv("REFRESH_TOKEN_TTL"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return nil, fmt.Errorf("invalid REFRESH_TOKEN_TTL: %w", err)
		}
		cfg.RefreshTokenTTL = d
	}

	return cfg, nil
}
