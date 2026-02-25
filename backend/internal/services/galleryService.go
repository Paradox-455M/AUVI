package services

import (
	"context"
	"fmt"

	"auvi/internal/cache"
	"auvi/internal/domain"
	db "auvi/internal/repository/database"

	"github.com/google/uuid"
)

// GalleryService builds the tag-driven gallery view.
// Results are cached per-user with a 60-second TTL and invalidated on mutation.
type GalleryService struct {
	queries      db.Querier
	galleryCache *cache.GalleryCache
}

func NewGalleryService(queries db.Querier, galleryCache *cache.GalleryCache) *GalleryService {
	return &GalleryService{queries: queries, galleryCache: galleryCache}
}

// GetGallery returns the user's tag-grouped gallery. Served from cache when available.
func (s *GalleryService) GetGallery(ctx context.Context, userID uuid.UUID) ([]domain.TagGalleryGroup, error) {
	if groups, ok := s.galleryCache.Get(userID); ok {
		return groups, nil
	}

	rows, err := s.queries.GetGalleryTracksByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get gallery tracks: %w", err)
	}

	groups := buildGalleryGroupsForUser(rows)
	s.galleryCache.Set(userID, groups)
	return groups, nil
}

// buildGalleryGroupsForUser transforms flat user-scoped query rows into nested gallery groups.
func buildGalleryGroupsForUser(rows []db.GetGalleryTracksByUserRow) []domain.TagGalleryGroup {
	if len(rows) == 0 {
		return []domain.TagGalleryGroup{}
	}

	var groups []domain.TagGalleryGroup
	var currentGroup *domain.TagGalleryGroup
	trackSeen := make(map[uuid.UUID]bool)

	for _, row := range rows {
		if currentGroup == nil || currentGroup.TagID != row.TagID {
			if currentGroup != nil {
				groups = append(groups, *currentGroup)
			}
			currentGroup = &domain.TagGalleryGroup{
				TagID:   row.TagID,
				TagName: row.TagName,
				Tracks:  []domain.TrackWithTags{},
			}
			trackSeen = make(map[uuid.UUID]bool)
		}

		if !trackSeen[row.TrackID] {
			trackSeen[row.TrackID] = true

			t := domain.Track{
				ID:            row.TrackID,
				Title:         row.Title,
				AudioFilePath: row.AudioFilePath,
				DurationMs:    row.DurationMs,
				FileHash:      row.FileHash,
				CreatedAt:     row.TrackCreatedAt.Time,
				UpdatedAt:     row.TrackUpdatedAt.Time,
			}
			if row.ArtistID.Valid {
				t.ArtistID = &row.ArtistID.UUID
			}
			if row.Mood.Valid {
				t.Mood = &row.Mood.String
			}

			currentGroup.Tracks = append(currentGroup.Tracks, domain.TrackWithTags{
				Track: t,
				Tags:  []domain.Tag{},
			})
		}
	}

	if currentGroup != nil {
		groups = append(groups, *currentGroup)
	}

	return groups
}
