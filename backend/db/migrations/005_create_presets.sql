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
