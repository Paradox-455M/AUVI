-- ============================================================
-- USERS
-- ============================================================

-- name: CreateUser :one
INSERT INTO users (email, password_hash, display_name)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1 LIMIT 1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1 LIMIT 1;

-- ============================================================
-- REFRESH TOKENS
-- ============================================================

-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetRefreshTokenByHash :one
SELECT * FROM refresh_tokens
WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()
LIMIT 1;

-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1;

-- name: RevokeAllUserRefreshTokens :exec
UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1;

-- name: DeleteExpiredRefreshTokens :exec
DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = TRUE;

-- ============================================================
-- ARTISTS
-- ============================================================

-- name: CreateArtist :one
INSERT INTO artists (name)
VALUES ($1)
RETURNING *;

-- name: GetArtist :one
SELECT * FROM artists
WHERE id = $1 LIMIT 1;

-- name: GetArtistByName :one
SELECT * FROM artists
WHERE name = $1 LIMIT 1;

-- name: ListArtists :many
SELECT * FROM artists
ORDER BY name ASC;

-- name: DeleteArtist :exec
DELETE FROM artists WHERE id = $1;

-- ============================================================
-- TRACKS
-- ============================================================

-- name: CreateTrack :one
INSERT INTO tracks (user_id, title, artist_id, audio_file_path, duration_ms, file_hash, mood, bpm, energy)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetTrack :one
SELECT * FROM tracks
WHERE id = $1 LIMIT 1;

-- name: GetTrackByUser :one
SELECT * FROM tracks
WHERE id = $1 AND user_id = $2 LIMIT 1;

-- name: GetTrackByFileHash :one
SELECT * FROM tracks
WHERE file_hash = $1 LIMIT 1;

-- name: ListTracksByUser :many
SELECT * FROM tracks
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountTracksByUser :one
SELECT count(*) FROM tracks WHERE user_id = $1;

-- name: UpdateTrackMood :one
UPDATE tracks
SET mood = $3, bpm = $4, energy = $5, updated_at = now()
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteTrack :exec
DELETE FROM tracks WHERE id = $1;

-- ============================================================
-- TAGS
-- ============================================================

-- name: CreateTag :one
INSERT INTO tags (name)
VALUES ($1)
RETURNING *;

-- name: GetTag :one
SELECT * FROM tags
WHERE id = $1 LIMIT 1;

-- name: GetTagByName :one
SELECT * FROM tags
WHERE name = $1 LIMIT 1;

-- name: ListTags :many
SELECT * FROM tags
ORDER BY name ASC;

-- name: DeleteTag :exec
DELETE FROM tags WHERE id = $1;

-- ============================================================
-- TRACK_TAGS (many-to-many)
-- ============================================================

-- name: AssignTagToTrack :exec
INSERT INTO track_tags (track_id, tag_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: RemoveTagFromTrack :exec
DELETE FROM track_tags
WHERE track_id = $1 AND tag_id = $2;

-- name: ListTagsForTrack :many
SELECT t.* FROM tags t
INNER JOIN track_tags tt ON t.id = tt.tag_id
WHERE tt.track_id = $1
ORDER BY t.name ASC;

-- name: ListTracksByTag :many
SELECT tr.* FROM tracks tr
INNER JOIN track_tags tt ON tr.id = tt.track_id
WHERE tt.tag_id = $1
ORDER BY tr.created_at DESC;

-- name: ListTagsWithTrackCount :many
SELECT t.id, t.name, t.created_at, count(tt.track_id)::int AS track_count
FROM tags t
LEFT JOIN track_tags tt ON t.id = tt.tag_id
GROUP BY t.id, t.name, t.created_at
ORDER BY track_count DESC, t.name ASC;

-- name: ListTrackIDsByTag :many
SELECT tt.track_id FROM track_tags tt
WHERE tt.tag_id = $1;

-- ============================================================
-- GALLERY (tag-driven grouping, user-scoped)
-- ============================================================

-- name: GetGalleryTracksByUser :many
SELECT
    tr.id             AS track_id,
    tr.title,
    tr.artist_id,
    tr.audio_file_path,
    tr.duration_ms,
    tr.file_hash,
    tr.mood,
    tr.created_at     AS track_created_at,
    tr.updated_at     AS track_updated_at,
    t.id              AS tag_id,
    t.name            AS tag_name,
    t.created_at      AS tag_created_at
FROM tracks tr
INNER JOIN track_tags tt ON tr.id = tt.track_id
INNER JOIN tags t         ON tt.tag_id = t.id
WHERE tr.user_id = $1
ORDER BY t.name ASC, tr.created_at DESC;

-- ============================================================
-- UPLOAD SESSIONS
-- ============================================================

-- name: CreateUploadSession :one
INSERT INTO upload_sessions (status)
VALUES ($1)
RETURNING *;

-- name: GetUploadSession :one
SELECT * FROM upload_sessions
WHERE id = $1 LIMIT 1;

-- name: UpdateUploadSessionStatus :one
UPDATE upload_sessions
SET status = $2, track_id = $3, updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: ListUploadSessions :many
SELECT * FROM upload_sessions
ORDER BY created_at DESC
LIMIT $1;

-- ============================================================
-- PLAYBACK EVENTS (analytics)
-- ============================================================

-- name: CreatePlaybackEvent :one
INSERT INTO playback_events (track_id, user_session_id)
VALUES ($1, $2)
RETURNING *;

-- name: ListPlaybackEventsForTrack :many
SELECT * FROM playback_events
WHERE track_id = $1
ORDER BY played_at DESC
LIMIT $2;

-- name: CountPlaybacksForTrack :one
SELECT count(*) FROM playback_events
WHERE track_id = $1;

-- ============================================================
-- PRESETS
-- ============================================================

-- name: CreatePreset :one
INSERT INTO presets (name, data, mood, author_id, is_builtin)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetPreset :one
SELECT * FROM presets WHERE id = $1 LIMIT 1;

-- name: ListPresets :many
SELECT id, name, mood, author_id, is_builtin, created_at FROM presets
ORDER BY is_builtin DESC, created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListPresetsByMood :many
SELECT id, name, mood, author_id, is_builtin, created_at FROM presets
WHERE mood = $1
ORDER BY is_builtin DESC, created_at DESC
LIMIT $2 OFFSET $3;

-- name: DeletePreset :exec
DELETE FROM presets WHERE id = $1 AND author_id = $2;

-- ============================================================
-- PRESET FAVORITES
-- ============================================================

-- name: AddPresetFavorite :exec
INSERT INTO preset_favorites (user_id, preset_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: RemovePresetFavorite :exec
DELETE FROM preset_favorites WHERE user_id = $1 AND preset_id = $2;

-- name: GetPresetFavorite :one
SELECT * FROM preset_favorites
WHERE user_id = $1 AND preset_id = $2 LIMIT 1;

-- name: ListUserFavoritePresets :many
SELECT p.* FROM presets p
INNER JOIN preset_favorites pf ON p.id = pf.preset_id
WHERE pf.user_id = $1
ORDER BY pf.created_at DESC
LIMIT $2 OFFSET $3;
