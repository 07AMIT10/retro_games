package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"retro-games-backend/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// GameService handles game operations
type GameService struct {
	db    *pgxpool.Pool
	redis *redis.Client
}

// NewGameService creates a new game service
func NewGameService(db *pgxpool.Pool, redis *redis.Client) *GameService {
	return &GameService{
		db:    db,
		redis: redis,
	}
}

// GetAllGames returns all available games
func (g *GameService) GetAllGames(ctx context.Context) (*models.GamesListResponse, error) {
	// Try Redis cache first
	cacheKey := "games:all"
	cached, err := g.redis.Get(ctx, cacheKey).Result()
	
	if err == nil {
		var response models.GamesListResponse
		if json.Unmarshal([]byte(cached), &response) == nil {
			return &response, nil
		}
	}

	// Fallback to database
	query := `
		SELECT id, name, category, enabled, created_at 
		FROM games 
		WHERE enabled = true 
		ORDER BY category, name
	`

	rows, err := g.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch games: %w", err)
	}
	defer rows.Close()

	var games []models.Game
	for rows.Next() {
		var game models.Game
		err := rows.Scan(&game.ID, &game.Name, &game.Category, &game.Enabled, &game.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan game: %w", err)
		}
		games = append(games, game)
	}

	response := &models.GamesListResponse{
		Games: games,
		Total: len(games),
	}

	// Cache result for 15 minutes
	if responseJSON, err := json.Marshal(response); err == nil {
		g.redis.Set(ctx, cacheKey, responseJSON, 15*time.Minute)
	}

	return response, nil
}

// GetGameByID returns a specific game by ID
func (g *GameService) GetGameByID(ctx context.Context, gameID string) (*models.Game, error) {
	query := `
		SELECT id, name, category, enabled, created_at 
		FROM games 
		WHERE id = $1 AND enabled = true
	`

	var game models.Game
	err := g.db.QueryRow(ctx, query, gameID).Scan(
		&game.ID, &game.Name, &game.Category, &game.Enabled, &game.CreatedAt,
	)
	
	if err != nil {
		return nil, fmt.Errorf("game not found: %w", err)
	}

	return &game, nil
}