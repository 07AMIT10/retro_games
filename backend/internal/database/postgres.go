package database

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPostgresConnection creates a new PostgreSQL connection pool
func NewPostgresConnection(databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}

	// Configure connection pool for free tier optimization
	config.MaxConns = 10                    // Limit connections for free tier
	config.MinConns = 2                     // Keep minimum connections
	config.MaxConnLifetime = time.Hour      // Rotate connections
	config.MaxConnIdleTime = 30 * time.Minute // Close idle connections

	// Create connection pool
	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return nil, err
	}

	// Test connection
	if err := pool.Ping(context.Background()); err != nil {
		return nil, err
	}

	return pool, nil
}