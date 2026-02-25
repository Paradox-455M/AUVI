package audiometa

import (
	"encoding/binary"
	"fmt"
	"io"
	"path/filepath"
	"strings"
)

// Metadata holds extracted information from an audio file.
type Metadata struct {
	Title      string
	Artist     string
	DurationMs int
	Format     string // "mp3", "wav", "flac", "ogg", "aac", "m4a"
}

// AllowedFormats is the set of audio extensions the system accepts.
var AllowedFormats = map[string]bool{
	".mp3":  true,
	".wav":  true,
	".flac": true,
	".ogg":  true,
	".aac":  true,
	".m4a":  true,
}

// IsAllowedFormat checks if a filename has a supported audio extension.
func IsAllowedFormat(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	return AllowedFormats[ext]
}

// ExtractFromFilename parses title and artist from a filename.
// Supports formats: "Artist - Title.mp3", "Artist-Title.mp3", "Title.mp3"
func ExtractFromFilename(filename string) (title, artist string) {
	// Remove extension
	name := strings.TrimSuffix(filename, filepath.Ext(filename))

	// Try "Artist - Title" first
	if parts := strings.SplitN(name, " - ", 2); len(parts) == 2 {
		return strings.TrimSpace(parts[1]), strings.TrimSpace(parts[0])
	}

	// Try "Artist-Title"
	if parts := strings.SplitN(name, "-", 2); len(parts) == 2 {
		return strings.TrimSpace(parts[1]), strings.TrimSpace(parts[0])
	}

	// Fallback: entire filename is the title
	return strings.TrimSpace(name), ""
}

// EstimateWAVDuration calculates duration from a WAV file's header.
// WAV is uncompressed so duration = data_size / (sample_rate * channels * bits_per_sample / 8).
func EstimateWAVDuration(r io.ReadSeeker) (int, error) {
	// Read the RIFF header
	var riffHeader [12]byte
	if _, err := io.ReadFull(r, riffHeader[:]); err != nil {
		return 0, fmt.Errorf("read RIFF header: %w", err)
	}

	if string(riffHeader[0:4]) != "RIFF" || string(riffHeader[8:12]) != "WAVE" {
		return 0, fmt.Errorf("not a valid WAV file")
	}

	// Search for the "fmt " chunk
	var sampleRate uint32
	var numChannels uint16
	var bitsPerSample uint16
	var dataSize uint32

	for {
		var chunkID [4]byte
		var chunkSize uint32

		if _, err := io.ReadFull(r, chunkID[:]); err != nil {
			break
		}
		if err := binary.Read(r, binary.LittleEndian, &chunkSize); err != nil {
			break
		}

		switch string(chunkID[:]) {
		case "fmt ":
			var audioFormat uint16
			binary.Read(r, binary.LittleEndian, &audioFormat)
			binary.Read(r, binary.LittleEndian, &numChannels)
			binary.Read(r, binary.LittleEndian, &sampleRate)

			// Skip byte rate (4 bytes) and block align (2 bytes)
			r.Seek(6, io.SeekCurrent)
			binary.Read(r, binary.LittleEndian, &bitsPerSample)

			// Skip remaining fmt chunk data
			remaining := int64(chunkSize) - 16
			if remaining > 0 {
				r.Seek(remaining, io.SeekCurrent)
			}

		case "data":
			dataSize = chunkSize
			// Found what we need, stop
			goto calculate

		default:
			// Skip unknown chunk
			r.Seek(int64(chunkSize), io.SeekCurrent)
		}
	}

calculate:
	if sampleRate == 0 || numChannels == 0 || bitsPerSample == 0 {
		return 0, fmt.Errorf("incomplete WAV header")
	}

	bytesPerSample := uint32(numChannels) * uint32(bitsPerSample) / 8
	if bytesPerSample == 0 {
		return 0, fmt.Errorf("invalid WAV parameters")
	}

	totalSamples := dataSize / bytesPerSample
	durationMs := int(totalSamples * 1000 / sampleRate)
	return durationMs, nil
}

// EstimateDurationFromSize provides a rough duration estimate for compressed
// formats based on file size and an assumed bitrate.
// This is a fallback when proper parsing isn't available.
func EstimateDurationFromSize(sizeBytes int64, format string) int {
	var bitrateKbps int
	switch strings.ToLower(format) {
	case ".mp3":
		bitrateKbps = 192 // Common MP3 bitrate
	case ".aac", ".m4a":
		bitrateKbps = 128
	case ".ogg":
		bitrateKbps = 160
	case ".flac":
		bitrateKbps = 800 // FLAC is ~5:1 compression
	default:
		bitrateKbps = 192
	}

	bytesPerSecond := bitrateKbps * 1000 / 8
	if bytesPerSecond == 0 {
		return 0
	}
	durationMs := int(sizeBytes * 1000 / int64(bytesPerSecond))
	return durationMs
}
