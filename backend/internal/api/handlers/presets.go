package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"auvi/internal/api/middleware"
	"auvi/internal/api/response"
	"auvi/internal/services"

	"github.com/google/uuid"
)

// PresetHandler handles HTTP requests for /api/v1/presets.
type PresetHandler struct {
	presetService *services.PresetService
}

func NewPresetHandler(ps *services.PresetService) *PresetHandler {
	return &PresetHandler{presetService: ps}
}

// List handles GET /api/v1/presets (public)
// Query params: ?mood=, ?limit=, ?offset=
func (h *PresetHandler) List(w http.ResponseWriter, r *http.Request) {
	mood := r.URL.Query().Get("mood")
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

	presets, err := h.presetService.List(r.Context(), mood, limit, offset)
	if err != nil {
		if strings.Contains(err.Error(), "invalid mood") {
			response.Err(w, http.StatusBadRequest, "INVALID_MOOD",
				"mood must be one of: calm, melancholic, focused, uplifting, energetic, intense")
			return
		}
		response.Err(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list presets")
		return
	}

	response.JSON(w, http.StatusOK, presets)
}

// GetOne handles GET /api/v1/presets/{id} (public)
func (h *PresetHandler) GetOne(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_ID", "Invalid preset ID format")
		return
	}

	preset, err := h.presetService.Get(r.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.Err(w, http.StatusNotFound, "NOT_FOUND", "Preset not found")
			return
		}
		response.Err(w, http.StatusInternalServerError, "GET_FAILED", "Failed to get preset")
		return
	}

	response.JSON(w, http.StatusOK, preset)
}

// Create handles POST /api/v1/presets (authenticated)
func (h *PresetHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		response.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	var body struct {
		Name string `json:"name"`
		Data string `json:"data"`
		Mood string `json:"mood"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_BODY", "Expected JSON body")
		return
	}
	if strings.TrimSpace(body.Name) == "" || strings.TrimSpace(body.Data) == "" {
		response.Err(w, http.StatusBadRequest, "VALIDATION_FAILED", "name and data are required")
		return
	}

	preset, err := h.presetService.Create(r.Context(), body.Name, body.Data, body.Mood, userID)
	if err != nil {
		if strings.Contains(err.Error(), "invalid mood") {
			response.Err(w, http.StatusBadRequest, "INVALID_MOOD", err.Error())
			return
		}
		response.Err(w, http.StatusInternalServerError, "CREATE_FAILED", "Failed to create preset")
		return
	}

	response.JSON(w, http.StatusCreated, preset)
}

// Delete handles DELETE /api/v1/presets/{id} (authenticated, owner only)
func (h *PresetHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		response.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_ID", "Invalid preset ID format")
		return
	}

	if err := h.presetService.Delete(r.Context(), id, userID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.Err(w, http.StatusNotFound, "NOT_FOUND", "Preset not found")
			return
		}
		response.Err(w, http.StatusInternalServerError, "DELETE_FAILED", "Failed to delete preset")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "Preset deleted"})
}

// ToggleFavorite handles POST /api/v1/presets/{id}/favorite (authenticated)
func (h *PresetHandler) ToggleFavorite(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		response.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_ID", "Invalid preset ID format")
		return
	}

	added, err := h.presetService.ToggleFavorite(r.Context(), userID, id)
	if err != nil {
		response.Err(w, http.StatusInternalServerError, "FAVORITE_FAILED", "Failed to toggle favorite")
		return
	}

	response.JSON(w, http.StatusOK, map[string]bool{"added": added})
}

// ListFavorites handles GET /api/v1/users/me/favorites (authenticated)
func (h *PresetHandler) ListFavorites(w http.ResponseWriter, r *http.Request) {
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

	presets, err := h.presetService.ListUserFavorites(r.Context(), userID, limit, offset)
	if err != nil {
		response.Err(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list favorites")
		return
	}

	response.JSON(w, http.StatusOK, presets)
}
