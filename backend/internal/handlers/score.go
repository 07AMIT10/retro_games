package handlers

import (
	"net/http"

	"retro-games-backend/internal/models"

	"github.com/gin-gonic/gin"
	// "github.com/google/uuid"
)

// SubmitScore handles score submission
func (h *Handlers) SubmitScore(c *gin.Context) {
	// Get session token from context (set by auth middleware)
	sessionToken, exists := c.Get("session_token")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Session token required",
		})
		return
	}

	// Validate session and get session ID
	sessionID, err := h.sessionService.ValidateSession(c.Request.Context(), sessionToken.(string))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid session",
		})
		return
	}

	// Parse request body
	var req models.ScoreSubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	// Submit score
	response, err := h.scoreService.SubmitScore(c.Request.Context(), sessionID, req.GameID, req.Score)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to submit score",
		})
		return
	}

	c.JSON(http.StatusCreated, response)
}

// GetUserScores gets all scores for a user and specific game
func (h *Handlers) GetUserScores(c *gin.Context) {
	gameID := c.Param("gameId")
	if gameID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Game ID is required",
		})
		return
	}

	// Get session token from context (set by auth middleware)
	sessionToken, exists := c.Get("session_token")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Session token required",
		})
		return
	}

	// Validate session and get session ID
	sessionID, err := h.sessionService.ValidateSession(c.Request.Context(), sessionToken.(string))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid session",
		})
		return
	}

	// Get user scores
	scores, err := h.scoreService.GetUserScores(c.Request.Context(), sessionID, gameID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch scores",
		})
		return
	}

	c.JSON(http.StatusOK, scores)
}
