package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// SessionAuth validates session token for authenticated endpoints
func SessionAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get session token from header
		sessionToken := c.GetHeader("X-Session-Token")
		if sessionToken == "" {
			// Also check Authorization header
			authHeader := c.GetHeader("Authorization")
			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				sessionToken = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if sessionToken == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Session token required",
			})
			c.Abort()
			return
		}

		// Store session token in context for handlers to use
		c.Set("session_token", sessionToken)
		c.Next()
	}
}