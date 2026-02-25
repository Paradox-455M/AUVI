# Auvi

A cinematic, editorial music player with a WebGL visualizer. Upload your tracks, tag them, and experience your library through a motion-heavy gallery — then step into a full-screen player backed by a real-time audio analysis engine.

```
frontend/   ← React / TypeScript SPA (Vite)
backend/    ← Go REST API (net/http · PostgreSQL · sqlc)
```

---

## What's Inside

### Frontend
- **Editorial gallery** — tracks grouped by tag in an asymmetric grid with animated transitions
- **HeroStack arc carousel** — fan of album cards that filters to the active tag
- **Full-screen player** — smooth library → player transition via Framer Motion
- **Web Audio API graph** — `AudioContext → GainNode → AnalyserNode` with smooth gain ramping on all playback events
- **WebGL visualizer** — full-bleed canvas driven by a real-time PCM rAF loop; MilkDrop preset system wired and ready
- **Metadata extraction** — ID3v2 artwork (via `jsmediatags`), duration, and title/artist parsed from filenames on upload
- **Tag management** — assign tags on upload; gallery and HeroStack both filter live by active tag

### Backend
- **REST API** — 13 endpoints across tracks, tags, gallery, presets, and auth
- **JWT auth** — register / login / refresh / logout with bcrypt and refresh-token rotation
- **Audio streaming** — `Range`-aware `GET /api/v1/tracks/{id}/stream` (HTTP 206 partial content)
- **File deduplication** — SHA-256 hash; uploading the same file returns `409 Conflict`
- **Per-user scoping** — all tracks, tags, and presets are isolated per user
- **Gallery query** — single JOIN query, N+1-free
- **MilkDrop presets** — 50 built-in presets seeded on first run, filterable by mood
- **Middleware chain** — Recover → RequestID → Logger → CORS → Gzip → Security Headers → Path Traversal Guard → Per-User Rate Limiter

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS 3 + semantic CSS classes |
| Animation | Framer Motion |
| Audio | Web Audio API |
| Backend language | Go 1.25 |
| HTTP router | `net/http` stdlib (Go 1.22+ routing) |
| Database | PostgreSQL |
| Query layer | sqlc (type-safe, no ORM) |
| DB driver | pgx/v5 |
| Auth | HS256 JWT + bcrypt |

---

## Prerequisites

- **Node.js** 18+ and **npm**
- **Go** 1.22+
- **PostgreSQL** 14+
- **sqlc** (only needed if you modify `db/query.sql` or `db/schema.sql`)

```bash
brew install go sqlc postgresql   # macOS
```

---

## Running Locally

### 1. Database

```bash
createdb auvi
psql auvi < backend/db/schema.sql

# Apply migrations in order
psql auvi < backend/db/migrations/001_create_users.sql
psql auvi < backend/db/migrations/002_create_refresh_tokens.sql
psql auvi < backend/db/migrations/003_add_user_id_to_tracks.sql
psql auvi < backend/db/migrations/004_add_mood_to_tracks.sql
psql auvi < backend/db/migrations/005_create_presets.sql
psql auvi < backend/db/migrations/006_create_preset_favorites.sql
psql auvi < backend/db/migrations/007_performance_indexes.sql
```

### 2. Backend

```bash
cd backend

# Copy env and set your JWT secret
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET to a long random string:
#   openssl rand -hex 32

go run cmd/api/main.go
# → Auvi backend listening on :8080
```

**Environment variables** (all optional except `JWT_SECRET`):

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | — | **Required.** HS256 signing key |
| `DATABASE_URL` | `postgres://localhost:5432/auvi?sslmode=disable` | PostgreSQL connection string |
| `PORT` | `8080` | HTTP server port |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded audio files |
| `MAX_FILE_MB` | `100` | Max upload size in MB |

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Both servers need to be running at the same time. The frontend talks to `http://localhost:8080` by default.

### Verify

