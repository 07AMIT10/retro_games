package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetGames returns all available games
func (h *Handlers) GetGames(c *gin.Context) {
	games, err := h.gameService.GetAllGames(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch games",
		})
		return
	}

	c.JSON(http.StatusOK, games)
}