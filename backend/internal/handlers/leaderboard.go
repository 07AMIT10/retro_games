package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetGameLeaderboard gets the leaderboard for a specific game
func (h *Handlers) GetGameLeaderboard(c *gin.Context) {
	gameID := c.Param("gameId")
	if gameID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Game ID is required",
		})
		return
	}

	// Parse limit parameter (default to 10)
	limit := 10
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	// Get leaderboard
	leaderboard, err := h.leaderboardService.GetGameLeaderboard(c.Request.Context(), gameID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch leaderboard",
		})
		return
	}

	c.JSON(http.StatusOK, leaderboard)
}

// GetGlobalLeaderboard gets the global leaderboard across all games
func (h *Handlers) GetGlobalLeaderboard(c *gin.Context) {
	// Parse limit parameter (default to 20)
	limit := 20
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	// Get global leaderboard
	leaderboard, err := h.leaderboardService.GetGlobalLeaderboard(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch global leaderboard",
		})
		return
	}

	c.JSON(http.StatusOK, leaderboard)
}