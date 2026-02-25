# Auvi — Improvement Plan

A prioritized roadmap of what to build next, grouped by theme.

---

## Phase 1 — Connect the Dots (Frontend ↔ Backend)

The biggest win. The backend is fully built; the frontend just needs to talk to it.

| # | Task | Notes |
|---|---|---|
| 1.1 | **Auth flow UI** | Wire `AuthView.tsx` (already exists) to `POST /api/v1/auth/register` and `POST /api/v1/auth/login`. Store access token in memory, refresh token in `httpOnly` cookie. |
| 1.2 | **Upload to API** | Replace `useMusicLibrary.addFiles()` blob-URL path with `POST /api/v1/tracks`. Keep blob URL as a local fallback while upload is in-flight. |
| 1.3 | **Stream from API** | Replace blob URL playback with `GET /api/v1/tracks/{id}/stream`. Backend already supports `Range` / HTTP 206. |
| 1.4 | **Persist library on load** | On app start, call `GET /api/v1/gallery` and hydrate the music library — tracks no longer lost on refresh. |
| 1.5 | **Tag sync** | Push tag assignments to `POST /api/v1/tracks/{id}/tags` so tags persist server-side. |
| 1.6 | **Delete tracks** | Hook up the delete action in `TrackItem` to `DELETE /api/v1/tracks/{id}`. |

---

## Phase 2 — Visualizer

The WebGL canvas and preset system are already wired up — just needs the WASM engine.

| # | Task | Notes |
|---|---|---|
| 2.1 | **ProjectM WASM** | Integrate `projectm-wasm` npm package into `ProjectMEngine.ts`. The init stub and rAF loop are already in place. |
| 2.2 | **Preset picker UI** | Show a preset drawer in the player. Fetch presets from `GET /api/v1/presets?mood=` and let the user cycle through them. |
| 2.3 | **Mood → preset auto-select** | When a track has a `mood` field, automatically load a matching preset on play. |
| 2.4 | **Preset favorites** | `POST /api/v1/presets/{id}/favorite` endpoint already exists — add a star button in the preset picker. |

---

## Phase 3 — Player Features

| # | Task | Notes |
|---|---|---|
| 3.1 | **Queue / continuous play** | After a track ends, auto-advance to the next track in the current tag section. |
| 3.2 | **Waveform display** | Render a static waveform (Web Audio API `OfflineAudioContext` decode) alongside the seek bar. |
| 3.3 | **Keyboard shortcuts** | `Space` play/pause, `←/→` seek ±10s, `M` mute, `↑/↓` volume. |
| 3.4 | **Playback speed** | Add 0.75×, 1×, 1.25×, 1.5× speed options via `AudioBufferSourceNode.playbackRate`. |
| 3.5 | **Sleep timer** | Auto-pause after N minutes — useful for long listening sessions. |

---

## Phase 4 — Library & Discovery

| # | Task | Notes |
|---|---|---|
| 4.1 | **Search** | Live search across title, artist, and tag. Filter both gallery and HeroStack as you type. |
| 4.2 | **Sort options** | Sort tracks by date added, title, artist, duration, or BPM. |
| 4.3 | **Drag-to-reorder tags** | Let users reorder tag sections in the gallery by dragging. |
| 4.4 | **Bulk tag** | Select multiple tracks and assign a tag to all at once. |
| 4.5 | **Smart playlists** | Auto-generated groups: "Recently added", "Longest tracks", "No tag yet". |

---

## Phase 5 — Infrastructure & DX

| # | Task | Notes |
|---|---|---|
| 5.1 | **Docker Compose** | One `docker-compose up` starts Postgres + backend + frontend. Removes all local setup friction. |
| 5.2 | **Migration tooling** | Adopt `golang-migrate` so migrations run automatically on server start instead of manual `psql` commands. |
| 5.3 | **S3 storage backend** | `storage.Storage` interface is already designed for this — implement `s3.go` alongside `local.go`. |
| 5.4 | **Backend tests** | Service-layer unit tests with mock repositories; API integration tests against a test database. |
| 5.5 | **CI pipeline** | GitHub Actions: `tsc + vite build` for frontend, `go vet + go test ./...` for backend on every push. |
| 5.6 | **ID3 full metadata** | Swap the current filename parser for `dhowden/tag` to read proper BPM, genre, year, and track number from ID3 tags. |

---

## Phase 6 — Polish & Performance

| # | Task | Notes |
|---|---|---|
| 6.1 | **Responsive layout** | The gallery and player are desktop-first — add breakpoints for tablet and mobile. |
| 6.2 | **Virtualized track list** | Use `@tanstack/react-virtual` for tag sections with 50+ tracks to keep scroll smooth. |
| 6.3 | **Optimistic UI** | Show uploads instantly in the gallery before the API responds; roll back on error. |
| 6.4 | **Offline support** | Service Worker + Cache API to serve previously loaded tracks without a network. |
| 6.5 | **Dark / light mode** | All colors are already CSS custom properties — a theme toggle is low-effort. |

---

## Quick Wins (under an hour each)

- Add `git config --global user.email / user.name` to the setup docs so commits have a proper author
- Redirect `http://localhost:5173` to the login page when no auth token is present
- Add a `npm run typecheck` script (runs `tsc --noEmit` without building) for fast iteration
- Validate `JWT_SECRET` length at server startup and exit early with a clear error if it's too short
- Add `CONTRIBUTING.md` with branch naming conventions and PR checklist
