package handlers

import (
	"retro-games-backend/internal/services"
)

// Handlers contains all HTTP handlers
type Handlers struct {
	sessionService     *services.SessionService
	gameService        *services.GameService
	scoreService       *services.ScoreService
	leaderboardService *services.LeaderboardService
}

// New creates a new handlers instance
func New(
	sessionService *services.SessionService,
	gameService *services.GameService,
	scoreService *services.ScoreService,
	leaderboardService *services.LeaderboardService,
) *Handlers {
	return &Handlers{
		sessionService:     sessionService,
		gameService:        gameService,
		scoreService:       scoreService,
		leaderboardService: leaderboardService,
	}
}