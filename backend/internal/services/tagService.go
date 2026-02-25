package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"auvi/internal/cache"
	db "auvi/internal/repository/database"

	"github.com/google/uuid"
)

// TagService handles tag CRUD and track-tag associations.
type TagService struct {
	queries      db.Querier
	galleryCache *cache.GalleryCache
}

func NewTagService(queries db.Querier, galleryCache *cache.GalleryCache) *TagService {
	return &TagService{queries: queries, galleryCache: galleryCache}
}

// --- Tag CRUD ---

func (s *TagService) Create(ctx context.Context, name string) (db.Tag, error) {
	if name == "" {
		return db.Tag{}, fmt.Errorf("tag name cannot be empty")
	}

	existing, err := s.queries.GetTagByName(ctx, name)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return db.Tag{}, fmt.Errorf("check existing tag: %w", err)
	}

	tag, err := s.queries.CreateTag(ctx, name)
	if err != nil {
		return db.Tag{}, fmt.Errorf("create tag: %w", err)
	}
	return tag, nil
}

func (s *TagService) Get(ctx context.Context, id uuid.UUID) (db.Tag, error) {
	tag, err := s.queries.GetTag(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.Tag{}, fmt.Errorf("tag not found: %s", id)
		}
		return db.Tag{}, fmt.Errorf("get tag: %w", err)
	}
	return tag, nil
}

func (s *TagService) List(ctx context.Context) ([]db.Tag, error) {
	tags, err := s.queries.ListTags(ctx)
	if err != nil {
		return nil, fmt.Errorf("list tags: %w", err)
	}
	if tags == nil {
		tags = []db.Tag{}
	}
	return tags, nil
}

// ListWithCounts returns tags ordered by track count (descending).
func (s *TagService) ListWithCounts(ctx context.Context) ([]db.ListTagsWithTrackCountRow, error) {
	rows, err := s.queries.ListTagsWithTrackCount(ctx)
	if err != nil {
		return nil, fmt.Errorf("list tags with counts: %w", err)
	}
	if rows == nil {
		rows = []db.ListTagsWithTrackCountRow{}
	}
	return rows, nil
}

func (s *TagService) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := s.queries.GetTag(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("tag not found: %s", id)
		}
		return fmt.Errorf("get tag for delete: %w", err)
	}
	if err := s.queries.DeleteTag(ctx, id); err != nil {
		return fmt.Errorf("delete tag: %w", err)
	}
	return nil
}

// --- Track-Tag Associations ---

func (s *TagService) AssignToTrack(ctx context.Context, trackID, tagID uuid.UUID) error {
	if err := s.queries.AssignTagToTrack(ctx, db.AssignTagToTrackParams{
		TrackID: trackID,
		TagID:   tagID,
	}); err != nil {
		return fmt.Errorf("assign tag to track: %w", err)
	}
	// Invalidate gallery cache for the track's owner
	s.invalidateCacheForTrack(ctx, trackID)
	return nil
}

func (s *TagService) RemoveFromTrack(ctx context.Context, trackID, tagID uuid.UUID) error {
	if err := s.queries.RemoveTagFromTrack(ctx, db.RemoveTagFromTrackParams{
		TrackID: trackID,
		TagID:   tagID,
	}); err != nil {
		return fmt.Errorf("remove tag from track: %w", err)
	}
	s.invalidateCacheForTrack(ctx, trackID)
	return nil
}

func (s *TagService) ListForTrack(ctx context.Context, trackID uuid.UUID) ([]db.Tag, error) {
	tags, err := s.queries.ListTagsForTrack(ctx, trackID)
	if err != nil {
		return nil, fmt.Errorf("list tags for track: %w", err)
	}
	if tags == nil {
		tags = []db.Tag{}
	}
	return tags, nil
}

// invalidateCacheForTrack looks up a track's owner and invalidates their gallery cache.
// Failures are non-fatal — stale cache is better than broken tag assignment.
func (s *TagService) invalidateCacheForTrack(ctx context.Context, trackID uuid.UUID) {
	track, err := s.queries.GetTrack(ctx, trackID)
	if err != nil {
		return
	}
	s.galleryCache.Invalidate(track.UserID)
}
