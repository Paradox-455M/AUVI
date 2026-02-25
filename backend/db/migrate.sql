-- Auvi — single migration file (combines 001–007 in order)
-- Run once on a fresh database, or on a DB that only has the old schema.
-- Safe to inspect; not idempotent — run against a blank DB.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 001: users
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100) NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 002: refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
    ON refresh_tokens(token_hash, revoked, expires_at);

-- existing tables (from original schema)
CREATE TABLE IF NOT EXISTS artists (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 003: tracks with user_id (clear any old blob-URL rows first)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'tracks'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tracks' AND column_name = 'user_id'
    ) THEN
        -- Old schema: wipe rows that have no user owner, then add the column.
        -- Guard each delete so this block is safe on a brand‑new database
        -- where the legacy tables might not exist yet.
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'track_tags'
        ) THEN
            DELETE FROM track_tags;
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'playback_events'
        ) THEN
            DELETE FROM playback_events;
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'upload_sessions'
        ) THEN
            DELETE FROM upload_sessions;
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'tracks'
        ) THEN
            DELETE FROM tracks;
        END IF;

        ALTER TABLE tracks ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        ALTER TABLE tracks ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS tracks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    artist_id       UUID REFERENCES artists(id) ON DELETE SET NULL,
    audio_file_path TEXT NOT NULL,
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    file_hash       VARCHAR(255) NOT NULL UNIQUE,
    mood            VARCHAR(50),
    bpm             FLOAT,
    energy          FLOAT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_id    ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_file_hash    ON tracks(file_hash);
CREATE INDEX IF NOT EXISTS idx_tracks_user_id      ON tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_tracks_user_created ON tracks(user_id, created_at DESC);

-- 004: mood columns (safe if tracks table was just created above)
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS mood   VARCHAR(50);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS bpm    FLOAT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS energy FLOAT;
CREATE INDEX IF NOT EXISTS idx_tracks_mood      ON tracks(mood)          WHERE mood IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_user_mood ON tracks(user_id, mood) WHERE mood IS NOT NULL;

CREATE TABLE IF NOT EXISTS tags (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

CREATE TABLE IF NOT EXISTS track_tags (
    track_id   UUID REFERENCES tracks(id) ON DELETE CASCADE,
    tag_id     UUID REFERENCES tags(id)   ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (track_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_track_tags_tag_id    ON track_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_track_tags_composite ON track_tags(tag_id, track_id);

-- 005: presets
CREATE TABLE IF NOT EXISTS presets (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    data       TEXT NOT NULL,
    mood       VARCHAR(50),
    author_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_presets_mood   ON presets(mood)      WHERE mood IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_presets_author ON presets(author_id) WHERE author_id IS NOT NULL;

-- 006: preset favorites
CREATE TABLE IF NOT EXISTS preset_favorites (
    user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    preset_id  UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, preset_id)
);
CREATE INDEX IF NOT EXISTS idx_preset_favorites_user ON preset_favorites(user_id);

-- 007: upload_sessions and playback_events (with user_id columns)
CREATE TABLE IF NOT EXISTS upload_sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status     VARCHAR(50) NOT NULL,
    track_id   UUID REFERENCES tracks(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id)  ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS playback_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id        UUID REFERENCES tracks(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id)  ON DELETE SET NULL,
    user_session_id VARCHAR(255),
    played_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE playback_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_playback_events_track_id  ON playback_events(track_id);
CREATE INDEX IF NOT EXISTS idx_playback_events_played_at ON playback_events(played_at);
