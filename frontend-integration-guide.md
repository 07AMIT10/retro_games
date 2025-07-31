# Frontend Integration Guide - localStorage to Backend Migration

## Overview

This guide outlines how to integrate the Go backend with the existing React frontend, providing seamless migration from localStorage to the backend API while maintaining offline-first functionality.

## 1. Frontend Service Layer Architecture

### API Client Service

```typescript
// src/services/api-client.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ScoreEntry {
  game_id: string;
  score: number;
  personal_best: number;
  rank?: number;
  achieved_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  score: number;
  session_id?: string;
  achieved_at: string;
}

export interface SessionInfo {
  session_token: string;
  created_at: string;
}

class ApiClient {
  private baseUrl: string;
  private sessionToken: string | null = null;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
    this.loadSessionToken();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (this.sessionToken) {
        headers['X-Session-Token'] = this.sessionToken;
      }

      const response = await fetch(url, {
        ...options,
        headers,
        timeout: 10000, // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.warn('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Session Management
  async createSession(): Promise<ApiResponse<SessionInfo>> {
    const response = await this.request<SessionInfo>('/sessions', {
      method: 'POST',
    });

    if (response.success && response.data) {
      this.sessionToken = response.data.session_token;
      this.saveSessionToken();
    }

    return response;
  }

  async validateSession(): Promise<boolean> {
    if (!this.sessionToken) return false;

    const response = await this.request('/sessions/validate');
    return response.success;
  }

  // Game Management
  async getGames(): Promise<ApiResponse<any[]>> {
    return this.request('/games');
  }

  // Score Management
  async getHighScore(gameId: string): Promise<ApiResponse<ScoreEntry>> {
    return this.request(`/games/${gameId}/score`);
  }

  async submitScore(gameId: string, score: number): Promise<ApiResponse<ScoreEntry>> {
    return this.request(`/games/${gameId}/score`, {
      method: 'POST',
      body: JSON.stringify({ score }),
    });
  }

  async getLeaderboard(
    gameId: string,
    limit: number = 10
  ): Promise<ApiResponse<{ entries: LeaderboardEntry[]; total: number }>> {
    return this.request(`/games/${gameId}/leaderboard?limit=${limit}`);
  }

  // Game State Management (Phase 2)
  async saveGameState(gameId: string, state: any): Promise<ApiResponse<void>> {
    return this.request(`/games/${gameId}/save`, {
      method: 'POST',
      body: JSON.stringify({ state_data: state }),
    });
  }

  async loadGameState(gameId: string): Promise<ApiResponse<any>> {
    return this.request(`/games/${gameId}/save`);
  }

  async deleteGameState(gameId: string): Promise<ApiResponse<void>> {
    return this.request(`/games/${gameId}/save`, {
      method: 'DELETE',
    });
  }

  // Private helpers
  private loadSessionToken(): void {
    this.sessionToken = localStorage.getItem('session_token');
  }

  private saveSessionToken(): void {
    if (this.sessionToken) {
      localStorage.setItem('session_token', this.sessionToken);
    }
  }
}

export const apiClient = new ApiClient();
```

## 2. Enhanced Game Data Service

