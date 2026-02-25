ALTER TABLE tracks ADD COLUMN mood   VARCHAR(50);
ALTER TABLE tracks ADD COLUMN bpm    FLOAT;
ALTER TABLE tracks ADD COLUMN energy FLOAT;
CREATE INDEX idx_tracks_mood      ON tracks(mood)          WHERE mood IS NOT NULL;
CREATE INDEX idx_tracks_user_mood ON tracks(user_id, mood) WHERE mood IS NOT NULL;
