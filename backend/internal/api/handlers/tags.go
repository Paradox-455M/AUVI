package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"auvi/internal/api/response"
	"auvi/internal/services"

	"github.com/google/uuid"
)

// TagHandler handles HTTP requests for /api/v1/tags.
type TagHandler struct {
	tagService *services.TagService
}

func NewTagHandler(ts *services.TagService) *TagHandler {
	return &TagHandler{tagService: ts}
}

// Create handles POST /api/v1/tags.
func (h *TagHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_BODY", "Expected JSON body with name")
		return
	}

	if strings.TrimSpace(body.Name) == "" {
		response.Err(w, http.StatusBadRequest, "VALIDATION_FAILED", "Tag name cannot be empty")
		return
	}

	tag, err := h.tagService.Create(r.Context(), strings.TrimSpace(body.Name))
	if err != nil {
		response.Err(w, http.StatusInternalServerError, "CREATE_FAILED", "Failed to create tag")
		return
	}

	response.JSON(w, http.StatusCreated, tag)
}

// List handles GET /api/v1/tags.
func (h *TagHandler) List(w http.ResponseWriter, r *http.Request) {
	tags, err := h.tagService.ListWithCounts(r.Context())
	if err != nil {
		response.Err(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list tags")
		return
	}
	response.JSON(w, http.StatusOK, tags)
}

// Delete handles DELETE /api/v1/tags/{id}.
func (h *TagHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_ID", "Invalid tag ID format")
		return
	}

	if err := h.tagService.Delete(r.Context(), id); err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.Err(w, http.StatusNotFound, "NOT_FOUND", "Tag not found")
			return
		}
		response.Err(w, http.StatusInternalServerError, "DELETE_FAILED", "Failed to delete tag")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "Tag deleted"})
}
