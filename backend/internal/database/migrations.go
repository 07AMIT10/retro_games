package database

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// RunMigrations executes all database migrations
func RunMigrations(db *pgxpool.Pool) error {
	migrations := []string{
		createSessionsTable,
		createGamesTable,
		createScoresTable,
		createIndexes,
		insertInitialGames,
	}

	for i, migration := range migrations {
		if err := executeMigration(db, migration, i+1); err != nil {
			return fmt.Errorf("migration %d failed: %w", i+1, err)
		}
	}

	return nil
}

// executeMigration runs a single migration
func executeMigration(db *pgxpool.Pool, migration string, version int) error {
	_, err := db.Exec(context.Background(), migration)
	if err != nil {
		return fmt.Errorf("failed to execute migration %d: %w", version, err)
	}
	return nil
}

// Database schema migrations
const createSessionsTable = `
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);
`

const createGamesTable = `
CREATE TABLE IF NOT EXISTS games (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

const createScoresTable = `
CREATE TABLE IF NOT EXISTS scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    game_id VARCHAR(50) REFERENCES games(id),
    score INTEGER NOT NULL,
    achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

const createIndexes = `
CREATE INDEX IF NOT EXISTS idx_game_score ON scores(game_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_session_game ON scores(session_id, game_id);
CREATE INDEX IF NOT EXISTS idx_session_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_session_active ON sessions(last_active);
`

const insertInitialGames = `
INSERT INTO games (id, name, category) VALUES
    ('snake', 'Snake', 'arcade'),
    ('tetris', 'Tetris', 'puzzle'),
    ('pong', 'Pong', 'sports'),
    ('breakout', 'Breakout', 'arcade'),
    ('pacman', 'Pac-Man', 'arcade'),
    ('space-invaders', 'Space Invaders', 'shooter'),
    ('asteroids', 'Asteroids', 'arcade'),
    ('frogger', 'Frogger', 'arcade'),
    ('centipede', 'Centipede', 'arcade'),
    ('missile-command', 'Missile Command', 'arcade'),
    ('galaga', 'Galaga', 'shooter'),
    ('defender', 'Defender', 'shooter'),
    ('phoenix', 'Phoenix', 'shooter'),
    ('laser-defense', 'Laser Defense', 'shooter'),
    ('missile-defense', 'Missile Defense', 'shooter'),
    ('centipede-shooter', 'Centipede Shooter', 'shooter'),
    ('game2048', '2048', 'puzzle'),
    ('sudoku', 'Sudoku', 'puzzle'),
    ('connect-four', 'Connect Four', 'puzzle'),
    ('match3', 'Match 3', 'puzzle'),
    ('sliding-puzzle', 'Sliding Puzzle', 'puzzle'),
    ('sokoban', 'Sokoban', 'puzzle'),
    ('tennis', 'Tennis', 'sports'),
    ('basketball', 'Basketball', 'sports'),
    ('bowling', 'Bowling', 'sports'),
    ('soccer', 'Soccer', 'sports'),
    ('golf', 'Golf', 'sports'),
    ('air-hockey', 'Air Hockey', 'sports'),
    ('circuit-racer', 'Circuit Racer', 'racing'),
    ('desert-rally', 'Desert Rally', 'racing'),
    ('drag-racing', 'Drag Racing', 'racing'),
    ('f1-racing', 'F1 Racing', 'racing'),
    ('mountain-racing', 'Mountain Racing', 'racing'),
    ('road-racer', 'Road Racer', 'racing'),
    ('speed-chase', 'Speed Chase', 'racing')
ON CONFLICT (id) DO NOTHING;
`