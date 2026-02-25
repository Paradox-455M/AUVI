# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Auvi is split into two independent sub-projects:

```
frontend/    ← React/TypeScript SPA (Vite)
backend/     ← Go REST API (net/http + PostgreSQL + sqlc)
```

---

## Frontend (`frontend/`)

### Commands

```bash
cd frontend
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Type-check (tsc) + production build to dist/
npm run preview      # Serve the built dist/
```

There are no tests. TypeScript compilation (`tsc`) is the primary correctness check and runs as part of `build`.

Path alias: `@/` maps to `src/`.

**Vite quirk:** `jsmediatags` has a broken `browser` field in its `package.json`. It is aliased in `vite.config.ts` to `node_modules/jsmediatags/build2/jsmediatags.js` to work around this.

### Architecture Overview

React/TypeScript SPA — an editorial music player with a WebGL visualizer. Two routes managed with state in `App.tsx` (no router library): `library` and `player`. View transitions use Framer Motion `AnimatePresence`. The Player is lazy-loaded for code splitting.

#### Audio Layer (`src/audio/`)
- `useAudioPlayer.ts` — primary playback hook. Manages a Web Audio API graph (AudioContext → MediaElementSource → GainNode → AnalyserNode → destination). Exposes `analyserNode` for the visualizer. Does smooth gain ramping on play/pause/mute/volume changes.
- `AudioEngine.ts` — older singleton class used only by `VisualizerCanvas` to feed PCM data to the render loop. The two audio systems are parallel: `useAudioPlayer` owns playback, `AudioEngine` owns the analysis data.

#### Music Library (`src/music/`)
- `useMusicLibrary.ts` — module-level state (not Zustand) shared across all hook instances. Manages `Track` objects, creates blob URLs from uploaded `File` objects, handles tag management. Revokes both audio blob URLs and artwork blob URLs on `removeTrack`/`clearLibrary`.
- `metadata.ts` — parses title/artist from filenames (splits on ` - `, `-`, etc.), extracts duration via a temporary `<audio>` element, and extracts album artwork via `extractArtworkFromFile()` (reads ID3v2 APIC frame using `jsmediatags`, returns a blob URL or `null`).
- `tagUtils.ts` — groups and orders tracks by tag for the gallery.
- `types.ts` — `Track` type: `{ id, file, url, title, artist?, duration?, tags, createdAt, artworkUrl? }`.

#### Visualizer (`src/visualizer/`)
- `VisualizerCanvas.tsx` — full-bleed canvas. rAF loop calling `audioEngine.getAnalysis()` for PCM data and `projectMEngine.renderFrame()`.
- `ProjectMEngine.ts` — stub for future projectM WASM integration. `init()` acquires WebGL context but does nothing else.
- `PresetManager.ts` — manages MilkDrop-style preset strings.

#### UI & Design System
Motion tokens live in `src/motion/tokens.ts`. The canonical easing is `[0.22, 1, 0.36, 1]` (cinematic). All transitions must fall in the 600ms–1200ms range.

CSS is split into three files in `src/styles/`:
- `globals.css` — CSS custom properties (colors, fonts), Tailwind layers, utility classes (`.grain-overlay`, `.hover-drift`)
- `typography.css` — named component classes (`.display-cinematic`, `.track-title-elegant`, `.body-editorial`, `.metadata-soft`, etc.)
- `layout.css` — structural classes (`.library-scene`, `.library-frame`, `.hero-arc-section`, etc.)

Tailwind is used for spacing utilities and quick one-offs; named semantic classes from `typography.css`/`layout.css` are preferred for recurring patterns. Design is intentionally asymmetric and editorial.

#### Data Flow: Library → Player
1. User uploads files via `UploadTrigger` → `Gallery` calls `useMusicLibrary().addFiles()`.
2. Each file gets a blob URL, ID3 artwork extracted (`artworkUrl`), and a `Track` object with filename-parsed metadata.
3. `Gallery` groups tracks by tag via `tagUtils`, renders `TagSection` → `TrackItem`.
4. `Library.tsx` also renders `HeroStack` above the gallery — a fan/arc of up to 7 album cards. Clicking a side card brings it to front; clicking the front card enters the player.
5. Clicking a track calls `onTrackSelect(track.url)` (blob URL, not track ID).
6. `App.tsx` receives the URL as `selectedSongId` and transitions to `player` view.
7. `Player.tsx` calls `resolveSongSource()` to validate the URL, then `useAudioPlayer().load(url)`.

