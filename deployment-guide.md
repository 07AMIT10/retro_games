# Deployment Guide - Go Backend for Retro Games

## Render Deployment Configuration

### 1. Service Configuration Files

#### render.yaml
```yaml
services:
  - type: web
    name: retro-games-api
    env: go
    region: oregon
    plan: free
    buildCommand: |
      go mod download &&
      go build -ldflags="-s -w" -o bin/server cmd/server/main.go
    startCommand: ./bin/server
    healthCheckPath: /api/health
    
    envVars:
      - key: PORT
        value: 8080
      - key: GIN_MODE
        value: release
      - key: GO_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: retro-games-db
          property: connectionString
      - key: REDIS_URL
        fromDatabase:
          name: retro-games-redis
          property: connectionString
      - key: RATE_LIMIT_PER_MINUTE
        value: 100
      - key: CORS_ORIGINS
        value: "*"
      - key: LOG_LEVEL
        value: info

databases:
  - name: retro-games-db
    databaseName: retro_games
    user: retro_user
    region: oregon
    plan: free
    
  - name: retro-games-redis
    region: oregon
    plan: free
```

### 2. Dockerfile (Multi-stage build for size optimization)

```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder

# Install git and ca-certificates (needed for go mod download)
RUN apk add --no-cache git ca-certificates tzdata

# Create app directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the binary with optimizations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o server cmd/server/main.go

# Final stage
FROM alpine:3.18

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

# Create app user for security
RUN adduser -D -s /bin/sh appuser

WORKDIR /app

# Copy the binary and migrations
COPY --from=builder /app/server .
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Change ownership to app user
RUN chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

EXPOSE 8080

CMD ["./server"]
```

### 3. Build Optimization Script

```bash
#!/bin/bash
# scripts/build-optimized.sh

echo "Building optimized Go binary for production..."

# Set build variables
export CGO_ENABLED=0
export GOOS=linux
export GOARCH=amd64

# Build flags for smallest binary size
BUILD_FLAGS="-ldflags=-w -s -extldflags '-static'"
BUILD_FLAGS="$BUILD_FLAGS -a -installsuffix cgo"
BUILD_FLAGS="$BUILD_FLAGS -trimpath"

# Build the binary
go build $BUILD_FLAGS -o bin/server cmd/server/main.go

echo "Binary size:"
ls -lh bin/server

echo "Stripping binary further..."
strip bin/server 2>/dev/null || true

echo "Final binary size:"
ls -lh bin/server

echo "Build complete!"
```

## Container Resource Optimization

### 1. Memory Management Configuration

```go
// internal/config/optimization.go
package config

import (
    "runtime"
    "runtime/debug"
)

func OptimizeForContainer() {
    // Set GOMAXPROCS to container CPU limit
    // Render free tier has 0.1 CPU units
    runtime.GOMAXPROCS(1)
    
    // Reduce GC target percentage for lower memory usage
    debug.SetGCPercent(20) // Default is 100
    
    // Set memory limit to 80% of container limit (512MB * 0.8 = 410MB)
    debug.SetMemoryLimit(410 * 1024 * 1024)
    
    // Force initial GC to establish baseline
    runtime.GC()
}
```

### 2. Connection Pool Tuning

```go
// internal/config/database.go
package config

import (
    "time"
    "github.com/jackc/pgx/v5/pgxpool"
)

func GetOptimizedPgxConfig(databaseURL string) (*pgxpool.Config, error) {
    config, err := pgxpool.ParseConfig(databaseURL)
    if err != nil {
        return nil, err
    }
    
    // Optimize for free tier constraints
    config.MaxConns = 5                    // Low connection count
    config.MinConns = 1                    // Keep minimum alive
    config.MaxConnLifetime = 30 * time.Minute
    config.MaxConnIdleTime = 10 * time.Minute
    config.HealthCheckPeriod = 1 * time.Minute
    
    // Connection pool settings
    config.ConnConfig.ConnectTimeout = 10 * time.Second
    config.ConnConfig.CommandTimeout = 30 * time.Second
    
    return config, nil
}
```

## Deployment Steps

### Step 1: Repository Setup

```bash
# 1. Create new repository
git init retro-games-backend
cd retro-games-backend

# 2. Add Render configuration
mkdir -p deployments
# Add render.yaml and Dockerfile to deployments/

# 3. Set up Go module
go mod init retro-games-backend
go mod tidy

# 4. Create project structure
mkdir -p {cmd/server,internal/{api/{handlers,middleware},models,services,repository/{postgres,redis},config},pkg/{logger,validator,utils},migrations,scripts}
```

