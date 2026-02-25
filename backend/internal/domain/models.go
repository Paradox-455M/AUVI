package domain

import (
	"time"

	"github.com/google/uuid"
)

// Artist represents a music creator/producer.
type Artist struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

// Track is the domain representation of an audio track.
type Track struct {
	ID            uuid.UUID  `json:"id"`
	UserID        uuid.UUID  `json:"userId"`
	Title         string     `json:"title"`
	ArtistID      *uuid.UUID `json:"artistId,omitempty"`
	AudioFilePath string     `json:"audioFilePath"`
	DurationMs    int32      `json:"durationMs"`
	FileHash      string     `json:"fileHash"`
	Mood          *string    `json:"mood,omitempty"`
	BPM           *float64   `json:"bpm,omitempty"`
	Energy        *float64   `json:"energy,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

// Tag is a user-defined label for categorizing tracks.
type Tag struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

// TrackTag maps a many-to-many relationship combining Tracks and Tags.
type TrackTag struct {
	TrackID   uuid.UUID `json:"trackId"`
	TagID     uuid.UUID `json:"tagId"`
	CreatedAt time.Time `json:"createdAt"`
}

// UploadSessionStatus enumerates the states an upload session can be in.
type UploadSessionStatus string

const (
	UploadSessionPending    UploadSessionStatus = "pending"
	UploadSessionProcessing UploadSessionStatus = "processing"
	UploadSessionCompleted  UploadSessionStatus = "completed"
	UploadSessionFailed     UploadSessionStatus = "failed"
)

// UploadSession tracks the lifecycle of an audio ingest.
type UploadSession struct {
	ID        uuid.UUID           `json:"id"`
	Status    UploadSessionStatus `json:"status"`
	TrackID   *uuid.UUID          `json:"trackId,omitempty"`
	CreatedAt time.Time           `json:"createdAt"`
	UpdatedAt time.Time           `json:"updatedAt"`
}

// PlaybackEvent tracks a single playback for analytics/visualizer usage.
type PlaybackEvent struct {
	ID            uuid.UUID `json:"id"`
	TrackID       uuid.UUID `json:"trackId"`
	UserSessionID string    `json:"userSessionId,omitempty"` // Anonymous session tracking
	PlayedAt      time.Time `json:"playedAt"`
}

// TrackWithTags is a rich domain model used for the Gallery representation.
type TrackWithTags struct {
	Track
	Tags []Tag `json:"tags"`
}

// TagGalleryGroup groups tracks by their tag for the gallery view.
type TagGalleryGroup struct {
	TagID   uuid.UUID      `json:"tagId"`
	TagName string         `json:"tagName"`
	Tracks  []TrackWithTags `json:"tracks"`
}

// Preset represents a MilkDrop visualizer preset.
type Preset struct {
	ID        uuid.UUID  `json:"id"`
	Name      string     `json:"name"`
	Data      string     `json:"data,omitempty"`
	Mood      *string    `json:"mood,omitempty"`
	AuthorID  *uuid.UUID `json:"authorId,omitempty"`
	IsBuiltin bool       `json:"isBuiltin"`
	CreatedAt time.Time  `json:"createdAt"`
}
