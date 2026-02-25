-- Complete Auvi schema (reflects all migrations 001-007)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100) NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_active  ON refresh_tokens(token_hash)
    WHERE revoked = FALSE AND expires_at > NOW();

CREATE TABLE artists (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tracks (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          VARCHAR(255) NOT NULL,
    artist_id      UUID REFERENCES artists(id) ON DELETE SET NULL,
    audio_file_path TEXT NOT NULL,
    duration_ms    INTEGER NOT NULL DEFAULT 0,
    file_hash      VARCHAR(255) NOT NULL UNIQUE,
    mood           VARCHAR(50),
    bpm            FLOAT,
    energy         FLOAT,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tracks_artist_id    ON tracks(artist_id);
CREATE INDEX idx_tracks_file_hash    ON tracks(file_hash);
CREATE INDEX idx_tracks_user_id      ON tracks(user_id);
CREATE INDEX idx_tracks_user_created ON tracks(user_id, created_at DESC);
CREATE INDEX idx_tracks_mood         ON tracks(mood)          WHERE mood IS NOT NULL;
CREATE INDEX idx_tracks_user_mood    ON tracks(user_id, mood) WHERE mood IS NOT NULL;

CREATE TABLE tags (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tags_name ON tags(name);

CREATE TABLE track_tags (
    track_id   UUID REFERENCES tracks(id) ON DELETE CASCADE,
    tag_id     UUID REFERENCES tags(id)   ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (track_id, tag_id)
);
CREATE INDEX idx_track_tags_tag_id    ON track_tags(tag_id);
CREATE INDEX idx_track_tags_composite ON track_tags(tag_id, track_id);

CREATE TABLE presets (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    data       TEXT NOT NULL,
    mood       VARCHAR(50),
    author_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_presets_mood   ON presets(mood)      WHERE mood IS NOT NULL;
CREATE INDEX idx_presets_author ON presets(author_id) WHERE author_id IS NOT NULL;

CREATE TABLE preset_favorites (
    user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    preset_id  UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, preset_id)
);
CREATE INDEX idx_preset_favorites_user ON preset_favorites(user_id);

CREATE TABLE upload_sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status     VARCHAR(50) NOT NULL,
    track_id   UUID REFERENCES tracks(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id)  ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE playback_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id        UUID REFERENCES tracks(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id)  ON DELETE SET NULL,
    user_session_id VARCHAR(255),
    played_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_playback_events_track_id  ON playback_events(track_id);
CREATE INDEX idx_playback_events_played_at ON playback_events(played_at);