```typescript
// src/services/game-data-service.ts
import { apiClient, type ScoreEntry, type LeaderboardEntry } from './api-client';
import { getHighScore as getLocalHighScore, saveHighScore as saveLocalHighScore } from '../utils/scoring';

export interface GameDataService {
  getHighScore(gameId: string): Promise<number>;
  saveHighScore(gameId: string, score: number): Promise<void>;
  getLeaderboard(gameId: string, limit?: number): Promise<LeaderboardEntry[]>;
  getPersonalRank(gameId: string): Promise<number | null>;
}

class BackendGameDataService implements GameDataService {
  private fallbackToLocal = true;

  constructor() {
    this.initializeSession();
  }

  private async initializeSession(): Promise<void> {
    try {
      const isValid = await apiClient.validateSession();
      if (!isValid) {
        await apiClient.createSession();
      }
      this.fallbackToLocal = false;
    } catch (error) {
      console.warn('Failed to initialize backend session, using localStorage fallback');
      this.fallbackToLocal = true;
    }
  }

  async getHighScore(gameId: string): Promise<number> {
    if (this.fallbackToLocal) {
      return getLocalHighScore(this.convertGameIdToLocalKey(gameId));
    }

    try {
      const response = await apiClient.getHighScore(gameId);
      if (response.success && response.data) {
        return response.data.personal_best;
      }
    } catch (error) {
      console.warn(`Failed to get backend high score for ${gameId}:`, error);
    }

    // Fallback to localStorage
    return getLocalHighScore(this.convertGameIdToLocalKey(gameId));
  }

  async saveHighScore(gameId: string, score: number): Promise<void> {
    // Always save locally first (immediate feedback)
    const localKey = this.convertGameIdToLocalKey(gameId);
    saveLocalHighScore(localKey, score);

    if (this.fallbackToLocal) {
      return;
    }

    try {
      const response = await apiClient.submitScore(gameId, score);
      if (response.success) {
        console.log(`Score ${score} saved to backend for ${gameId}`);
      }
    } catch (error) {
      console.warn(`Failed to save score to backend for ${gameId}:`, error);
      // Local save already completed, so this is fine
    }
  }

  async getLeaderboard(gameId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    if (this.fallbackToLocal) {
      return []; // No leaderboard in localStorage mode
    }

    try {
      const response = await apiClient.getLeaderboard(gameId, limit);
      if (response.success && response.data) {
        return response.data.entries;
      }
    } catch (error) {
      console.warn(`Failed to get leaderboard for ${gameId}:`, error);
    }

    return [];
  }

  async getPersonalRank(gameId: string): Promise<number | null> {
    if (this.fallbackToLocal) {
      return null;
    }

    try {
      const response = await apiClient.getHighScore(gameId);
      if (response.success && response.data && response.data.rank) {
        return response.data.rank;
      }
    } catch (error) {
      console.warn(`Failed to get personal rank for ${gameId}:`, error);
    }

    return null;
  }

  private convertGameIdToLocalKey(gameId: string): string {
    return `${gameId.replace('-', '_')}_high_score`;
  }
}

// Singleton instance
export const gameDataService = new BackendGameDataService();
```

## 3. Data Migration Service

