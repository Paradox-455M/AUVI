package services

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"auvi/internal/cache"
	"auvi/internal/storage"
	"auvi/pkg/audiometa"

	db "auvi/internal/repository/database"

	"github.com/google/uuid"
)

// TrackService handles track lifecycle: create (with upload), get, list, delete, mood update.
type TrackService struct {
	queries      db.Querier
	store        storage.Storage
	galleryCache *cache.GalleryCache
}

func NewTrackService(queries db.Querier, store storage.Storage, galleryCache *cache.GalleryCache) *TrackService {
	return &TrackService{
		queries:      queries,
		store:        store,
		galleryCache: galleryCache,
	}
}

// CreateInput holds the data needed to create a new track.
type CreateInput struct {
	UserID   uuid.UUID
	Filename string
	FileData io.Reader
	FileSize int64
	Title    string
	Artist   string
	TagIDs   []uuid.UUID
}

// Create ingests an audio file, extracts metadata, stores the file, and persists the track.
func (s *TrackService) Create(ctx context.Context, input CreateInput) (db.Track, error) {
	if !audiometa.IsAllowedFormat(input.Filename) {
		return db.Track{}, fmt.Errorf("unsupported audio format: %s", filepath.Ext(input.Filename))
	}

	fileBytes, err := io.ReadAll(input.FileData)
	if err != nil {
		return db.Track{}, fmt.Errorf("read upload data: %w", err)
	}

	meta, err := s.store.SaveFile(ctx, "tracks", input.Filename, bytes.NewReader(fileBytes))
	if err != nil {
		return db.Track{}, fmt.Errorf("store file: %w", err)
	}

	// Check for duplicate via file hash
	existing, err := s.queries.GetTrackByFileHash(ctx, meta.FileHash)
	if err == nil {
		_ = s.store.DeleteFile(ctx, meta.Path)
		return existing, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		_ = s.store.DeleteFile(ctx, meta.Path)
		return db.Track{}, fmt.Errorf("check duplicate: %w", err)
	}

	// Extract metadata from filename
	title, artist := audiometa.ExtractFromFilename(input.Filename)
	if input.Title != "" {
		title = input.Title
	}
	if input.Artist != "" {
		artist = input.Artist
	}

	// Estimate duration
	ext := strings.ToLower(filepath.Ext(input.Filename))
	var durationMs int
	if ext == ".wav" {
		dur, err := audiometa.EstimateWAVDuration(bytes.NewReader(fileBytes))
		if err == nil {
			durationMs = dur
		}
	}
	if durationMs == 0 {
		durationMs = audiometa.EstimateDurationFromSize(int64(len(fileBytes)), ext)
	}

	// Resolve artist (optional)
	var artistID uuid.NullUUID
	if artist != "" {
		dbArtist, err := s.queries.GetArtistByName(ctx, artist)
		if errors.Is(err, sql.ErrNoRows) {
			dbArtist, err = s.queries.CreateArtist(ctx, artist)
		}
		if err == nil {
			artistID = uuid.NullUUID{UUID: dbArtist.ID, Valid: true}
		}
	}

	track, err := s.queries.CreateTrack(ctx, db.CreateTrackParams{
		UserID:        input.UserID,
		Title:         title,
		ArtistID:      artistID,
		AudioFilePath: meta.Path,
		DurationMs:    int32(durationMs),
		FileHash:      meta.FileHash,
	})
	if err != nil {
		_ = s.store.DeleteFile(ctx, meta.Path)
		return db.Track{}, fmt.Errorf("create track record: %w", err)
	}

	for _, tagID := range input.TagIDs {
		_ = s.queries.AssignTagToTrack(ctx, db.AssignTagToTrackParams{
			TrackID: track.ID,
			TagID:   tagID,
		})
	}

	s.galleryCache.Invalidate(input.UserID)
	return track, nil
}

// Get retrieves a track owned by the given user.
func (s *TrackService) Get(ctx context.Context, id, userID uuid.UUID) (db.Track, error) {
	track, err := s.queries.GetTrackByUser(ctx, db.GetTrackByUserParams{ID: id, UserID: userID})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Track{}, fmt.Errorf("track not found: %s", id)
		}
		return db.Track{}, fmt.Errorf("get track: %w", err)
	}
	return track, nil
}

// ListByUser returns paginated tracks for a user.
func (s *TrackService) ListByUser(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]db.Track, int64, error) {
	tracks, err := s.queries.ListTracksByUser(ctx, db.ListTracksByUserParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list tracks: %w", err)
	}
	if tracks == nil {
		tracks = []db.Track{}
	}
	total, err := s.queries.CountTracksByUser(ctx, userID)
	if err != nil {
		return nil, 0, fmt.Errorf("count tracks: %w", err)
	}
	return tracks, total, nil
}

// Delete removes a user-owned track and its associated file.
func (s *TrackService) Delete(ctx context.Context, id, userID uuid.UUID) error {
	track, err := s.queries.GetTrackByUser(ctx, db.GetTrackByUserParams{ID: id, UserID: userID})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("track not found: %s", id)
		}
		return fmt.Errorf("get track for delete: %w", err)
	}

	if err := s.queries.DeleteTrack(ctx, id); err != nil {
		return fmt.Errorf("delete track record: %w", err)
	}

	_ = s.store.DeleteFile(ctx, track.AudioFilePath)
	s.galleryCache.Invalidate(userID)
	return nil
}

// MoodInput holds validated mood data.
type MoodInput struct {
	Mood   string
	BPM    *float64
	Energy *float64
}

// UpdateMood sets the mood (and optionally BPM/energy) for a user-owned track.
func (s *TrackService) UpdateMood(ctx context.Context, id, userID uuid.UUID, input MoodInput) (db.Track, error) {
	params := db.UpdateTrackMoodParams{
		ID:     id,
		UserID: userID,
		Mood:   sql.NullString{String: input.Mood, Valid: true},
	}
	if input.BPM != nil {
		params.Bpm = sql.NullFloat64{Float64: *input.BPM, Valid: true}
	}
	if input.Energy != nil {
		params.Energy = sql.NullFloat64{Float64: *input.Energy, Valid: true}
	}

	track, err := s.queries.UpdateTrackMood(ctx, params)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Track{}, fmt.Errorf("track not found: %s", id)
		}
		return db.Track{}, fmt.Errorf("update mood: %w", err)
	}

	s.galleryCache.Invalidate(userID)
	return track, nil
}

// OpenFile returns a ReadSeekCloser for streaming a track's audio file.
func (s *TrackService) OpenFile(ctx context.Context, id, userID uuid.UUID) (io.ReadSeekCloser, int64, string, error) {
	track, err := s.queries.GetTrackByUser(ctx, db.GetTrackByUserParams{ID: id, UserID: userID})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, 0, "", fmt.Errorf("track not found: %s", id)
		}
		return nil, 0, "", fmt.Errorf("get track: %w", err)
	}

	f, size, err := s.store.OpenFile(ctx, track.AudioFilePath)
	if err != nil {
		return nil, 0, "", fmt.Errorf("open file: %w", err)
	}
	return f, size, track.Title, nil
}
