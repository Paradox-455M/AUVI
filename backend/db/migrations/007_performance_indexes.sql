-- Covering index eliminates heap lookups on the gallery 3-way JOIN
CREATE INDEX idx_track_tags_composite ON track_tags(tag_id, track_id);
-- Scope playback events and upload sessions to users
ALTER TABLE playback_events ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE upload_sessions ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
