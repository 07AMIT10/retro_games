// Utility functions for managing high scores using localStorage

export const getHighScore = (gameKey: string): number => {
  try {
    const stored = localStorage.getItem(gameKey);
    return stored ? parseInt(stored, 10) : 0;
  } catch (error) {
    console.warn('Failed to retrieve high score:', error);
    return 0;
  }
};

export const saveHighScore = (gameKey: string, score: number): void => {
  try {
    const currentHigh = getHighScore(gameKey);
    if (score > currentHigh) {
      localStorage.setItem(gameKey, score.toString());
    }
  } catch (error) {
    console.warn('Failed to save high score:', error);
  }
};

export const getAllHighScores = (): Record<string, number> => {
  const scores: Record<string, number> = {};
  const gameKeys = [
    'snake_high_score',
    'tetris_high_score',
    'pong_high_score',
    'pacman_high_score',
    'space_invaders_high_score',
    'road_racer_high_score',
    'circuit_racer_high_score'
  ];

  gameKeys.forEach(key => {
    scores[key] = getHighScore(key);
  });

  return scores;
};

export const clearAllHighScores = (): void => {
  try {
    const gameKeys = [
      'snake_high_score',
      'tetris_high_score',
      'pong_high_score',
      'pacman_high_score',
      'space_invaders_high_score',
      'road_racer_high_score',
      'circuit_racer_high_score'
    ];

    gameKeys.forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.warn('Failed to clear high scores:', error);
  }
};