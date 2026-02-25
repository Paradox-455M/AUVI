package analytics

import (
	"context"
	"database/sql"
	"log"
	"sync"
	"time"

	db "auvi/internal/repository/database"

	"github.com/google/uuid"
)

// PlaybackEvent represents a single play-start event.
type PlaybackEvent struct {
	TrackID   uuid.UUID
	UserID    uuid.NullUUID
	SessionID string
}

// EventBatcher buffers playback events and flushes them in bulk on a timer.
// Individual Record calls are non-blocking; events are dropped if the buffer is full.
type EventBatcher struct {
	ch       chan PlaybackEvent
	queries  db.Querier
	interval time.Duration
	mu       sync.Mutex
	buf      []PlaybackEvent
}

// NewEventBatcher creates a batcher with a channel buffer size and flush interval.
func NewEventBatcher(queries db.Querier, bufSize int, interval time.Duration) *EventBatcher {
	return &EventBatcher{
		ch:       make(chan PlaybackEvent, bufSize),
		queries:  queries,
		interval: interval,
	}
}

// Record enqueues an event. Drops silently if the buffer is full (non-blocking).
func (b *EventBatcher) Record(e PlaybackEvent) {
	select {
	case b.ch <- e:
	default:
		// buffer full — drop event to avoid blocking callers
	}
}

// Start runs the background flush goroutine until ctx is cancelled.
func (b *EventBatcher) Start(ctx context.Context) {
	ticker := time.NewTicker(b.interval)
	defer ticker.Stop()
	for {
		select {
		case e := <-b.ch:
			b.mu.Lock()
			b.buf = append(b.buf, e)
			b.mu.Unlock()
		case <-ticker.C:
			b.flush(ctx)
		case <-ctx.Done():
			return
		}
	}
}

// Flush drains the buffer immediately; call during graceful shutdown.
func (b *EventBatcher) Flush(ctx context.Context) {
	// drain channel into buffer first
	for {
		select {
		case e := <-b.ch:
			b.mu.Lock()
			b.buf = append(b.buf, e)
			b.mu.Unlock()
		default:
			goto done
		}
	}
done:
	b.flush(ctx)
}

func (b *EventBatcher) flush(ctx context.Context) {
	b.mu.Lock()
	if len(b.buf) == 0 {
		b.mu.Unlock()
		return
	}
	batch := b.buf
	b.buf = nil
	b.mu.Unlock()

	for _, e := range batch {
		_, err := b.queries.CreatePlaybackEvent(ctx, db.CreatePlaybackEventParams{
			TrackID: uuid.NullUUID{UUID: e.TrackID, Valid: true},
			UserSessionID: sql.NullString{
				String: e.SessionID,
				Valid:  e.SessionID != "",
			},
		})
		if err != nil {
			log.Printf("analytics: flush event: %v", err)
		}
	}
}
