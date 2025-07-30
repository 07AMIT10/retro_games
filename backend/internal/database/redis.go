package database

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// NewRedisConnection creates a new Redis connection
func NewRedisConnection(redisURL string) (*redis.Client, error) {
	// Parse Redis URL
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}

	// Configure Redis client for free tier optimization
	opt.PoolSize = 10                   // Limit connection pool
	opt.MinIdleConns = 2               // Keep minimum connections
	opt.MaxRetries = 3                 // Retry failed commands
	opt.PoolTimeout = 30 * time.Second // Pool timeout
	opt.ReadTimeout = 15 * time.Second // Read timeout
	opt.WriteTimeout = 15 * time.Second // Write timeout

	client := redis.NewClient(opt)

	// Test connection
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}

	return client, nil
}