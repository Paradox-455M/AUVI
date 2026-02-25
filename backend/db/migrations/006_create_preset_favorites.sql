CREATE TABLE preset_favorites (
    user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    preset_id  UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, preset_id)
);
CREATE INDEX idx_preset_favorites_user ON preset_favorites(user_id);
