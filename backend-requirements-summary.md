# Backend Requirements Summary - Retro Games Application

## Current State Analysis

### Data Persistence Current Status
- **Local Storage Only**: All data stored in browser localStorage
- **High Scores**: Only 7 out of 35+ games tracked via central system
- **Inconsistent Patterns**: Game2048 bypasses central scoring system
- **No Cross-Device Sync**: Data tied to single browser
- **No User Profiles**: Completely anonymous usage

### Resource Footprint Assessment
- **Current localStorage usage**: <1KB per user
- **Simple architecture**: 35+ self-contained React game components
- **Minimal dependencies**: React, Tailwind, Lucide icons only
- **No external APIs**: Completely self-contained

## Minimal Backend Requirements (Tier 1)

### Essential API Endpoints
```typescript
// High Score Management
GET  /api/scores/{gameId}           // Retrieve high score
POST /api/scores/{gameId}           // Submit new score
GET  /api/games                     // List all available games

// Optional but valuable
GET  /api/leaderboard/{gameId}?top=10  // Global leaderboards
```

### Data Schema (Minimal)
```sql
-- High Scores Table
scores (
  id: uuid PRIMARY KEY,
  game_id: varchar(50) NOT NULL,
  score: integer NOT NULL,
  created_at: timestamp DEFAULT now(),
  session_id: varchar(50) -- Optional anonymous tracking
);

-- Games Configuration (Optional)
games (
  id: varchar(50) PRIMARY KEY,
  name: varchar(100),
  category: varchar(20),
  enabled: boolean DEFAULT true
);
```

### Resource Requirements
- **Database Storage**: ~50 bytes per score record
- **API Calls**: <100 requests/user/session (mostly reads)
- **Bandwidth**: <1KB per API call
- **Concurrent Users**: 1,000 users = ~50KB total storage/day

## Nice-to-Have Features (Tier 2)

### Game State Persistence
```typescript
// Save/Resume Game State
GET  /api/games/{gameId}/save/{sessionId}
POST /api/games/{gameId}/save/{sessionId}
DELETE /api/games/{gameId}/save/{sessionId}
```

**Storage Impact**: 5-10KB per save state (complex games like Tetris, SpaceInvaders)

### Analytics & Engagement
```typescript
// Usage Analytics
POST /api/analytics/play-session
GET  /api/analytics/popular-games
GET  /api/analytics/user-stats/{sessionId}
```

**Storage Impact**: ~100 bytes per play session

### Enhanced Features
- **Achievement System**: Track milestones and unlocks
- **Tournament Mode**: Time-limited competitions  
- **Social Features**: Share scores, challenges
- **Progressive Unlock**: Earn access to games

## Implementation Priority Matrix

### Phase 1: Foundation (Week 1-2)
**Priority**: CRITICAL for free deployment
- ✅ Unified high score API (all 35+ games)
- ✅ Simple leaderboards (top 10 per game)
- ✅ Anonymous session tokens
- **Resource Cost**: <1MB total storage for 1,000 users

### Phase 2: Enhancement (Month 1-2)
**Priority**: HIGH for user retention
- 🔄 Game state save/resume for complex games
- 🔄 Play session analytics
- 🔄 Popular games tracking
- **Resource Cost**: <50MB total storage for 1,000 users

### Phase 3: Engagement (Month 2-3)
**Priority**: MEDIUM for growth
- ⭐ Achievement system
- ⭐ Tournament/competition features
- ⭐ Social sharing
- **Resource Cost**: <100MB total storage for 1,000 users

## Free Tier Deployment Strategy

### Recommended Stack
1. **Database**: Supabase (500MB free), or Railway PostgreSQL
2. **Backend**: Vercel Functions (100GB-hours/month free)
3. **CDN**: Vercel Edge Network (100GB bandwidth free)
4. **Alternative**: Single Railway app with PostgreSQL

### Resource Optimization
- **Caching**: Use Vercel Edge caching for leaderboards
- **Rate Limiting**: 100 requests/hour per IP
- **Data Retention**: Archive old scores after 1 year
- **Compression**: Gzip all API responses

## Frontend Integration Requirements

### New Service Layer
```typescript
// Abstract storage service
class GameDataService {
  async getHighScore(gameId: string): Promise<number>
  async saveHighScore(gameId: string, score: number): Promise<void>
  async getLeaderboard(gameId: string): Promise<ScoreEntry[]>
  
  // Fallback to localStorage when offline
  private localStorage: LocalStorageService
}
```

### Offline-First Design
- **Progressive Enhancement**: Backend enhances, doesn't replace localStorage
- **Graceful Degradation**: Works fully offline
- **Sync Strategy**: Upload local scores when connection restored

### Required Code Changes
1. **Replace direct localStorage**: Abstract through service layer
2. **Add loading states**: Show pending score submissions  
3. **Error handling**: Graceful fallback to local storage
4. **Migration**: Move existing localStorage scores to backend

## Cost-Benefit Analysis

### Free Tier Limits (Conservative Estimates)
- **Supabase**: 500MB DB, 2GB bandwidth/month
- **Vercel**: 100GB-hours functions, 100GB bandwidth  
- **Estimated Capacity**: 5,000-10,000 active users/month

### User Value Delivered
- ✅ **Cross-device high scores**: Play on phone, continue on desktop
- ✅ **Global competition**: See how you rank globally
- ✅ **Data persistence**: Never lose progress again
- ✅ **Game discovery**: Popular games recommendations

### Development Investment
- **Phase 1**: ~20-30 hours (minimal backend + frontend integration)
- **Phase 2**: ~40-50 hours (save states + analytics)
- **Phase 3**: ~60-80 hours (achievements + social features)

## Conclusion

**Recommended Approach**: Start with Phase 1 (unified high scores + leaderboards) as it:
- Provides immediate user value
- Requires minimal resources (fits comfortably in free tiers)
- Creates foundation for future enhancements
- Maintains current offline functionality as fallback

**Key Success Metrics**:
- User retention improvement (return visits)
- Cross-device usage increase
- Engagement with leaderboards
- Successful free tier resource utilization

The architecture is well-positioned for incremental backend integration without disrupting the current excellent user experience.