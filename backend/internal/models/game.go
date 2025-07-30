package models

import "time"

// Game represents a game configuration
type Game struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Category  string    `json:"category" db:"category"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// GamesListResponse represents the response for listing games
type GamesListResponse struct {
	Games []Game `json:"games"`
	Total int    `json:"total"`
}