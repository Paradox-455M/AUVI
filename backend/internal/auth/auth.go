package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	db "auvi/internal/repository/database"
	"auvi/pkg/token"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// TokenPair holds both tokens returned on login/refresh.
type TokenPair struct {
	AccessToken  string    `json:"accessToken"`
	RefreshToken string    `json:"refreshToken"`
	ExpiresAt    time.Time `json:"expiresAt"`
}

// Service handles user registration, login, token refresh, and logout.
type Service struct {
	queries    db.Querier
	tokenMgr   *token.Manager
	refreshTTL time.Duration
}

// NewService creates an auth service.
func NewService(queries db.Querier, tokenMgr *token.Manager, refreshTTL time.Duration) *Service {
	return &Service{queries: queries, tokenMgr: tokenMgr, refreshTTL: refreshTTL}
}

// Register creates a new user account. Returns the created user.
func (s *Service) Register(ctx context.Context, email, password, displayName string) (db.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return db.User{}, fmt.Errorf("auth: hash password: %w", err)
	}
	user, err := s.queries.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: string(hash),
		DisplayName:  displayName,
	})
	if err != nil {
		return db.User{}, fmt.Errorf("auth: create user: %w", err)
	}
	return user, nil
}

// Login verifies credentials and returns a TokenPair on success.
func (s *Service) Login(ctx context.Context, email, password string) (TokenPair, error) {
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TokenPair{}, fmt.Errorf("auth: invalid credentials")
		}
		return TokenPair{}, fmt.Errorf("auth: get user: %w", err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return TokenPair{}, fmt.Errorf("auth: invalid credentials")
	}
	return s.issuePair(ctx, user.ID, user.Email)
}

// Refresh rotates the refresh token and issues a new access token.
func (s *Service) Refresh(ctx context.Context, opaqueToken string) (TokenPair, error) {
	hash := hashToken(opaqueToken)
	rt, err := s.queries.GetRefreshTokenByHash(ctx, hash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TokenPair{}, fmt.Errorf("auth: invalid or expired refresh token")
		}
		return TokenPair{}, fmt.Errorf("auth: get refresh token: %w", err)
	}
	// Rotate immediately — revoke old token before issuing a new one.
	if err := s.queries.RevokeRefreshToken(ctx, hash); err != nil {
		return TokenPair{}, fmt.Errorf("auth: revoke old token: %w", err)
	}
	user, err := s.queries.GetUserByID(ctx, rt.UserID)
	if err != nil {
		return TokenPair{}, fmt.Errorf("auth: get user: %w", err)
	}
	return s.issuePair(ctx, user.ID, user.Email)
}

// Logout revokes the given refresh token.
func (s *Service) Logout(ctx context.Context, opaqueToken string) error {
	hash := hashToken(opaqueToken)
	if err := s.queries.RevokeRefreshToken(ctx, hash); err != nil {
		return fmt.Errorf("auth: revoke token: %w", err)
	}
	return nil
}

// issuePair issues a new access + refresh token pair for a user.
func (s *Service) issuePair(ctx context.Context, userID uuid.UUID, email string) (TokenPair, error) {
	accessToken, expiresAt, err := s.tokenMgr.Issue(userID, email)
	if err != nil {
		return TokenPair{}, fmt.Errorf("auth: issue access token: %w", err)
	}
	opaque, err := generateOpaqueToken()
	if err != nil {
		return TokenPair{}, fmt.Errorf("auth: generate refresh token: %w", err)
	}
	_, err = s.queries.CreateRefreshToken(ctx, db.CreateRefreshTokenParams{
		UserID:    userID,
		TokenHash: hashToken(opaque),
		ExpiresAt: time.Now().Add(s.refreshTTL),
	})
	if err != nil {
		return TokenPair{}, fmt.Errorf("auth: store refresh token: %w", err)
	}
	return TokenPair{
		AccessToken:  accessToken,
		RefreshToken: opaque,
		ExpiresAt:    expiresAt,
	}, nil
}

// generateOpaqueToken creates a cryptographically random 32-byte token as hex.
func generateOpaqueToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// hashToken computes the SHA-256 hex digest of an opaque token string.
func hashToken(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}