### Step 2: Database Setup

```sql
-- migrations/001_initial_schema.sql
-- Create database schema (see main architecture doc)

-- migrations/002_seed_games.sql
INSERT INTO games (id, name, category, enabled) VALUES
('snake', 'Snake', 'arcade', true),
('pacman', 'Pac-Man', 'arcade', true),
('tetris', 'Tetris', 'puzzle', true),
('pong', 'Pong', 'sports', true),
('space-invaders', 'Space Invaders', 'shooter', true),
-- ... all 35+ games
;
```

### Step 3: Render Deployment

```bash
# 1. Connect repository to Render
# - Go to render.com
# - Connect GitHub repository
# - Select "Web Service"

# 2. Configure environment variables
# DATABASE_URL - automatically set by Render
# REDIS_URL - automatically set by Render
# PORT=8080
# GIN_MODE=release

# 3. Deploy
git add .
git commit -m "Initial backend deployment"
git push origin main
```

## Monitoring & Logging

### 1. Structured Logging Setup

```go
// pkg/logger/render_logger.go
package logger

import (
    "os"
    "github.com/sirupsen/logrus"
)

func NewRenderLogger() *logrus.Logger {
    log := logrus.New()
    
    // JSON format for Render log aggregation
    log.SetFormatter(&logrus.JSONFormatter{
        TimestampFormat: "2006-01-02T15:04:05.000Z07:00",
        FieldMap: logrus.FieldMap{
            logrus.FieldKeyTime:  "timestamp",
            logrus.FieldKeyLevel: "level",
            logrus.FieldKeyMsg:   "message",
        },
    })
    
    // Set log level based on environment
    if os.Getenv("LOG_LEVEL") == "debug" {
        log.SetLevel(logrus.DebugLevel)
    } else {
        log.SetLevel(logrus.InfoLevel)
    }
    
    return log
}
```

### 2. Health Check Implementation

```go
// internal/api/handlers/health.go
package handlers

import (
    "context"
    "net/http"
    "time"
    
    "github.com/gin-gonic/gin"
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/redis/go-redis/v9"
)

type HealthResponse struct {
    Status    string                 `json:"status"`
    Timestamp time.Time             `json:"timestamp"`
    Version   string                `json:"version"`
    Services  map[string]interface{} `json:"services"`
    Memory    map[string]interface{} `json:"memory,omitempty"`
}

func NewHealthHandler(db *pgxpool.Pool, redis *redis.Client, version string) gin.HandlerFunc {
    return func(c *gin.Context) {
        ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
        defer cancel()
        
        health := HealthResponse{
            Status:    "healthy",
            Timestamp: time.Now(),
            Version:   version,
            Services:  make(map[string]interface{}),
        }
        
        // Check PostgreSQL
        if err := db.Ping(ctx); err != nil {
            health.Services["database"] = map[string]interface{}{
                "status": "unhealthy",
                "error":  err.Error(),
            }
            health.Status = "degraded"
        } else {
            health.Services["database"] = map[string]interface{}{
                "status": "healthy",
                "stats":  db.Stat(),
            }
        }
        
        // Check Redis
        if err := redis.Ping(ctx).Err(); err != nil {
            health.Services["cache"] = map[string]interface{}{
                "status": "unhealthy",
                "error":  err.Error(),
            }
            health.Status = "degraded"
        } else {
            health.Services["cache"] = map[string]interface{}{
                "status": "healthy",
            }
        }
        
        // Add memory stats in debug mode
        if c.Query("debug") == "true" {
            var m runtime.MemStats
            runtime.ReadMemStats(&m)
            health.Memory = map[string]interface{}{
                "alloc_mb":      m.Alloc / 1024 / 1024,
                "total_alloc_mb": m.TotalAlloc / 1024 / 1024,
                "sys_mb":        m.Sys / 1024 / 1024,
                "num_gc":        m.NumGC,
            }
        }
        
        statusCode := http.StatusOK
        if health.Status != "healthy" {
            statusCode = http.StatusServiceUnavailable
        }
        
        c.JSON(statusCode, health)
    }
}
```

## Performance Monitoring

### 1. Basic Metrics Collection

