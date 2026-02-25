ALTER TABLE tracks ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- Clear existing blob-URL data (backend never connected; safe to delete)
DELETE FROM tracks;
DELETE FROM artists;
DELETE FROM playback_events;
ALTER TABLE tracks ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX idx_tracks_user_id      ON tracks(user_id);
CREATE INDEX idx_tracks_user_created ON tracks(user_id, created_at DESC);
