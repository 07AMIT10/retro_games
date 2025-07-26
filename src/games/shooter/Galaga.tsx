import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface GalagaProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 700;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 30;
const ENEMY_WIDTH = 30;
const ENEMY_HEIGHT = 20;
const BULLET_SIZE = 4;

interface Position {
  x: number;
  y: number;
}

interface Bullet extends Position {
  active: boolean;
  speed: number;
}

interface Enemy extends Position {
  type: 'bee' | 'butterfly' | 'boss';
  active: boolean;
  formation: boolean;
  angle: number;
  speed: number;
}

const Galaga: React.FC<GalagaProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Position>({ 
    x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, 
    y: CANVAS_HEIGHT - 50 
  });
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [enemyBullets, setEnemyBullets] = useState<Bullet[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [waveComplete, setWaveComplete] = useState(false);

  const createEnemies = useCallback(() => {
    const newEnemies: Enemy[] = [];
    
    // Create formation
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 8; col++) {
        const enemyType: Enemy['type'] = row === 0 ? 'boss' : row <= 2 ? 'butterfly' : 'bee';
        newEnemies.push({
          x: 100 + col * 50,
          y: 100 + row * 40,
          type: enemyType,
          active: true,
          formation: true,
          angle: 0,
          speed: 1
        });
      }
    }
    
    return newEnemies;
  }, []);

  const shoot = useCallback(() => {
    if (gameOver || paused || bullets.length >= 3) return;
    
    setBullets(prev => [
      ...prev,
      {
        x: player.x + PLAYER_WIDTH / 2,
        y: player.y,
        active: true,
        speed: 8
      }
    ]);
  }, [player, bullets.length, gameOver, paused]);

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
        y: bullet.y - bullet.speed,
        active: bullet.active && bullet.y > 0
      })).filter(bullet => bullet.active)
    );

    setEnemyBullets(prev =>
      prev.map(bullet => ({
        ...bullet,
        y: bullet.y + bullet.speed,
        active: bullet.active && bullet.y < CANVAS_HEIGHT
      })).filter(bullet => bullet.active)
    );
  }, [gameOver, paused]);

  const updateEnemies = useCallback(() => {
    if (gameOver || paused) return;

    setEnemies(prev => {
      const activeEnemies = prev.filter(enemy => enemy.active);
      
      if (activeEnemies.length === 0) {
        setWaveComplete(true);
        setTimeout(() => {
          setLevel(prevLevel => prevLevel + 1);
          setWaveComplete(false);
        }, 2000);
        return createEnemies();
      }

      return prev.map(enemy => {
        if (!enemy.active) return enemy;

        if (enemy.formation) {
          // Formation flying pattern
          const time = Date.now() / 1000;
          return {
            ...enemy,
            x: enemy.x + Math.sin(time + enemy.x * 0.01) * 0.5,
            y: enemy.y + Math.sin(time * 0.5) * 0.2
          };
        } else {
          // Attack pattern
          return {
            ...enemy,
            x: enemy.x + Math.cos(enemy.angle) * enemy.speed,
            y: enemy.y + Math.sin(enemy.angle) * enemy.speed,
            angle: enemy.angle + 0.1
          };
        }
      });
    });

    // Random enemy shooting
    if (Math.random() < 0.005) {
      const activeEnemies = enemies.filter(enemy => enemy.active);
      if (activeEnemies.length > 0) {
        const shooter = activeEnemies[Math.floor(Math.random() * activeEnemies.length)];
        setEnemyBullets(prev => [
          ...prev,
          {
            x: shooter.x + ENEMY_WIDTH / 2,
            y: shooter.y + ENEMY_HEIGHT,
            active: true,
            speed: 3
          }
        ]);
      }
    }

    // Random enemy attack (dive bombing)
    if (Math.random() < 0.001) {
      setEnemies(prev => prev.map(enemy => {
        if (enemy.active && enemy.formation && Math.random() < 0.1) {
          return {
            ...enemy,
            formation: false,
            angle: Math.atan2(player.y - enemy.y, player.x - enemy.x),
            speed: 2
          };
        }
        return enemy;
      }));
    }
  }, [enemies, gameOver, paused, createEnemies, player, level]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Player bullets vs enemies
    setBullets(prevBullets => {
      let newBullets = [...prevBullets];
      
      setEnemies(prevEnemies => {
        let newEnemies = [...prevEnemies];
        let pointsEarned = 0;

        newBullets.forEach((bullet, bulletIndex) => {
          if (!bullet.active) return;

          newEnemies.forEach((enemy, enemyIndex) => {
            if (!enemy.active) return;

            if (
              bullet.x >= enemy.x && 
              bullet.x <= enemy.x + ENEMY_WIDTH &&
              bullet.y >= enemy.y && 
              bullet.y <= enemy.y + ENEMY_HEIGHT
            ) {
              newBullets[bulletIndex] = { ...bullet, active: false };
              newEnemies[enemyIndex] = { ...enemy, active: false };
              
              const points = enemy.type === 'boss' ? 150 : 
                           enemy.type === 'butterfly' ? 80 : 50;
              pointsEarned += points * level;
            }
          });
        });

        if (pointsEarned > 0) {
          setScore(prev => prev + pointsEarned);
        }

        return newEnemies;
      });

      return newBullets.filter(bullet => bullet.active);
    });

    // Enemy bullets vs player
    setEnemyBullets(prevBullets => {
      const newBullets = prevBullets.filter(bullet => {
        if (!bullet.active) return false;

        if (
          bullet.x >= player.x && 
          bullet.x <= player.x + PLAYER_WIDTH &&
          bullet.y >= player.y && 
          bullet.y <= player.y + PLAYER_HEIGHT
        ) {
          setLives(prev => {
            const newLives = prev - 1;
            if (newLives <= 0) {
              setGameOver(true);
              if (onScoreUpdate) onScoreUpdate(score);
            }
            return newLives;
          });
          return false;
        }

        return true;
      });

      return newBullets;
    });

    // Enemy vs player collision
    const enemyHit = enemies.some(enemy => 
      enemy.active &&
      enemy.x < player.x + PLAYER_WIDTH &&
      enemy.x + ENEMY_WIDTH > player.x &&
      enemy.y < player.y + PLAYER_HEIGHT &&
      enemy.y + ENEMY_HEIGHT > player.y
    );

    if (enemyHit) {
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setGameOver(true);
          if (onScoreUpdate) onScoreUpdate(score);
        }
        return newLives;
      });
    }
  }, [enemies, player, gameOver, paused, score, level, onScoreUpdate]);

  const resetGame = () => {
    setPlayer({ x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, y: CANVAS_HEIGHT - 50 });
    setBullets([]);
    setEnemies(createEnemies());
    setEnemyBullets([]);
    setScore(0);
    setLives(3);
    setLevel(1);
    setWaveComplete(false);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (enemies.length === 0) {
      setEnemies(createEnemies());
    }
  }, [enemies.length, createEnemies]);

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
      updateEnemies();
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateBullets, updateEnemies, checkCollisions]);

  const getEnemyColor = (type: Enemy['type']) => {
    switch (type) {
      case 'boss': return 'bg-red-500';
      case 'butterfly': return 'bg-blue-500';
      case 'bee': return 'bg-yellow-500';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">GALAGA</div>
            <div className="text-sm">Score: {score} | Lives: {lives} | Level: {level}</div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPaused(!paused)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded border border-cyan-400"
              disabled={gameOver}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white p-2 rounded border border-cyan-400"
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
              className="absolute bg-yellow-400 rounded-full"
              style={{
                left: bullet.x - BULLET_SIZE / 2,
                top: bullet.y - BULLET_SIZE / 2,
                width: BULLET_SIZE,
                height: BULLET_SIZE
              }}
            />
          ))}

          {/* Enemy bullets */}
          {enemyBullets.map((bullet, index) => (
            <div
              key={`enemy-bullet-${index}`}
              className="absolute bg-red-400 rounded-full"
              style={{
                left: bullet.x - BULLET_SIZE / 2,
                top: bullet.y - BULLET_SIZE / 2,
                width: BULLET_SIZE,
                height: BULLET_SIZE
              }}
            />
          ))}

          {/* Enemies */}
          {enemies.filter(enemy => enemy.active).map((enemy, index) => (
            <div
              key={`enemy-${index}`}
              className={`absolute ${getEnemyColor(enemy.type)} rounded`}
              style={{
                left: enemy.x,
                top: enemy.y,
                width: ENEMY_WIDTH,
                height: ENEMY_HEIGHT,
                transform: enemy.formation ? 'none' : `rotate(${enemy.angle}rad)`
              }}
            />
          ))}

          {waveComplete && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-green-400 text-3xl font-bold retro-font animate-pulse">
                STAGE {level} CLEAR!
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>←→ Move • Space - Shoot • Watch for diving attacks!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">GAME OVER!</div>
            <p className="text-cyan-400 mb-4 retro-font">Final Score: {score}</p>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-bold border-2 border-cyan-400"
            >
              PLAY AGAIN
            </button>
          </div>
        )}

        {paused && !gameOver && (
          <div className="mt-4 text-center text-yellow-400 text-xl font-bold retro-font">
            PAUSED
          </div>
        )}
      </div>
    </div>
  );
};

export default Galaga;