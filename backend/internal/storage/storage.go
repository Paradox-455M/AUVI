package storage

import (
	"context"
	"io"
)

// FileMetadata contains information about a file stored in the system.
type FileMetadata struct {
	Path        string // The relative identifier or absolute path
	SizeBytes   int64
	ContentType string
	FileHash    string // SHA-256 hash to prevent duplicate uploads
}

// Storage defines the abstraction boundary for file operations.
// This interface allows seamless migration from LocalStorage to S3Storage.
type Storage interface {
	// SaveFile reads from an io.Reader and persists the file.
	// The prefix can be used to bucket files (e.g., "tracks", "images").
	SaveFile(ctx context.Context, prefix string, filename string, r io.Reader) (FileMetadata, error)

	// DeleteFile removes a file from storage via its stable identifier.
	DeleteFile(ctx context.Context, path string) error

	// GetFileMetadata retrieves information about a stored file without loading its contents.
	GetFileMetadata(ctx context.Context, path string) (FileMetadata, error)

	// OpenFile opens a stored file for reading and seeking.
	// Returns an io.ReadSeekCloser, the file size in bytes, and any error.
	// The path is the same relative identifier returned by SaveFile.
	OpenFile(ctx context.Context, path string) (io.ReadSeekCloser, int64, error)
}
