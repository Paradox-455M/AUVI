package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"auvi/internal/api/middleware"
	"auvi/internal/api/response"
	"auvi/internal/services"

	"github.com/google/uuid"
)

// TrackHandler handles HTTP requests for /api/v1/tracks.
type TrackHandler struct {
	trackService *services.TrackService
	tagService   *services.TagService
}

func NewTrackHandler(ts *services.TrackService, tags *services.TagService) *TrackHandler {
	return &TrackHandler{
		trackService: ts,
		tagService:   tags,
	}
}

// Create handles POST /api/v1/tracks (multipart/form-data).
func (h *TrackHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		response.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 100<<20)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		if err.Error() == "http: request body too large" {
			response.Err(w, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "File exceeds 100MB limit")
			return
		}
		response.Err(w, http.StatusBadRequest, "INVALID_REQUEST", "Expected multipart/form-data")
		return
	}
	defer r.MultipartForm.RemoveAll()

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Err(w, http.StatusBadRequest, "MISSING_FILE", "Audio file is required (field: file)")
		return
	}
	defer file.Close()

	var tagIDs []uuid.UUID
	if tagsStr := r.FormValue("tags"); tagsStr != "" {
		for _, idStr := range strings.Split(tagsStr, ",") {
			id, err := uuid.Parse(strings.TrimSpace(idStr))
			if err != nil {
				response.Err(w, http.StatusBadRequest, "INVALID_TAG_ID", "Invalid tag ID: "+idStr)
				return
			}
			tagIDs = append(tagIDs, id)
		}
	}

	track, err := h.trackService.Create(r.Context(), services.CreateInput{
		UserID:   userID,
		Filename: header.Filename,
		FileData: file,
		FileSize: header.Size,
		Title:    r.FormValue("title"),
		Artist:   r.FormValue("artist"),
		TagIDs:   tagIDs,
	})
	if err != nil {
		if strings.Contains(err.Error(), "unsupported audio format") {
			response.Err(w, http.StatusBadRequest, "INVALID_FORMAT", err.Error())
			return
		}
		response.Err(w, http.StatusInternalServerError, "UPLOAD_FAILED", "Failed to process upload")
		return
	}

	tags, _ := h.tagService.ListForTrack(r.Context(), track.ID)
	response.JSON(w, http.StatusCreated, map[string]interface{}{
		"track": track,
		"tags":  tags,
	})
}

// List handles GET /api/v1/tracks (paginated).
func (h *TrackHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		response.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	limit := int32(50)
	offset := int32(0)
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {
			limit = int32(n)
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = int32(n)
		}
	}

	tracks, total, err := h.trackService.ListByUser(r.Context(), userID, limit, offset)
	if err != nil {
		response.Err(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list tracks")
		return
	}

	response.JSONWithMeta(w, http.StatusOK, tracks, map[string]interface{}{
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// Get handles GET /api/v1/tracks/{id}.
func (h *TrackHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		response.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_ID", "Invalid track ID format")
		return
	}

	track, err := h.trackService.Get(r.Context(), id, userID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.Err(w, http.StatusNotFound, "NOT_FOUND", "Track not found")
			return
		}
		response.Err(w, http.StatusInternalServerError, "GET_FAILED", "Failed to get track")
		return
	}

	response.JSON(w, http.StatusOK, track)
}

// Delete handles DELETE /api/v1/tracks/{id}.
func (h *TrackHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		response.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_ID", "Invalid track ID format")
		return
	}

	if err := h.trackService.Delete(r.Context(), id, userID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.Err(w, http.StatusNotFound, "NOT_FOUND", "Track not found")
			return
		}
		response.Err(w, http.StatusInternalServerError, "DELETE_FAILED", "Failed to delete track")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "Track deleted"})
}

// AssignTag handles POST /api/v1/tracks/{id}/tags.
func (h *TrackHandler) AssignTag(w http.ResponseWriter, r *http.Request) {
	trackID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_ID", "Invalid track ID format")
		return
	}

	var body struct {
		TagID string `json:"tagId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_BODY", "Expected JSON body with tagId")
		return
	}

	tagID, err := uuid.Parse(body.TagID)
	if err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_TAG_ID", "Invalid tag ID format")
		return
	}

	if err := h.tagService.AssignToTrack(r.Context(), trackID, tagID); err != nil {
		response.Err(w, http.StatusInternalServerError, "ASSIGN_FAILED", "Failed to assign tag")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "Tag assigned"})
}

// PatchMood handles PATCH /api/v1/tracks/{id}/mood.
func (h *TrackHandler) PatchMood(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		response.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_ID", "Invalid track ID format")
		return
	}

	var body struct {
		Mood   string   `json:"mood"`
		BPM    *float64 `json:"bpm"`
		Energy *float64 `json:"energy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_BODY", "Expected JSON body")
		return
	}

	if !services.ValidMoods[body.Mood] {
		response.Err(w, http.StatusBadRequest, "INVALID_MOOD",
			"mood must be one of: calm, melancholic, focused, uplifting, energetic, intense")
		return
	}

	track, err := h.trackService.UpdateMood(r.Context(), id, userID, services.MoodInput{
		Mood:   body.Mood,
		BPM:    body.BPM,
		Energy: body.Energy,
	})
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.Err(w, http.StatusNotFound, "NOT_FOUND", "Track not found")
			return
		}
		response.Err(w, http.StatusInternalServerError, "UPDATE_FAILED", "Failed to update mood")
		return
	}

	response.JSON(w, http.StatusOK, track)
}

// Stream handles GET /api/v1/tracks/{id}/stream.
// Uses http.ServeContent for Range request support (seek, 206 Partial Content).
func (h *TrackHandler) Stream(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		response.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_ID", "Invalid track ID format")
		return
	}

	f, _, title, err := h.trackService.OpenFile(r.Context(), id, userID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.Err(w, http.StatusNotFound, "NOT_FOUND", "Track not found")
			return
		}
		response.Err(w, http.StatusInternalServerError, "STREAM_FAILED", "Failed to open audio file")
		return
	}
	defer f.Close()

	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "private, max-age=3600")

	// http.ServeContent handles Range, 206, If-Range, Content-Length, HEAD automatically.
	http.ServeContent(w, r, title, time.Time{}, f)
}

