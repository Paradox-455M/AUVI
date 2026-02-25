# Scaling Notes — Auvi Backend

## Local → Cloud Migration Path

### Storage: Local FS → S3
The `Storage` interface (`internal/storage/storage.go`) already abstracts file operations. Migration requires:

1. Create `internal/storage/s3.go` implementing `Storage` interface
2. Use `aws-sdk-go-v2` for S3 operations
3. Config switch: `STORAGE_BACKEND=local|s3` in environment
4. No service layer changes needed — interface boundary is clean

**Pre-signed URLs:** When S3 is active, audio files should be served via pre-signed URLs (15min TTL) instead of proxying through the backend.

### Database: Local PG → Managed PG
- Switch `DATABASE_URL` to managed instance (RDS, Cloud SQL, Supabase)
- Run `db/schema.sql` against the managed instance
- Enable connection pooling (PgBouncer or managed pooling)
- Add `?sslmode=require` to connection string

### Compute
- Containerize: `Dockerfile` with multi-stage build (Go binary ~15MB)
- Deploy to: Railway, Fly.io, Cloud Run, or ECS
- Health check: `GET /api/health`

## Auth Integration (Future)

Designed-for but not implemented:
1. Add `users` table with `id`, `email`, `auth_provider`, `created_at`
2. Add `user_id` column to `tracks` and `playback_events`
3. JWT middleware in `internal/api/middleware/auth.go`
4. Protect mutation endpoints (POST, DELETE) — read endpoints stay public

## Analytics Pipeline (Future)

1. `PlaybackEvent` table already exists with indexes
2. Phase 1: Direct DB writes (current design supports this)
3. Phase 2: Buffer events in Go channels → batch insert every 5s
4. Phase 3: Event stream (Kafka/NATS) → analytics DB (ClickHouse/TimescaleDB)
