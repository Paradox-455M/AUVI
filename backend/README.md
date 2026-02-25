# Auvi Backend

A clean, layered REST API powering the Auvi cinematic music gallery. Built with Go, PostgreSQL, and zero magic.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Go 1.25.6 |
| HTTP | `net/http` (stdlib, Go 1.22+ routing) |
| Database | PostgreSQL |
| ORM | sqlc (type-safe SQL, no magic) |
| Storage | Local filesystem (S3-ready interface) |

## Architecture

```
cmd/api/main.go              ← Entrypoint (DI wiring, graceful shutdown)
internal/
├── api/
│   ├── handlers/             ← HTTP controllers (tracks, tags, gallery)
│   ├── middleware/            ← Logger, CORS, Rate Limiter, Security
│   ├── response/             ← JSON envelope helpers
│   └── server/               ← ServeMux setup + route registration
├── config/                   ← 12-factor env config
├── domain/                   ← Domain model structs
├── repository/database/      ← sqlc-generated Go (28 queries)
├── services/                 ← Business logic (track, tag, gallery)
└── storage/                  ← File storage abstraction + LocalStorage
pkg/
├── audiometa/                ← Audio format validation + duration extraction
└── filehash/                 ← SHA-256 hashing
db/
├── schema.sql                ← PostgreSQL schema (6 tables, 6 indexes)
└── query.sql                 ← sqlc query definitions
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/tracks` | Upload audio file (multipart/form-data) |
| `GET` | `/api/v1/tracks` | List all tracks |
| `GET` | `/api/v1/tracks/{id}` | Get track by ID |
| `DELETE` | `/api/v1/tracks/{id}` | Delete track + stored file |
| `POST` | `/api/v1/tracks/{id}/tags` | Assign tag to track |
| `POST` | `/api/v1/tags` | Create tag |
| `GET` | `/api/v1/tags` | List tags (with track counts) |
| `DELETE` | `/api/v1/tags/{id}` | Delete tag |
| `GET` | `/api/v1/gallery` | Gallery view (tracks grouped by tag) |
| `GET` | `/api/health` | Health check |

## Response Format

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "VALIDATION_FAILED", "message": "..." } }
```

## Setup

```bash
# 1. Prerequisites
brew install go sqlc postgresql

# 2. Database
createdb auvi
psql auvi < db/schema.sql

# 3. Generate sqlc code (only if modifying queries)
sqlc generate

# 4. Run
go run cmd/api/main.go
# → 🎵 Auvi backend listening on :8080

# 5. Test
curl http://localhost:8080/api/health
curl -F "file=@song.mp3" http://localhost:8080/api/v1/tracks
curl http://localhost:8080/api/v1/gallery
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server port |
| `DATABASE_URL` | `postgres://localhost:5432/auvi?sslmode=disable` | PostgreSQL connection |
| `UPLOAD_DIR` | `./uploads` | File storage directory |
| `MAX_FILE_MB` | `100` | Max upload size (MB) |

## Middleware Stack

Applied in order: **Recover → Logger → CORS → Security Headers → Path Traversal Guard → Rate Limiter** (100 req/s, burst 200)

---

## ✅ What's Built

- [x] Full REST API (10 endpoints)
- [x] PostgreSQL schema (6 tables: tracks, tags, track_tags, artists, upload_sessions, playback_events)
- [x] 28 type-safe sqlc queries
- [x] File upload with SHA-256 dedup + atomic writes
- [x] Audio metadata extraction (format validation, filename parsing, WAV duration)
- [x] Tag-driven gallery grouping (single-query, N+1 free)
- [x] Complete middleware stack (CORS, rate limiting, security headers, logging, panic recovery)
- [x] Idempotent tag creation
- [x] Duplicate track detection via file hash
- [x] Graceful shutdown
- [x] 12-factor config

## 🔲 What's Remaining

- [ ] **Unit tests** — service-layer tests with mock repositories
- [ ] **Integration tests** — API endpoint tests with test database
- [ ] **Audio streaming** — currently stores files but doesn't serve audio bytes
- [ ] **Proper ID3/metadata parsing** — replace bitrate estimation with `dhowden/tag` library
- [ ] **Authentication** — JWT middleware, user accounts (designed for, not implemented)
- [ ] **S3 storage backend** — interface exists, needs `s3.go` implementation
- [ ] **Docker / Docker Compose** — containerized development environment
- [ ] **Database migrations** — proper migration tooling (golang-migrate)
- [ ] **Pagination** — track and tag list endpoints
- [ ] **Search / filtering** — query tracks by title, artist, duration
- [ ] **Playback event tracking** — schema ready, no API endpoint yet
- [ ] **Frontend ↔ Backend integration** — connect the React frontend to this API