```bash
curl http://localhost:8080/api/health
# → {"success":true,"data":"ok"}
```

---

## API Overview

All responses use the envelope:
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "...", "message": "..." } }
```

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create account |
| `POST` | `/api/v1/auth/login` | Get access + refresh tokens |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token |
| `POST` | `/api/v1/auth/logout` | Revoke refresh token |
| `POST` | `/api/v1/tracks` | Upload audio file (multipart/form-data) |
| `GET` | `/api/v1/tracks` | List user's tracks |
| `GET` | `/api/v1/tracks/{id}` | Get track metadata |
| `GET` | `/api/v1/tracks/{id}/stream` | Stream audio (Range / 206 supported) |
| `DELETE` | `/api/v1/tracks/{id}` | Delete track and file |
| `POST` | `/api/v1/tracks/{id}/tags` | Assign tag to track |
| `POST` | `/api/v1/tags` | Create tag |
| `GET` | `/api/v1/tags` | List tags with track counts |
| `DELETE` | `/api/v1/tags/{id}` | Delete tag |
| `GET` | `/api/v1/gallery` | Tracks grouped by tag (single query) |
| `GET` | `/api/v1/presets` | List MilkDrop presets (filterable by `?mood=`) |
| `GET` | `/api/health` | Health check |

---

## Project Structure

```
Auvi/
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  ← Route state (library | player), view transitions
│   │   ├── routes/
│   │   │   ├── Library.tsx          ← Gallery view: HeroStack + tag-filtered gallery
│   │   │   └── Player.tsx           ← Full-screen player (lazy-loaded)
│   │   ├── audio/
│   │   │   ├── useAudioPlayer.ts    ← Primary playback hook (Web Audio API graph)
│   │   │   └── AudioEngine.ts      ← PCM analysis singleton for visualizer
│   │   ├── music/
│   │   │   ├── useMusicLibrary.ts  ← Track state, blob URL management
│   │   │   ├── metadata.ts         ← ID3 artwork, duration, filename parsing
│   │   │   └── tagUtils.ts         ← Tag grouping and ordering
│   │   ├── components/
│   │   │   ├── Gallery.tsx         ← Tag-grouped track grid
│   │   │   └── TagSection.tsx      ← Single tag group
│   │   ├── ui/
│   │   │   ├── HeroStack.tsx       ← Arc carousel of album cards
│   │   │   └── Controls.tsx        ← Playback controls
│   │   └── visualizer/
│   │       ├── VisualizerCanvas.tsx ← Full-bleed WebGL canvas
│   │       └── ProjectMEngine.ts   ← MilkDrop / projectM WASM engine
│   └── vite.config.ts
│
└── backend/
    ├── cmd/api/main.go              ← DI wiring + graceful shutdown
    ├── internal/
    │   ├── auth/auth.go             ← Register/Login/Refresh/Logout
    │   ├── api/handlers/            ← HTTP controllers
    │   ├── api/middleware/          ← Full middleware chain
    │   ├── services/                ← Business logic
    │   ├── repository/database/     ← sqlc-generated queries
    │   └── storage/                 ← Storage interface (local, S3-ready)
    ├── pkg/
    │   ├── audiometa/               ← Audio format validation
    │   ├── filehash/                ← SHA-256 hashing
    │   └── token/jwt.go             ← JWT manager
    └── db/
        ├── schema.sql
        ├── query.sql
        └── migrations/
```

---

## Development Notes

- **Regenerate sqlc** after changing `db/query.sql` or `db/schema.sql`: `cd backend && sqlc generate`
- **Type-check frontend**: `cd frontend && npm run build` (runs `tsc` before Vite)
- **Path alias**: `@/` maps to `frontend/src/`
- **jsmediatags quirk**: aliased in `vite.config.ts` to its CJS build due to a broken `browser` field in its `package.json`
- The frontend currently operates client-side (blob URLs). Connecting it to the backend API is the primary remaining integration task.
