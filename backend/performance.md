# Performance — Auvi Backend

## Query Optimization

### Gallery Query (Critical Path)
The `GetGalleryTracks` query is the most expensive — it joins `tracks`, `track_tags`, and `tags` in a single pass. This avoids N+1 queries but returns flat rows that are grouped in-memory.

**Current indexes supporting this:**
- `idx_track_tags_tag_id` — speeds up the `track_tags → tags` join
- `idx_tracks_artist_id` — speeds up artist resolution (if extended)

**Recommendation:** If gallery response times degrade beyond 200ms at >10K tracks:
1. Add a composite index: `CREATE INDEX idx_track_tags_composite ON track_tags(tag_id, track_id);`
2. Consider a materialized view for the gallery that refreshes on track/tag mutations

### Duplicate Detection
`idx_tracks_file_hash` ensures O(1) duplicate lookup by SHA-256 hash. This runs on every upload and must remain fast.

### Playback Analytics (Future)
`idx_playback_events_played_at` supports time-range queries. When analytics scale:
- Add `idx_playback_events_composite ON playback_events(track_id, played_at)` for per-track time slicing
- Partition `playback_events` by month if volume exceeds 10M rows

## N+1 Prevention

| Endpoint | Strategy |
|---|---|
| Gallery | Single JOIN query, in-memory grouping |
| Track list | Direct query, no joins |
| Track detail | Single row fetch |
| Tag list | Single query with LEFT JOIN count |

## Caching Strategy (Future)

**Phase 1 — In-memory (Go):**
- Cache the gallery response for 30s (most read-heavy endpoint)
- Invalidate on track/tag mutations

**Phase 2 — Redis:**
- Session-based rate limiting
- Gallery cache with pub/sub invalidation
- Track metadata cache for frequently accessed tracks
