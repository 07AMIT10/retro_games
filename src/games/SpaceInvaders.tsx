import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface SpaceInvadersProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 30;
const INVADER_WIDTH = 30;
const INVADER_HEIGHT = 20;
const BULLET_WIDTH = 4;
const BULLET_HEIGHT = 10;

interface Position {
  x: number;
  y: number;
}

interface Bullet extends Position {
  active: boolean;
}

interface Invader extends Position {
  active: boolean;
}

const SpaceInvaders: React.FC<SpaceInvadersProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Position>({ 
    x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, 
    y: CANVAS_HEIGHT - 50 
  });
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [invaders, setInvaders] = useState<Invader[]>([]);
  const [invaderBullets, setInvaderBullets] = useState<Bullet[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState(1);
  const [keys, setKeys] = useState<Set<string>>(new Set());

  const createInvaders = useCallback(() => {
    const newInvaders: Invader[] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 10; col++) {
        newInvaders.push({
          x: 100 + col * 50,
          y: 50 + row * 40,
          active: true
        });
      }
    }
    return newInvaders;
  }, []);

  const resetGame = () => {
    setPlayer({ x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, y: CANVAS_HEIGHT - 50 });
    setBullets([]);
    setInvaders(createInvaders());
    setInvaderBullets([]);
    setScore(0);
    setLives(3);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
  };

  const shoot = useCallback(() => {
    if (gameOver || paused) return;
    
    setBullets(prev => [
      ...prev,
      {
        x: player.x + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2,
        y: player.y,
        active: true
      }
    ]);
  }, [player, gameOver, paused]);

  const updatePlayer = useCallback(() => {
    if (gameOver || paused) return;

    setPlayer(prev => {
      let newX = prev.x;
      
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) {
        newX = Math.max(0, prev.x - 5);
      }
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) {
        newX = Math.min(CANVAS_WIDTH - PLAYER_WIDTH, prev.x + 5);
      }
      
      return { ...prev, x: newX };
    });
  }, [keys, gameOver, paused]);

  const updateBullets = useCallback(() => {
    if (gameOver || paused) return;

    setBullets(prev => 
      prev.map(bullet => ({
        ...bullet,
        y: bullet.y - 8,
        active: bullet.active && bullet.y > 0
      })).filter(bullet => bullet.active)
    );

    setInvaderBullets(prev =>
      prev.map(bullet => ({
        ...bullet,
        y: bullet.y + 4,
        active: bullet.active && bullet.y < CANVAS_HEIGHT
      })).filter(bullet => bullet.active)
    );
  }, [gameOver, paused]);

  const updateInvaders = useCallback(() => {
    if (gameOver || paused) return;

    const activeInvaders = invaders.filter(inv => inv.active);
    if (activeInvaders.length === 0) {
      // Next level
      setLevel(prev => prev + 1);
      setInvaders(createInvaders());
      return;
    }

    // Move invaders
    setInvaders(prev => {
      const rightmost = Math.max(...prev.filter(inv => inv.active).map(inv => inv.x));
      const leftmost = Math.min(...prev.filter(inv => inv.active).map(inv => inv.x));
      const shouldMoveDown = rightmost >= CANVAS_WIDTH - INVADER_WIDTH - 10 || leftmost <= 10;

      return prev.map(invader => {
        if (!invader.active) return invader;
        
        if (shouldMoveDown) {
          return { ...invader, y: invader.y + 20 };
        } else {
          const direction = Math.floor(Date.now() / 1000) % 2 === 0 ? 1 : -1;
          return { ...invader, x: invader.x + direction * 2 };
        }
      });
    });

    // Random invader shooting
    if (Math.random() < 0.002 * level) {
      const activeInvaders = invaders.filter(inv => inv.active);
      if (activeInvaders.length > 0) {
        const shooter = activeInvaders[Math.floor(Math.random() * activeInvaders.length)];
        setInvaderBullets(prev => [
          ...prev,
          {
            x: shooter.x + INVADER_WIDTH / 2,
            y: shooter.y + INVADER_HEIGHT,
            active: true
          }
        ]);
      }
    }
  }, [invaders, gameOver, paused, level, createInvaders]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Player bullets vs invaders
    setBullets(prevBullets => {
      let newBullets = [...prevBullets];
      
      setInvaders(prevInvaders => {
        let newInvaders = [...prevInvaders];
        let pointsEarned = 0;

        newBullets.forEach((bullet, bulletIndex) => {
          if (!bullet.active) return;

          newInvaders.forEach((invader, invaderIndex) => {
            if (!invader.active) return;

            if (
              bullet.x < invader.x + INVADER_WIDTH &&
              bullet.x + BULLET_WIDTH > invader.x &&
              bullet.y < invader.y + INVADER_HEIGHT &&
              bullet.y + BULLET_HEIGHT > invader.y
            ) {
              newBullets[bulletIndex] = { ...bullet, active: false };
              newInvaders[invaderIndex] = { ...invader, active: false };
              pointsEarned += 10;
            }
          });
        });

        if (pointsEarned > 0) {
          setScore(prev => prev + pointsEarned);
        }

        return newInvaders;
      });

      return newBullets.filter(bullet => bullet.active);
    });

    // Invader bullets vs player
    setInvaderBullets(prevBullets => {
      const newBullets = prevBullets.filter(bullet => {
        if (!bullet.active) return false;

        if (
          bullet.x < player.x + PLAYER_WIDTH &&
          bullet.x + BULLET_WIDTH > player.x &&
          bullet.y < player.y + PLAYER_HEIGHT &&
          bullet.y + BULLET_HEIGHT > player.y
        ) {
          setLives(prev => {
            const newLives = prev - 1;
            if (newLives <= 0) {
              setGameOver(true);
              if (onScoreUpdate) {
                onScoreUpdate(score);
              }
            }
            return newLives;
          });
          return false;
        }

        return true;
      });

      return newBullets;
    });

    // Check if invaders reached player
    const activeInvaders = invaders.filter(inv => inv.active);
    const reachedPlayer = activeInvaders.some(invader => 
      invader.y + INVADER_HEIGHT >= player.y
    );

    if (reachedPlayer) {
      setGameOver(true);
      if (onScoreUpdate) {
        onScoreUpdate(score);
      }
    }
  }, [invaders, player, gameOver, paused]);

  useEffect(() => {
    if (invaders.length === 0) {
      setInvaders(createInvaders());
    }
  }, [invaders.length, createInvaders]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      
      if (e.key === ' ') {
        if (gameOver) return;
        if (paused) {
          setPaused(false);
        } else {
          shoot();
        }
        return;
      }
      
      if (e.key === 'p' || e.key === 'P') {
        setPaused(prev => !prev);
        return;
      }
      
      setKeys(prev => new Set(prev).add(e.key));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      setKeys(prev => {
        const newKeys = new Set(prev);
        newKeys.delete(e.key);
        return newKeys;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [shoot, gameOver, paused]);

  useEffect(() => {
    const gameInterval = setInterval(() => {
      updatePlayer();
      updateBullets();
      updateInvaders();
      checkCollisions();
    }, 16); // ~60 FPS

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateBullets, updateInvaders, checkCollisions]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="bg-gray-800 rounded-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="text-white space-x-4">
            <span className="text-lg font-bold">Score: {score}</span>
            <span className="text-lg font-bold">Lives: {lives}</span>
            <span className="text-lg font-bold">Level: {level}</span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPaused(!paused)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded"
              disabled={gameOver}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white p-2 rounded"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className="relative bg-black border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Player */}
          <div
            className="absolute bg-green-400"
            style={{
              left: player.x,
              top: player.y,
              width: PLAYER_WIDTH,
              height: PLAYER_HEIGHT,
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
            }}
          />

          {/* Player bullets */}
          {bullets.map((bullet, index) => (
            <div
              key={`bullet-${index}`}
              className="absolute bg-yellow-400"
              style={{
                left: bullet.x,
                top: bullet.y,
                width: BULLET_WIDTH,
                height: BULLET_HEIGHT
              }}
            />
          ))}

          {/* Invader bullets */}
          {invaderBullets.map((bullet, index) => (
            <div
              key={`invader-bullet-${index}`}
              className="absolute bg-red-400"
              style={{
                left: bullet.x,
                top: bullet.y,
                width: BULLET_WIDTH,
                height: BULLET_HEIGHT
              }}
            />
          ))}

          {/* Invaders */}
          {invaders.filter(inv => inv.active).map((invader, index) => (
            <div
              key={`invader-${index}`}
              className="absolute bg-red-500"
              style={{
                left: invader.x,
                top: invader.y,
                width: INVADER_WIDTH,
                height: INVADER_HEIGHT
              }}
            />
          ))}
        </div>

        <div className="mt-4 text-center text-sm text-gray-400 space-y-1">
          <p><strong>←→</strong> Move • <strong>Space</strong> Shoot • <strong>P</strong> Pause</p>
          <p>Destroy all invaders to advance to the next level!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-xl font-bold mb-2">Game Over!</div>
            <p className="text-white mb-4">Final Score: {score}</p>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              Play Again
            </button>
          </div>
        )}

        {paused && !gameOver && (
          <div className="mt-4 text-center text-yellow-400 text-lg font-bold">
            PAUSED
          </div>
        )}
      </div>
    </div>
  );
};

export default SpaceInvaders;