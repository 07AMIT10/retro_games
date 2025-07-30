package handlers

import (
	"net/http"

	"retro-games-backend/internal/models"

	"github.com/gin-gonic/gin"
)

// CreateSession creates a new anonymous session
func (h *Handlers) CreateSession(c *gin.Context) {
	var req models.CreateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// If no body provided, get IP and User-Agent from headers
		req.IPAddress = c.ClientIP()
		req.UserAgent = c.GetHeader("User-Agent")
	}

	// Create session
	session, err := h.sessionService.CreateSession(c.Request.Context(), req.IPAddress, req.UserAgent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create session",
		})
		return
	}

	c.JSON(http.StatusCreated, session)
}