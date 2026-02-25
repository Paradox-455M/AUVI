package handlers

import (
	"net/http"

	"auvi/internal/api/middleware"
	"auvi/internal/api/response"
	"auvi/internal/services"
)

// GalleryHandler handles HTTP requests for /api/v1/gallery.
type GalleryHandler struct {
	galleryService *services.GalleryService
}

func NewGalleryHandler(gs *services.GalleryService) *GalleryHandler {
	return &GalleryHandler{galleryService: gs}
}

// Get handles GET /api/v1/gallery.
func (h *GalleryHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		response.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	gallery, err := h.galleryService.GetGallery(r.Context(), userID)
	if err != nil {
		response.Err(w, http.StatusInternalServerError, "GALLERY_FAILED", "Failed to build gallery")
		return
	}
	response.JSON(w, http.StatusOK, gallery)
}