```go
// internal/middleware/metrics.go
package middleware

import (
    "strconv"
    "time"
    
    "github.com/gin-gonic/gin"
    "github.com/sirupsen/logrus"
)

func MetricsMiddleware(logger *logrus.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        
        c.Next()
        
        duration := time.Since(start)
        
        // Log metrics
        logger.WithFields(logrus.Fields{
            "method":     c.Request.Method,
            "path":       c.Request.URL.Path,
            "status":     c.Writer.Status(),
            "duration_ms": duration.Milliseconds(),
            "ip":         c.ClientIP(),
            "user_agent": c.Request.UserAgent(),
        }).Info("request_completed")
        
        // Log slow requests
        if duration > 1*time.Second {
            logger.WithFields(logrus.Fields{
                "method":     c.Request.Method,
                "path":       c.Request.URL.Path,
                "duration_ms": duration.Milliseconds(),
            }).Warn("slow_request")
        }
    }
}
```

### 2. Resource Usage Monitoring

```go
// internal/services/monitor_service.go
package services

import (
    "context"
    "runtime"
    "time"
    
    "github.com/sirupsen/logrus"
)

type MonitorService struct {
    logger *logrus.Logger
}

func NewMonitorService(logger *logrus.Logger) *MonitorService {
    return &MonitorService{logger: logger}
}

func (m *MonitorService) StartResourceMonitoring(ctx context.Context) {
    ticker := time.NewTicker(5 * time.Minute)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            m.logResourceUsage()
        }
    }
}

func (m *MonitorService) logResourceUsage() {
    var mem runtime.MemStats
    runtime.ReadMemStats(&mem)
    
    m.logger.WithFields(logrus.Fields{
        "memory_alloc_mb":    mem.Alloc / 1024 / 1024,
        "memory_sys_mb":      mem.Sys / 1024 / 1024,
        "memory_heap_mb":     mem.HeapAlloc / 1024 / 1024,
        "goroutines":         runtime.NumGoroutine(),
        "gc_runs":           mem.NumGC,
        "cpu_cores":         runtime.NumCPU(),
        "max_procs":         runtime.GOMAXPROCS(0),
    }).Info("resource_usage")
}
```

## Troubleshooting Guide

### Common Deployment Issues

#### 1. Memory Limit Exceeded
```bash
# Symptoms: Container restarts, OOM kills
# Solution: Optimize memory usage

# Check memory usage in logs
grep "memory_alloc_mb" logs.txt

# Reduce connection pools
# Lower GC target percentage
# Enable memory limit
```

#### 2. Database Connection Issues
```bash
# Symptoms: Connection timeout errors
# Check connection string format
# Verify network connectivity

# Test connection locally
psql $DATABASE_URL -c "SELECT 1;"
```

#### 3. Redis Connection Problems
```bash
# Symptoms: Cache misses, connection refused
# Check Redis URL format
# Verify Redis instance status

# Test Redis connection
redis-cli -u $REDIS_URL ping
```

### Performance Optimization Checklist

- [ ] Enable GZip compression for API responses
- [ ] Implement request/response caching headers
- [ ] Use database connection pooling
- [ ] Enable Redis connection pooling
- [ ] Implement graceful shutdown
- [ ] Add request timeout middleware
- [ ] Use structured logging
- [ ] Monitor memory usage
- [ ] Set appropriate GC parameters
- [ ] Use optimized Docker image

### Scaling Considerations

When outgrowing free tier:

1. **Horizontal Scaling**: Multiple container instances
2. **Database Scaling**: Read replicas, connection pooling
3. **Cache Scaling**: Redis cluster or multiple instances
4. **CDN Integration**: CloudFlare for static assets
5. **Load Balancing**: Render's built-in load balancer

## Security Hardening

### 1. Rate Limiting per IP
```go
func NewIPRateLimiter() *IPRateLimiter {
    return &IPRateLimiter{
        limiters: make(map[string]*rate.Limiter),
        mu:       &sync.RWMutex{},
        rate:     rate.Limit(100), // 100 requests per minute
        burst:    200,             // Allow bursts up to 200
    }
}
```

### 2. Input Validation
```go
func ValidateGameID(gameID string) error {
    if len(gameID) == 0 || len(gameID) > 50 {
        return errors.New("invalid game ID length")
    }
    
    if !regexp.MustCompile(`^[a-z0-9-]+$`).MatchString(gameID) {
        return errors.New("invalid game ID format")
    }
    
    return nil
}
```

### 3. CORS Security
```go
func secureCORS() gin.HandlerFunc {
    return func(c *gin.Context) {
        origin := c.Request.Header.Get("Origin")
        
        // Allow specific origins in production
        allowedOrigins := []string{
            "https://yourapp.render.com",
            "https://yourdomain.com",
        }
        
        if contains(allowedOrigins, origin) {
            c.Header("Access-Control-Allow-Origin", origin)
        }
        
        c.Next()
    }
}
```

This deployment guide ensures your Go backend runs efficiently on Render's free tier while maintaining good performance and monitoring capabilities.