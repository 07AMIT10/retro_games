package main

import (
	"context"
	// "fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"retro-games-backend/internal/config"
	"retro-games-backend/internal/database"
	"retro-games-backend/internal/handlers"
	"retro-games-backend/internal/middleware"
	"retro-games-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Set Gin mode
	gin.SetMode(cfg.GinMode)

	// Initialize database
	db, err := database.NewPostgresConnection(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Redis
	redisClient, err := database.NewRedisConnection(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	// Run database migrations
	if err := database.RunMigrations(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize services
	sessionService := services.NewSessionService(db, redisClient)
	gameService := services.NewGameService(db, redisClient)
	scoreService := services.NewScoreService(db, redisClient)
	leaderboardService := services.NewLeaderboardService(db, redisClient)

	// Initialize handlers
	h := handlers.New(sessionService, gameService, scoreService, leaderboardService)

	// Setup router
	router := setupRouter(h, db, redisClient, cfg)

	// Setup HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Server starting on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func setupRouter(h *handlers.Handlers, db *pgxpool.Pool, redisClient *redis.Client, cfg *config.Config) *gin.Engine {
	router := gin.New()

	// Add middleware
	router.Use(gin.Recovery())
	router.Use(middleware.CORS())
	router.Use(middleware.RateLimit(cfg.RateLimit))
	router.Use(middleware.Logger())

	// Health check endpoint
	router.GET("/health", handlers.HealthCheck(db, redisClient))

	// API routes
	api := router.Group("/api/v1")
	{
		// Session management
		api.POST("/users/session", h.CreateSession)

		// Game management
		api.GET("/games", h.GetGames)

		// Score management
		scores := api.Group("/scores")
		scores.Use(middleware.SessionAuth())
		{
			scores.POST("", h.SubmitScore)
			scores.GET("/:gameId", h.GetUserScores)
		}

		// Leaderboard endpoints
		leaderboards := api.Group("/leaderboards")
		{
			leaderboards.GET("/:gameId", h.GetGameLeaderboard)
			leaderboards.GET("/global", h.GetGlobalLeaderboard)
		}
	}

	return router
}