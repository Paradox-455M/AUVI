package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"

	"auvi/pkg/filehash"

	"github.com/google/uuid"
)

// LocalStorage implements the Storage interface using the local filesystem.
// Files are stored under BaseDir/<prefix>/<uuid>.<ext>.
type LocalStorage struct {
	BaseDir string // e.g. "./uploads"
}

// NewLocalStorage creates a LocalStorage backed by the given directory.
// It creates the directory if it doesn't already exist.
func NewLocalStorage(baseDir string) (*LocalStorage, error) {
	absDir, err := filepath.Abs(baseDir)
	if err != nil {
		return nil, fmt.Errorf("storage: resolve base dir: %w", err)
	}
	if err := os.MkdirAll(absDir, 0755); err != nil {
		return nil, fmt.Errorf("storage: create base dir: %w", err)
	}
	return &LocalStorage{BaseDir: absDir}, nil
}

// SaveFile reads from r, writes to a uniquely-named file, and returns metadata
// including the SHA-256 hash. The prefix is used as a subdirectory bucket
// (e.g., "tracks"). The original filename's extension is preserved.
func (ls *LocalStorage) SaveFile(ctx context.Context, prefix string, filename string, r io.Reader) (FileMetadata, error) {
	// Sanitize prefix to prevent traversal
	prefix = sanitizePath(prefix)

	dir := filepath.Join(ls.BaseDir, prefix)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return FileMetadata{}, fmt.Errorf("storage: create prefix dir: %w", err)
	}

	// Generate a stable, unique filename preserving the original extension
	ext := filepath.Ext(filename)
	stableFilename := uuid.New().String() + ext
	fullPath := filepath.Join(dir, stableFilename)

	// Write to a temp file first, then rename for atomicity
	tmpFile, err := os.CreateTemp(dir, "upload-*"+ext)
	if err != nil {
		return FileMetadata{}, fmt.Errorf("storage: create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()

	// Ensure cleanup on failure
	defer func() {
		if tmpFile != nil {
			tmpFile.Close()
			os.Remove(tmpPath)
		}
	}()

	// Tee the reader so we can hash while writing
	h := sha256.New()
	writer := io.MultiWriter(tmpFile, h)

	written, err := io.Copy(writer, r)
	if err != nil {
		return FileMetadata{}, fmt.Errorf("storage: write file: %w", err)
	}

	if err := tmpFile.Close(); err != nil {
		return FileMetadata{}, fmt.Errorf("storage: close temp file: %w", err)
	}
	tmpFile = nil // prevent deferred cleanup from double-closing

	// Rename to final path atomically
	if err := os.Rename(tmpPath, fullPath); err != nil {
		return FileMetadata{}, fmt.Errorf("storage: rename to final path: %w", err)
	}

	// Detect content type from extension
	contentType := mime.TypeByExtension(ext)
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// Relative path for storage reference (portable across environments)
	relPath := filepath.Join(prefix, stableFilename)

	return FileMetadata{
		Path:        relPath,
		SizeBytes:   written,
		ContentType: contentType,
		FileHash:    hex.EncodeToString(h.Sum(nil)),
	}, nil
}

// DeleteFile removes a file from storage via its relative path.
func (ls *LocalStorage) DeleteFile(ctx context.Context, path string) error {
	path = sanitizePath(path)
	fullPath := filepath.Join(ls.BaseDir, path)

	// Verify the file is within the base directory (prevent traversal)
	if !strings.HasPrefix(fullPath, ls.BaseDir) {
		return fmt.Errorf("storage: path traversal detected")
	}

	if err := os.Remove(fullPath); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("storage: file not found: %s", path)
		}
		return fmt.Errorf("storage: delete file: %w", err)
	}
	return nil
}

// GetFileMetadata retrieves info about a stored file without loading its contents.
func (ls *LocalStorage) GetFileMetadata(ctx context.Context, path string) (FileMetadata, error) {
	path = sanitizePath(path)
	fullPath := filepath.Join(ls.BaseDir, path)

	if !strings.HasPrefix(fullPath, ls.BaseDir) {
		return FileMetadata{}, fmt.Errorf("storage: path traversal detected")
	}

	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return FileMetadata{}, fmt.Errorf("storage: file not found: %s", path)
		}
		return FileMetadata{}, fmt.Errorf("storage: stat file: %w", err)
	}

	// Compute hash on-demand
	f, err := os.Open(fullPath)
	if err != nil {
		return FileMetadata{}, fmt.Errorf("storage: open file for hashing: %w", err)
	}
	defer f.Close()

	hash, err := filehash.Compute(f)
	if err != nil {
		return FileMetadata{}, fmt.Errorf("storage: compute hash: %w", err)
	}

	ext := filepath.Ext(fullPath)
	contentType := mime.TypeByExtension(ext)
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	return FileMetadata{
		Path:        path,
		SizeBytes:   info.Size(),
		ContentType: contentType,
		FileHash:    hash,
	}, nil
}

// OpenFile opens a stored file for reading with seek support.
// Prevents path traversal. Returns the file, its size, and any error.
func (ls *LocalStorage) OpenFile(ctx context.Context, path string) (io.ReadSeekCloser, int64, error) {
	path = sanitizePath(path)
	fullPath := filepath.Join(ls.BaseDir, path)

	if !strings.HasPrefix(fullPath, ls.BaseDir) {
		return nil, 0, fmt.Errorf("storage: path traversal detected")
	}

	f, err := os.Open(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, 0, fmt.Errorf("storage: file not found: %s", path)
		}
		return nil, 0, fmt.Errorf("storage: open file: %w", err)
	}

	info, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, 0, fmt.Errorf("storage: stat file: %w", err)
	}

	return f, info.Size(), nil
}

// sanitizePath cleans a path and prevents directory traversal.
func sanitizePath(p string) string {
	p = filepath.Clean(p)
	// Remove any leading slashes or dots that could escape the base dir
	p = strings.TrimLeft(p, "/.")
	return p
}
