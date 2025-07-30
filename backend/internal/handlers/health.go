package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// HealthCheck handles health check requests
func HealthCheck(db *pgxpool.Pool, redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		health := map[string]interface{}{
			"status":    "healthy",
			"timestamp": time.Now(),
			"version":   "1.0.0",
		}

		// Check database
		if err := db.Ping(c.Request.Context()); err != nil {
			health["database"] = "unhealthy"
			health["status"] = "degraded"
		} else {
			health["database"] = "healthy"
		}

		// Check Redis
		if err := redisClient.Ping(c.Request.Context()).Err(); err != nil {
			health["cache"] = "unhealthy"
			health["status"] = "degraded"
		} else {
			health["cache"] = "healthy"
		}

		status := http.StatusOK
		if health["status"] == "degraded" {
			status = http.StatusServiceUnavailable
		}

		c.JSON(status, health)
	}
}