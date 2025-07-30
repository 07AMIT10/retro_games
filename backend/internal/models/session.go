package models

import (
	"time"

	"github.com/google/uuid"
)

// Session represents an anonymous user session
type Session struct {
	ID           uuid.UUID `json:"id" db:"id"`
	SessionToken string    `json:"session_token" db:"session_token"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	LastActive   time.Time `json:"last_active" db:"last_active"`
	IPAddress    string    `json:"ip_address,omitempty" db:"ip_address"`
	UserAgent    string    `json:"user_agent,omitempty" db:"user_agent"`
}

// CreateSessionRequest represents the request to create a new session
type CreateSessionRequest struct {
	IPAddress string `json:"ip_address"`
	UserAgent string `json:"user_agent"`
}

// SessionResponse represents the response when creating or validating a session
type SessionResponse struct {
	SessionToken string    `json:"session_token"`
	ExpiresAt    time.Time `json:"expires_at,omitempty"`
}