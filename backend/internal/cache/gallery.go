package cache

import (
	"sync"
	"time"

	"auvi/internal/domain"

	"github.com/google/uuid"
)

type entry struct {
	groups    []domain.TagGalleryGroup
	expiresAt time.Time
}

// GalleryCache is an in-memory per-user cache for gallery results.
// Expiry is checked lazily on Get — no background goroutine required.
type GalleryCache struct {
	mu  sync.Map
	ttl time.Duration
}

// NewGalleryCache creates a cache with the given TTL.
func NewGalleryCache(ttl time.Duration) *GalleryCache {
	return &GalleryCache{ttl: ttl}
}

// Get returns cached gallery groups for a user, or (nil, false) if absent or expired.
func (c *GalleryCache) Get(userID uuid.UUID) ([]domain.TagGalleryGroup, bool) {
	v, ok := c.mu.Load(userID)
	if !ok {
		return nil, false
	}
	e := v.(entry)
	if time.Now().After(e.expiresAt) {
		c.mu.Delete(userID)
		return nil, false
	}
	return e.groups, true
}

// Set stores gallery groups for a user with a TTL-based expiry.
func (c *GalleryCache) Set(userID uuid.UUID, groups []domain.TagGalleryGroup) {
	c.mu.Store(userID, entry{
		groups:    groups,
		expiresAt: time.Now().Add(c.ttl),
	})
}

// Invalidate removes the cached entry for a user immediately.
func (c *GalleryCache) Invalidate(userID uuid.UUID) {
	c.mu.Delete(userID)
}
