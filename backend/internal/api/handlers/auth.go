package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"auvi/internal/api/response"
	"auvi/internal/auth"
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	authService *auth.Service
}

func NewAuthHandler(as *auth.Service) *AuthHandler {
	return &AuthHandler{authService: as}
}

// Register handles POST /api/v1/auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"displayName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_BODY", "Expected JSON body")
		return
	}
	if strings.TrimSpace(body.Email) == "" || body.Password == "" {
		response.Err(w, http.StatusBadRequest, "VALIDATION_FAILED", "email and password are required")
		return
	}
	if len(body.Password) < 8 {
		response.Err(w, http.StatusBadRequest, "VALIDATION_FAILED", "password must be at least 8 characters")
		return
	}

	user, err := h.authService.Register(r.Context(), strings.ToLower(strings.TrimSpace(body.Email)), body.Password, body.DisplayName)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			response.Err(w, http.StatusConflict, "EMAIL_TAKEN", "An account with this email already exists")
			return
		}
		response.Err(w, http.StatusInternalServerError, "REGISTER_FAILED", "Failed to create account")
		return
	}

	response.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":          user.ID,
		"email":       user.Email,
		"displayName": user.DisplayName,
	})
}

// Login handles POST /api/v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Err(w, http.StatusBadRequest, "INVALID_BODY", "Expected JSON body")
		return
	}

	pair, err := h.authService.Login(r.Context(), strings.ToLower(strings.TrimSpace(body.Email)), body.Password)
	if err != nil {
		if strings.Contains(err.Error(), "invalid credentials") {
			response.Err(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid email or password")
			return
		}
		response.Err(w, http.StatusInternalServerError, "LOGIN_FAILED", "Login failed")
		return
	}

	response.JSON(w, http.StatusOK, pair)
}

// Refresh handles POST /api/v1/auth/refresh
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.RefreshToken == "" {
		response.Err(w, http.StatusBadRequest, "INVALID_BODY", "refreshToken is required")
		return
	}

	pair, err := h.authService.Refresh(r.Context(), body.RefreshToken)
	if err != nil {
		response.Err(w, http.StatusUnauthorized, "INVALID_TOKEN", "Invalid or expired refresh token")
		return
	}

	response.JSON(w, http.StatusOK, pair)
}

// Logout handles POST /api/v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.RefreshToken == "" {
		response.Err(w, http.StatusBadRequest, "INVALID_BODY", "refreshToken is required")
		return
	}

	_ = h.authService.Logout(r.Context(), body.RefreshToken)
	response.JSON(w, http.StatusOK, map[string]string{"message": "Logged out"})
}
