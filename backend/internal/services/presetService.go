package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	db "auvi/internal/repository/database"

	"github.com/google/uuid"
)

// ValidMoods is the set of allowed mood values.
var ValidMoods = map[string]bool{
	"calm": true, "melancholic": true, "focused": true,
	"uplifting": true, "energetic": true, "intense": true,
}

// PresetService manages MilkDrop visualizer presets and user favorites.
type PresetService struct {
	queries db.Querier
}

func NewPresetService(queries db.Querier) *PresetService {
	return &PresetService{queries: queries}
}

// Create stores a user-uploaded preset. Validates mood if provided.
func (s *PresetService) Create(ctx context.Context, name, data, mood string, authorID uuid.UUID) (db.Preset, error) {
	params := db.CreatePresetParams{
		Name:      name,
		Data:      data,
		IsBuiltin: false,
		AuthorID:  uuid.NullUUID{UUID: authorID, Valid: true},
	}
	if mood != "" {
		if !ValidMoods[mood] {
			return db.Preset{}, fmt.Errorf("invalid mood: %q", mood)
		}
		params.Mood = sql.NullString{String: mood, Valid: true}
	}

	preset, err := s.queries.CreatePreset(ctx, params)
	if err != nil {
		return db.Preset{}, fmt.Errorf("create preset: %w", err)
	}
	return preset, nil
}

// Get returns a single preset with its full data string.
func (s *PresetService) Get(ctx context.Context, id uuid.UUID) (db.Preset, error) {
	preset, err := s.queries.GetPreset(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Preset{}, fmt.Errorf("preset not found: %s", id)
		}
		return db.Preset{}, fmt.Errorf("get preset: %w", err)
	}
	return preset, nil
}

// List returns preset metadata (no data field). Filters by mood when provided.
func (s *PresetService) List(ctx context.Context, mood string, limit, offset int32) (interface{}, error) {
	if mood != "" {
		if !ValidMoods[mood] {
			return nil, fmt.Errorf("invalid mood: %q", mood)
		}
		rows, err := s.queries.ListPresetsByMood(ctx, db.ListPresetsByMoodParams{
			Mood:   sql.NullString{String: mood, Valid: true},
			Limit:  limit,
			Offset: offset,
		})
		if err != nil {
			return nil, fmt.Errorf("list presets by mood: %w", err)
		}
		if rows == nil {
			rows = []db.ListPresetsByMoodRow{}
		}
		return rows, nil
	}

	rows, err := s.queries.ListPresets(ctx, db.ListPresetsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("list presets: %w", err)
	}
	if rows == nil {
		rows = []db.ListPresetsRow{}
	}
	return rows, nil
}

// Delete removes a preset owned by the given user.
func (s *PresetService) Delete(ctx context.Context, id, userID uuid.UUID) error {
	// Verify the preset exists and is owned by this user
	preset, err := s.queries.GetPreset(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("preset not found: %s", id)
		}
		return fmt.Errorf("get preset: %w", err)
	}
	if !preset.AuthorID.Valid || preset.AuthorID.UUID != userID {
		return fmt.Errorf("preset not found: %s", id)
	}

	if err := s.queries.DeletePreset(ctx, db.DeletePresetParams{
		ID:       id,
		AuthorID: uuid.NullUUID{UUID: userID, Valid: true},
	}); err != nil {
		return fmt.Errorf("delete preset: %w", err)
	}
	return nil
}

// ToggleFavorite adds or removes a preset from a user's favorites.
// Returns true if the preset was added, false if removed.
func (s *PresetService) ToggleFavorite(ctx context.Context, userID, presetID uuid.UUID) (bool, error) {
	_, err := s.queries.GetPresetFavorite(ctx, db.GetPresetFavoriteParams{
		UserID:   userID,
		PresetID: presetID,
	})
	if err == nil {
		// Already favorited — remove it
		if err := s.queries.RemovePresetFavorite(ctx, db.RemovePresetFavoriteParams{
			UserID:   userID,
			PresetID: presetID,
		}); err != nil {
			return false, fmt.Errorf("remove favorite: %w", err)
		}
		return false, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return false, fmt.Errorf("check favorite: %w", err)
	}

	// Not favorited — add it
	if err := s.queries.AddPresetFavorite(ctx, db.AddPresetFavoriteParams{
		UserID:   userID,
		PresetID: presetID,
	}); err != nil {
		return false, fmt.Errorf("add favorite: %w", err)
	}
	return true, nil
}

// ListUserFavorites returns a user's favorited presets.
func (s *PresetService) ListUserFavorites(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]db.Preset, error) {
	presets, err := s.queries.ListUserFavoritePresets(ctx, db.ListUserFavoritePresetsParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("list favorites: %w", err)
	}
	if presets == nil {
		presets = []db.Preset{}
	}
	return presets, nil
}