```typescript
// src/services/migration-service.ts
import { apiClient } from './api-client';
import { getAllHighScores, clearAllHighScores } from '../utils/scoring';

interface MigrationResult {
  migrated: string[];
  failed: string[];
  total: number;
}

class MigrationService {
  async migrateLocalScoresToBackend(): Promise<MigrationResult> {
    const result: MigrationResult = {
      migrated: [],
      failed: [],
      total: 0,
    };

    try {
      // Ensure we have a session
      const sessionResponse = await apiClient.createSession();
      if (!sessionResponse.success) {
        throw new Error('Failed to create backend session');
      }

      // Get all local scores
      const localScores = getAllHighScores();
      const gameIdMapping = this.createGameIdMapping();

      result.total = Object.keys(localScores).length;

      for (const [localKey, score] of Object.entries(localScores)) {
        const gameId = gameIdMapping[localKey];
        if (!gameId) {
          console.warn(`No game ID mapping found for local key: ${localKey}`);
          result.failed.push(localKey);
          continue;
        }

        try {
          const response = await apiClient.submitScore(gameId, score);
          if (response.success) {
            result.migrated.push(gameId);
            console.log(`Migrated ${localKey}: ${score} -> ${gameId}`);
          } else {
            result.failed.push(gameId);
            console.warn(`Failed to migrate ${localKey}:`, response.error);
          }
        } catch (error) {
          result.failed.push(gameId);
          console.warn(`Error migrating ${localKey}:`, error);
        }

        // Small delay to avoid overwhelming the backend
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // If migration was successful, optionally clear local storage
      if (result.failed.length === 0 && result.migrated.length > 0) {
        const shouldClear = confirm(
          `Successfully migrated ${result.migrated.length} scores to the cloud. Clear local storage?`
        );
        if (shouldClear) {
          clearAllHighScores();
        }
      }

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }

    return result;
  }

  private createGameIdMapping(): Record<string, string> {
    return {
      'snake_high_score': 'snake',
      'tetris_high_score': 'tetris',
      'pong_high_score': 'pong',
      'pacman_high_score': 'pacman',
      'space_invaders_high_score': 'space-invaders',
      'road_racer_high_score': 'road-racer',
      'circuit_racer_high_score': 'circuit-racer',
      'frogger_high_score': 'frogger',
      'centipede_high_score': 'centipede',
      'asteroids_high_score': 'asteroids',
      'breakout_high_score': 'breakout',
      'missile_command_high_score': 'missile-command',
      '2048_high_score': '2048',
      'sokoban_high_score': 'sokoban',
      'connect_four_high_score': 'connect-four',
      'sudoku_high_score': 'sudoku',
      'match3_high_score': 'match3',
      'sliding_puzzle_high_score': 'sliding-puzzle',
      'basketball_high_score': 'basketball',
      'tennis_high_score': 'tennis',
      'air_hockey_high_score': 'air-hockey',
      'bowling_high_score': 'bowling',
      'golf_high_score': 'golf',
      'soccer_high_score': 'soccer',
      'galaga_high_score': 'galaga',
      'defender_high_score': 'defender',
      'phoenix_high_score': 'phoenix',
      'centipede_shooter_high_score': 'centipede-shooter',
      'missile_defense_high_score': 'missile-defense',
      'laser_defense_high_score': 'laser-defense',
      'f1_racing_high_score': 'f1-racing',
      'drag_racing_high_score': 'drag-racing',
      'mountain_racing_high_score': 'mountain-racing',
      'desert_rally_high_score': 'desert-rally',
      'speed_chase_high_score': 'speed-chase',
    };
  }

  async showMigrationPrompt(): Promise<void> {
    const localScores = getAllHighScores();
    const hasLocalScores = Object.keys(localScores).length > 0;

    if (!hasLocalScores) {
      return;
    }

    const shouldMigrate = confirm(
      `Found ${Object.keys(localScores).length} local high scores. ` +
      'Would you like to sync them to the cloud for cross-device access?'
    );

    if (shouldMigrate) {
      try {
        const result = await this.migrateLocalScoresToBackend();
        alert(
          `Migration complete!\n` +
          `✅ Migrated: ${result.migrated.length}\n` +
          `❌ Failed: ${result.failed.length}\n` +
          `📊 Total: ${result.total}`
        );
      } catch (error) {
        alert('Migration failed. Your local scores are still safe.');
        console.error('Migration error:', error);
      }
    }
  }
}

export const migrationService = new MigrationService();
```

## 4. Updated App.tsx Integration

```typescript
// src/App.tsx (updated sections)
import React, { useState, useEffect } from 'react';
import { gameDataService } from './services/game-data-service';
import { migrationService } from './services/migration-service';

function App() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [highScores, setHighScores] = useState<Record<string, number>>({});
  const [leaderboards, setLeaderboards] = useState<Record<string, any[]>>({});
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    // Load high scores for all games
    const scores: Record<string, number> = {};
    
    for (const game of games) {
      try {
        const score = await gameDataService.getHighScore(game.id);
        scores[game.id] = score;
      } catch (error) {
        console.warn(`Failed to load high score for ${game.id}:`, error);
        scores[game.id] = 0;
      }
    }
    
    setHighScores(scores);

    // Check if migration is needed
    setTimeout(() => {
      migrationService.showMigrationPrompt();
    }, 2000); // Show after 2 seconds
  };

  const handleScoreUpdate = async (gameId: string, score: number) => {
    try {
      await gameDataService.saveHighScore(gameId, score);
      
      // Update local state
      const currentHigh = highScores[gameId] || 0;
      if (score > currentHigh) {
        setHighScores(prev => ({ ...prev, [gameId]: score }));
        
        // Refresh leaderboard for this game
        refreshLeaderboard(gameId);
      }
    } catch (error) {
      console.warn(`Failed to save score for ${gameId}:`, error);
    }
  };

  const refreshLeaderboard = async (gameId: string) => {
    try {
      const leaderboard = await gameDataService.getLeaderboard(gameId, 10);
      setLeaderboards(prev => ({ ...prev, [gameId]: leaderboard }));
    } catch (error) {
      console.warn(`Failed to load leaderboard for ${gameId}:`, error);
    }
  };

  // Rest of component remains the same...
}
```

