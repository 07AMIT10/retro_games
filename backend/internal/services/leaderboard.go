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

// LeaderboardService handles leaderboard operations
type LeaderboardService struct {
	db    *pgxpool.Pool
	redis *redis.Client
}

// NewLeaderboardService creates a new leaderboard service
func NewLeaderboardService(db *pgxpool.Pool, redis *redis.Client) *LeaderboardService {
	return &LeaderboardService{
		db:    db,
		redis: redis,
	}
}

// GetGameLeaderboard gets the top scores for a specific game
func (l *LeaderboardService) GetGameLeaderboard(ctx context.Context, gameID string, limit int) (*models.LeaderboardResponse, error) {
	// Try Redis cache first
	cacheKey := fmt.Sprintf("leaderboard:%s:%d", gameID, limit)
	cached, err := l.redis.Get(ctx, cacheKey).Result()
	
	if err == nil {
		var response models.LeaderboardResponse
		if json.Unmarshal([]byte(cached), &response) == nil {
			return &response, nil
		}
	}

	// Fallback to database
	query := `
		SELECT s.score, s.achieved_at, s.session_id,
		       ROW_NUMBER() OVER (ORDER BY s.score DESC, s.achieved_at ASC) as rank
		FROM scores s
		WHERE s.game_id = $1
		ORDER BY s.score DESC, s.achieved_at ASC
		LIMIT $2
	`

	rows, err := l.db.Query(ctx, query, gameID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch leaderboard: %w", err)
	}
	defer rows.Close()

	var entries []models.LeaderboardEntry
	for rows.Next() {
		var entry models.LeaderboardEntry
		var sessionID string
		
		err := rows.Scan(&entry.Score, &entry.AchievedAt, &sessionID, &entry.Rank)
		if err != nil {
			return nil, fmt.Errorf("failed to scan leaderboard entry: %w", err)
		}
		
		entry.SessionID = sessionID[:8] // Show only first 8 chars for privacy
		entries = append(entries, entry)
	}

	response := &models.LeaderboardResponse{
		GameID:  gameID,
		Entries: entries,
		Total:   len(entries),
	}

	// Cache result for 5 minutes
	if responseJSON, err := json.Marshal(response); err == nil {
		l.redis.Set(ctx, cacheKey, responseJSON, 5*time.Minute)
	}

	return response, nil
}

// GetGlobalLeaderboard gets the top scores across all games
func (l *LeaderboardService) GetGlobalLeaderboard(ctx context.Context, limit int) (*models.GlobalLeaderboardResponse, error) {
	// Try Redis cache first
	cacheKey := fmt.Sprintf("leaderboard:global:%d", limit)
	cached, err := l.redis.Get(ctx, cacheKey).Result()
	
	if err == nil {
		var response models.GlobalLeaderboardResponse
		if json.Unmarshal([]byte(cached), &response) == nil {
			return &response, nil
		}
	}

	// Fallback to database
	query := `
		SELECT s.game_id, g.name, s.score, s.session_id, s.achieved_at
		FROM scores s
		JOIN games g ON s.game_id = g.id
		ORDER BY s.score DESC, s.achieved_at ASC
		LIMIT $1
	`

	rows, err := l.db.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch global leaderboard: %w", err)
	}
	defer rows.Close()

	var entries []models.GlobalLeaderboardEntry
	for rows.Next() {
		var entry models.GlobalLeaderboardEntry
		var sessionID string
		
		err := rows.Scan(&entry.GameID, &entry.GameName, &entry.Score, &sessionID, &entry.AchievedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan global leaderboard entry: %w", err)
		}
		
		entry.SessionID = sessionID[:8] // Show only first 8 chars for privacy
		entries = append(entries, entry)
	}

	response := &models.GlobalLeaderboardResponse{
		Entries: entries,
		Total:   len(entries),
	}

	// Cache result for 5 minutes
	if responseJSON, err := json.Marshal(response); err == nil {
		l.redis.Set(ctx, cacheKey, responseJSON, 5*time.Minute)
	}

	return response, nil
}