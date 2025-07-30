package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"retro-games-backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// SessionService handles session operations
type SessionService struct {
	db    *pgxpool.Pool
	redis *redis.Client
}

// NewSessionService creates a new session service
func NewSessionService(db *pgxpool.Pool, redis *redis.Client) *SessionService {
	return &SessionService{
		db:    db,
		redis: redis,
	}
}

// CreateSession creates a new anonymous session
func (s *SessionService) CreateSession(ctx context.Context, ipAddress, userAgent string) (*models.SessionResponse, error) {
	// Generate secure session token
	token, err := generateSessionToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate session token: %w", err)
	}

	// Insert session into database
	query := `
		INSERT INTO sessions (session_token, ip_address, user_agent)
		VALUES ($1, $2, $3)
		RETURNING id, created_at
	`

	var sessionID uuid.UUID
	var createdAt time.Time

	err = s.db.QueryRow(ctx, query, token, ipAddress, userAgent).Scan(&sessionID, &createdAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Cache session in Redis (1 hour TTL)
	cacheKey := fmt.Sprintf("session:%s", token)
	sessionData := fmt.Sprintf("%s:%s", sessionID.String(), createdAt.Format(time.RFC3339))
	
	err = s.redis.Set(ctx, cacheKey, sessionData, time.Hour).Err()
	if err != nil {
		// Log error but don't fail the request
		fmt.Printf("Failed to cache session: %v\n", err)
	}

	return &models.SessionResponse{
		SessionToken: token,
		ExpiresAt:    createdAt.Add(24 * time.Hour), // 24 hour expiry
	}, nil
}

// ValidateSession validates a session token and returns session ID
func (s *SessionService) ValidateSession(ctx context.Context, token string) (uuid.UUID, error) {
	// Try Redis cache first
	cacheKey := fmt.Sprintf("session:%s", token)
	cached, err := s.redis.Get(ctx, cacheKey).Result()
	
	if err == nil {
		// Parse cached session data
		var sessionID uuid.UUID
		var createdAt time.Time
		
		_, parseErr := fmt.Sscanf(cached, "%s:%s", &sessionID, &createdAt)
		if parseErr == nil {
			return sessionID, nil
		}
	}

	// Fallback to database
	query := `
		SELECT id, created_at 
		FROM sessions 
		WHERE session_token = $1 
		AND created_at > $2
	`

	var sessionID uuid.UUID
	var createdAt time.Time
	
	// Sessions expire after 24 hours
	expiryTime := time.Now().Add(-24 * time.Hour)
	
	err = s.db.QueryRow(ctx, query, token, expiryTime).Scan(&sessionID, &createdAt)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid or expired session: %w", err)
	}

	// Update cache
	sessionData := fmt.Sprintf("%s:%s", sessionID.String(), createdAt.Format(time.RFC3339))
	s.redis.Set(ctx, cacheKey, sessionData, time.Hour)

	// Update last_active timestamp
	updateQuery := `UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE id = $1`
	s.db.Exec(ctx, updateQuery, sessionID)

	return sessionID, nil
}

// generateSessionToken generates a cryptographically secure session token
func generateSessionToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}