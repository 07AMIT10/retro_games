package services

import (
	"context"
	"fmt"
	"time"

	"retro-games-backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// ScoreService handles score operations
type ScoreService struct {
	db    *pgxpool.Pool
	redis *redis.Client
}

// NewScoreService creates a new score service
func NewScoreService(db *pgxpool.Pool, redis *redis.Client) *ScoreService {
	return &ScoreService{
		db:    db,
		redis: redis,
	}
}

// SubmitScore submits a new score for a game
func (s *ScoreService) SubmitScore(ctx context.Context, sessionID uuid.UUID, gameID string, score int) (*models.ScoreResponse, error) {
	// Insert new score
	query := `
		INSERT INTO scores (session_id, game_id, score)
		VALUES ($1, $2, $3)
		RETURNING id, achieved_at
	`

	var scoreID uuid.UUID
	var achievedAt time.Time

	err := s.db.QueryRow(ctx, query, sessionID, gameID, score).Scan(&scoreID, &achievedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to submit score: %w", err)
	}

	// Get personal best
	personalBest, err := s.GetPersonalBest(ctx, sessionID, gameID)
	if err != nil {
		personalBest = score // If error, assume this is the first score
	}

	// Get rank (position in leaderboard)
	rank, err := s.getScoreRank(ctx, gameID, score)
	if err != nil {
		rank = 0 // If error, don't show rank
	}

	// Invalidate cache for this game
	s.invalidateGameCache(ctx, gameID)

	return &models.ScoreResponse{
		GameID:       gameID,
		Score:        score,
		PersonalBest: personalBest,
		Rank:         rank,
		AchievedAt:   achievedAt,
	}, nil
}

// GetPersonalBest gets the highest score for a session and game
func (s *ScoreService) GetPersonalBest(ctx context.Context, sessionID uuid.UUID, gameID string) (int, error) {
	// Try cache first
	cacheKey := fmt.Sprintf("personal_best:%s:%s", sessionID.String(), gameID)
	cached, err := s.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var score int
		if _, parseErr := fmt.Sscanf(cached, "%d", &score); parseErr == nil {
			return score, nil
		}
	}

	// Fallback to database
	query := `
		SELECT COALESCE(MAX(score), 0) 
		FROM scores 
		WHERE session_id = $1 AND game_id = $2
	`

	var personalBest int
	err = s.db.QueryRow(ctx, query, sessionID, gameID).Scan(&personalBest)
	if err != nil {
		return 0, fmt.Errorf("failed to get personal best: %w", err)
	}

	// Cache result for 1 hour
	s.redis.Set(ctx, cacheKey, fmt.Sprintf("%d", personalBest), time.Hour)

	return personalBest, nil
}

// GetUserScores gets all scores for a session and game
func (s *ScoreService) GetUserScores(ctx context.Context, sessionID uuid.UUID, gameID string) (*models.UserScoresResponse, error) {
	query := `
		SELECT id, session_id, game_id, score, achieved_at
		FROM scores 
		WHERE session_id = $1 AND game_id = $2
		ORDER BY score DESC, achieved_at DESC
		LIMIT 10
	`

	rows, err := s.db.Query(ctx, query, sessionID, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user scores: %w", err)
	}
	defer rows.Close()

	var scores []models.Score
	for rows.Next() {
		var score models.Score
		err := rows.Scan(&score.ID, &score.SessionID, &score.GameID, &score.Score, &score.AchievedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan score: %w", err)
		}
		scores = append(scores, score)
	}

	return &models.UserScoresResponse{
		Scores: scores,
		Total:  len(scores),
	}, nil
}

// getScoreRank calculates the rank of a score in the global leaderboard
func (s *ScoreService) getScoreRank(ctx context.Context, gameID string, score int) (int, error) {
	query := `
		SELECT COUNT(*) + 1 
		FROM scores 
		WHERE game_id = $1 AND score > $2
	`

	var rank int
	err := s.db.QueryRow(ctx, query, gameID, score).Scan(&rank)
	if err != nil {
		return 0, fmt.Errorf("failed to calculate rank: %w", err)
	}

	return rank, nil
}

// invalidateGameCache invalidates all cache entries for a game
func (s *ScoreService) invalidateGameCache(ctx context.Context, gameID string) {
	cacheKeys := []string{
		fmt.Sprintf("leaderboard:%s", gameID),
		"leaderboard:global",
	}

	for _, key := range cacheKeys {
		s.redis.Del(ctx, key)
	}
}