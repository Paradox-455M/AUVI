package filehash

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
)

// Compute reads from r and returns the hex-encoded SHA-256 hash.
// The caller is responsible for rewinding or teeing the reader if the
// data is needed again after hashing.
func Compute(r io.Reader) (string, error) {
	h := sha256.New()
	if _, err := io.Copy(h, r); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
