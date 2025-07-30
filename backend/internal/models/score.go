package models

import (
	"time"

	"github.com/google/uuid"
)

// Score represents a game score record
type Score struct {
	ID         uuid.UUID `json:"id" db:"id"`
	SessionID  uuid.UUID `json:"session_id" db:"session_id"`
	GameID     string    `json:"game_id" db:"game_id"`
	Score      int       `json:"score" db:"score"`
	AchievedAt time.Time `json:"achieved_at" db:"achieved_at"`
}

// ScoreSubmissionRequest represents a score submission request
type ScoreSubmissionRequest struct {
	GameID string `json:"game_id" binding:"required"`
	Score  int    `json:"score" binding:"required,min=0,max=99999999"`
}

// ScoreResponse represents the response after submitting a score
type ScoreResponse struct {
	GameID       string    `json:"game_id"`
	Score        int       `json:"score"`
	PersonalBest int       `json:"personal_best"`
	Rank         int       `json:"rank,omitempty"`
	AchievedAt   time.Time `json:"achieved_at"`
}

// UserScoresResponse represents the response for user's scores
type UserScoresResponse struct {
	Scores []Score `json:"scores"`
	Total  int     `json:"total"`
}

// LeaderboardEntry represents a single leaderboard entry
type LeaderboardEntry struct {
	Rank       int       `json:"rank"`
	Score      int       `json:"score"`
	SessionID  string    `json:"session_id,omitempty"`
	AchievedAt time.Time `json:"achieved_at"`
}

// LeaderboardResponse represents the response for leaderboards
type LeaderboardResponse struct {
	GameID  string             `json:"game_id"`
	Entries []LeaderboardEntry `json:"entries"`
	Total   int                `json:"total"`
}

// GlobalLeaderboardEntry represents a global leaderboard entry
type GlobalLeaderboardEntry struct {
	GameID     string    `json:"game_id"`
	GameName   string    `json:"game_name"`
	Score      int       `json:"score"`
	SessionID  string    `json:"session_id,omitempty"`
	AchievedAt time.Time `json:"achieved_at"`
}

// GlobalLeaderboardResponse represents the global leaderboard response
type GlobalLeaderboardResponse struct {
	Entries []GlobalLeaderboardEntry `json:"entries"`
	Total   int                      `json:"total"`
}