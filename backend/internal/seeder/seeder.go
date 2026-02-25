package seeder

import (
	"context"
	"database/sql"
	_ "embed"
	"log"
)

//go:embed presets.sql
var presetSeedSQL string

// DBTX matches the standard database/sql interface used by sqlc.
type DBTX interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
}

// Run seeds built-in presets if none exist yet. Idempotent.
func Run(ctx context.Context, db DBTX) error {
	var count int
	if err := db.QueryRowContext(ctx, "SELECT count(*) FROM presets WHERE is_builtin = TRUE").Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		log.Printf("seeder: %d built-in presets already exist, skipping", count)
		return nil
	}
	if _, err := db.ExecContext(ctx, presetSeedSQL); err != nil {
		return err
	}
	log.Println("seeder: built-in presets seeded")
	return nil
}