**Note:** `songId` passed to `Player` is the audio URL (blob URL for uploads, or a numeric string for catalog tracks). `getTrackTitle(songId)` in `src/data/tracks.ts` falls back to filename parsing when the ID doesn't match the static catalog.

---

## Backend (`backend/`)

### Commands

```bash
cd backend

# Prerequisites
brew install go sqlc postgresql
createdb auvi
psql auvi < db/schema.sql

# Run
go run cmd/api/main.go
# → listening on :8080

# Regenerate sqlc code (only when db/query.sql or db/schema.sql changes)
sqlc generate
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server port |
| `DATABASE_URL` | `postgres://localhost:5432/auvi?sslmode=disable` | PostgreSQL connection |
| `UPLOAD_DIR` | `./uploads` | File storage directory |
| `MAX_FILE_MB` | `100` | Max upload size |

### Architecture

Go 1.25 with stdlib `net/http` (Go 1.22+ routing), PostgreSQL, and `sqlc` for type-safe query generation. No ORM. Dependency injection wired manually in `cmd/api/main.go`.

```
cmd/api/main.go                 ← DI wiring + graceful shutdown
internal/
├── api/handlers/               ← HTTP controllers (tracks, tags, gallery)
├── api/middleware/             ← Recover → Logger → CORS → SecurityHeaders → PathTraversalGuard → RateLimiter
├── api/response/               ← JSON envelope helpers { success, data } / { success, error }
├── api/server/                 ← ServeMux + route registration
├── config/                     ← 12-factor env config
├── domain/models.go            ← Domain structs (Track, Tag, Artist, TrackWithTags, TagGalleryGroup, etc.)
├── repository/database/        ← sqlc-generated code (28 queries)
├── services/                   ← Business logic (trackService, tagService, galleryService)
└── storage/                    ← Storage interface + LocalStorage (S3-ready)
pkg/
├── audiometa/                  ← Audio format validation + duration extraction
└── filehash/                   ← SHA-256 hashing
db/
├── schema.sql                  ← 6 tables: tracks, tags, track_tags, artists, upload_sessions, playback_events
└── query.sql                   ← sqlc query definitions
```

### API Endpoints

All responses use the envelope: `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code": "...", "message": "..." } }`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/tracks` | Upload audio file (multipart/form-data) |
| `GET` | `/api/v1/tracks` | List all tracks |
| `GET` | `/api/v1/tracks/{id}` | Get track by ID |
| `DELETE` | `/api/v1/tracks/{id}` | Delete track + file |
| `POST` | `/api/v1/tracks/{id}/tags` | Assign tag to track |
| `POST` | `/api/v1/tags` | Create tag |
| `GET` | `/api/v1/tags` | List tags (with track counts) |
| `DELETE` | `/api/v1/tags/{id}` | Delete tag |
| `GET` | `/api/v1/gallery` | Tracks grouped by tag (single query, N+1-free) |
| `GET` | `/api/health` | Health check |

### Key Backend Patterns
- File deduplication via SHA-256 hash (`file_hash UNIQUE` on `tracks`); uploading an identical file returns `409 Conflict`.
- Tag creation is idempotent (`INSERT ... ON CONFLICT DO NOTHING`).
- `Storage` interface (`SaveFile`, `DeleteFile`, `GetFileMetadata`) makes `LocalStorage` swappable for S3 without touching service code.
- `sqlc generate` must be re-run whenever `db/query.sql` or `db/schema.sql` changes; the generated files in `internal/repository/database/` should not be hand-edited.

### Frontend ↔ Backend Integration Status
The frontend currently operates fully client-side (blob URLs, in-memory state). The backend API is built but **not yet connected** to the frontend. Tracks are lost on page refresh. Connecting them is the primary remaining integration task.