## 5. Enhanced Game Component Interface

```typescript
// Updated game component props interface
interface GameComponentProps {
  onScoreUpdate?: (score: number) => void;
  onGameStateChange?: (state: any) => void; // For Phase 2
  initialGameState?: any; // For Phase 2
}

// Example: Updated Snake component
const Snake: React.FC<GameComponentProps> = ({ 
  onScoreUpdate, 
  onGameStateChange,
  initialGameState 
}) => {
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState(initialGameState || defaultState);

  // When score changes
  useEffect(() => {
    if (onScoreUpdate && score > 0) {
      onScoreUpdate(score);
    }
  }, [score, onScoreUpdate]);

  // When game state changes (Phase 2)
  useEffect(() => {
    if (onGameStateChange) {
      onGameStateChange(gameState);
    }
  }, [gameState, onGameStateChange]);

  // Rest of game logic...
};
```

## 6. Leaderboard Component

```typescript
// src/components/Leaderboard.tsx
import React, { useState, useEffect } from 'react';
import { gameDataService, type LeaderboardEntry } from '../services/game-data-service';

interface LeaderboardProps {
  gameId: string;
  visible: boolean;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ gameId, visible }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && gameId) {
      loadLeaderboard();
    }
  }, [visible, gameId]);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const leaderboard = await gameDataService.getLeaderboard(gameId, 10);
      setEntries(leaderboard);
    } catch (err) {
      setError('Failed to load leaderboard');
      console.error('Leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4">
      <h3 className="text-lg font-bold text-white mb-3">🏆 Leaderboard</h3>
      
      {loading && (
        <div className="text-gray-400">Loading leaderboard...</div>
      )}
      
      {error && (
        <div className="text-red-400">{error}</div>
      )}
      
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div
              key={index}
              className="flex justify-between items-center bg-gray-700 rounded px-3 py-2"
            >
              <div className="flex items-center space-x-3">
                <span className="text-yellow-400 font-bold">#{entry.rank}</span>
                <span className="text-gray-300">Player</span>
              </div>
              <div className="text-white font-mono">{entry.score.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
      
      {entries.length === 0 && !loading && !error && (
        <div className="text-gray-400">No scores yet. Be the first!</div>
      )}
      
      <button
        onClick={loadLeaderboard}
        className="mt-3 text-blue-400 hover:text-blue-300 text-sm"
      >
        Refresh
      </button>
    </div>
  );
};

export default Leaderboard;
```

## 7. Environment Configuration

```typescript
// src/config/environment.ts
export const config = {
  apiUrl: process.env.REACT_APP_API_URL || '/api',
  enableBackend: process.env.REACT_APP_ENABLE_BACKEND !== 'false',
  migrationEnabled: process.env.REACT_APP_MIGRATION_ENABLED !== 'false',
  debug: process.env.NODE_ENV === 'development',
};
```

## 8. Build Configuration Updates

```json
// package.json additions
{
  "scripts": {
    "build:dev": "REACT_APP_API_URL=http://localhost:8080/api npm run build",
    "build:prod": "REACT_APP_API_URL=/api npm run build"
  }
}
```

## 9. Deployment Integration

### Frontend Build with Backend API URL

```bash
# For development
REACT_APP_API_URL=http://localhost:8080/api npm run build

# For production (same domain)
REACT_APP_API_URL=/api npm run build

# For production (different domain)
REACT_APP_API_URL=https://retro-games-api.render.com/api npm run build
```

### Render Static Site Configuration

```yaml
# render.yaml (updated for frontend)
services:
  - type: static
    name: retro-games-frontend
    buildCommand: npm install && npm run build:prod
    staticPublishPath: ./dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    headers:
      - path: /*
        name: Cache-Control
        value: public, max-age=3600
      - path: /static/*
        name: Cache-Control
        value: public, max-age=31536000
```

This integration guide provides a seamless migration path from localStorage to the backend while maintaining the offline-first approach and excellent user experience.