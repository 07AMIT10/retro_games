import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface PhoenixProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 700;
const PLAYER_SIZE = 30;
const BULLET_SIZE = 4;
const PHOENIX_SIZE = 25;

interface Position {
  x: number;
  y: number;
}

interface Bullet extends Position {
  active: boolean;
  vy: number;
}

interface Phoenix extends Position {
  active: boolean;
  vx: number;
  vy: number;
  type: 'bird' | 'egg' | 'boss';
  health: number;
  angle: number;
  points: number;
  hatchTimer?: number;
}

const PhoenixGame: React.FC<PhoenixProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Position>({ 
    x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, 
    y: CANVAS_HEIGHT - 50 
  });
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [phoenixes, setPhoenixes] = useState<Phoenix[]>([]);
  const [phoenixBullets, setPhoenixBullets] = useState<Bullet[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [waveType, setWaveType] = useState<'birds' | 'eggs' | 'boss'>('birds');
  const [waveComplete, setWaveComplete] = useState(false);

  const createWave = useCallback(() => {
    const newPhoenixes: Phoenix[] = [];
    
    if (waveType === 'birds') {
      // Flying phoenix birds
      const birdCount = 8 + Math.floor(level / 2);
      for (let i = 0; i < birdCount; i++) {
        newPhoenixes.push({
          x: Math.random() * (CANVAS_WIDTH - PHOENIX_SIZE),
          y: 50 + Math.random() * 100,
          active: true,
          vx: (Math.random() - 0.5) * 4,
          vy: 1 + Math.random(),
          type: 'bird',
          health: 1,
          angle: 0,
          points: 100
        });
      }
    } else if (waveType === 'eggs') {
      // Phoenix eggs that hatch
      const eggCount = 6 + Math.floor(level / 3);
      for (let i = 0; i < eggCount; i++) {
        newPhoenixes.push({
          x: 100 + i * 80,
          y: 50 + Math.random() * 100,
          active: true,
          vx: 0,
          vy: 1,
          type: 'egg',
          health: 2,
          angle: 0,
          points: 200,
          hatchTimer: 300 + Math.random() * 200
        });
      }
    } else {
      // Boss phoenix
      newPhoenixes.push({
        x: CANVAS_WIDTH / 2,
        y: 80,
        active: true,
        vx: 2,
        vy: 0,
        type: 'boss',
        health: 15 + level * 3,
        angle: 0,
        points: 500
      });
    }
    
    return newPhoenixes;
  }, [waveType, level]);

  const shoot = useCallback(() => {
    if (gameOver || paused || bullets.length >= 4) return;
    
    setBullets(prev => [
      ...prev,
      {
        x: player.x + PLAYER_SIZE / 2,
        y: player.y,
        active: true,
        vy: -10
      }
    ]);
  }, [player, bullets.length, gameOver, paused]);

  const updatePlayer = useCallback(() => {
    if (gameOver || paused) return;

    setPlayer(prev => {
      let newX = prev.x;
      
      if (keys.has('ArrowLeft')) {
        newX = Math.max(0, prev.x - 7);
      }
      if (keys.has('ArrowRight')) {
        newX = Math.min(CANVAS_WIDTH - PLAYER_SIZE, prev.x + 7);
      }
      
      return { ...prev, x: newX };
    });
  }, [keys, gameOver, paused]);

  const updateBullets = useCallback(() => {
    if (gameOver || paused) return;

    setBullets(prev => 
      prev.map(bullet => ({
        ...bullet,
        y: bullet.y + bullet.vy,
        active: bullet.active && bullet.y > 0
      })).filter(bullet => bullet.active)
    );

    setPhoenixBullets(prev =>
      prev.map(bullet => ({
        ...bullet,
        y: bullet.y + bullet.vy,
        active: bullet.active && bullet.y < CANVAS_HEIGHT
      })).filter(bullet => bullet.active)
    );
  }, [gameOver, paused]);

  const updatePhoenixes = useCallback(() => {
    if (gameOver || paused) return;

    setPhoenixes(prev => {
      const activePhoenixes = prev.filter(p => p.active);
      
      if (activePhoenixes.length === 0) {
        setWaveComplete(true);
        setTimeout(() => {
          // Next wave
          if (waveType === 'birds') {
            setWaveType('eggs');
          } else if (waveType === 'eggs') {
            setWaveType('boss');
          } else {
            setWaveType('birds');
            setLevel(prevLevel => prevLevel + 1);
          }
          setWaveComplete(false);
        }, 2000);
        return createWave();
      }

      return prev.map(phoenix => {
        if (!phoenix.active) return phoenix;

        const newX = phoenix.x + phoenix.vx;
        let newY = phoenix.y + phoenix.vy;
        let newVx = phoenix.vx;
        let newVy = phoenix.vy;
        const newAngle = phoenix.angle + 0.1;
        let newHatchTimer = phoenix.hatchTimer;

        if (phoenix.type === 'bird') {
          // Flying pattern with diving attacks
          newY += Math.sin(newAngle) * 2;
          
          if (newX <= 0 || newX >= CANVAS_WIDTH - PHOENIX_SIZE) {
            newVx = -newVx;
          }
          
          // Random diving attack
          if (Math.random() < 0.005) {
            newVy = 3;
            newVx = (player.x - phoenix.x) * 0.02;
          }
          
          // Return to normal flight after diving
          if (newY > CANVAS_HEIGHT / 2) {
            newVy = -1;
          }
        } else if (phoenix.type === 'egg') {
          // Slow downward movement and hatching
          if (newHatchTimer && newHatchTimer > 0) {
            newHatchTimer--;
          } else if (newY > CANVAS_HEIGHT / 2) {
            // Hatch into bird
            return {
              ...phoenix,
              type: 'bird',
              vx: Math.random() > 0.5 ? 2 : -2,
              vy: 0,
              health: 1,
              points: 100
            };
          }
        } else if (phoenix.type === 'boss') {
          // Boss movement pattern
          newY += Math.sin(newAngle * 0.5) * 1;
          
          if (newX <= 50 || newX >= CANVAS_WIDTH - 50) {
            newVx = -newVx;
          }
          
          // Boss shooting pattern
          if (Math.random() < 0.03) {
            const spreadCount = 3;
            for (let i = 0; i < spreadCount; i++) {
              const angle = -Math.PI/2 + (i - 1) * 0.3;
              setPhoenixBullets(prevBullets => [
                ...prevBullets,
                {
                  x: phoenix.x + PHOENIX_SIZE / 2,
                  y: phoenix.y + PHOENIX_SIZE,
                  active: true,
                  vy: 4 * Math.sin(angle) + 3
                }
              ]);
            }
          }
        }

        return {
          ...phoenix,
          x: newX,
          y: newY,
          vx: newVx,
          vy: newVy,
          angle: newAngle,
          hatchTimer: newHatchTimer
        };
      });
    });

    // Regular phoenix shooting
    if (Math.random() < 0.01) {
      const activePhoenixes = phoenixes.filter(p => p.active && p.type !== 'egg');
      if (activePhoenixes.length > 0) {
        const shooter = activePhoenixes[Math.floor(Math.random() * activePhoenixes.length)];
        setPhoenixBullets(prev => [
          ...prev,
          {
            x: shooter.x + PHOENIX_SIZE / 2,
            y: shooter.y + PHOENIX_SIZE,
            active: true,
            vy: 3
          }
        ]);
      }
    }
  }, [phoenixes, waveType, gameOver, paused, player, createWave, level]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Player bullets vs phoenixes
    setBullets(prevBullets => {
      const newBullets = [...prevBullets];
      
      setPhoenixes(prevPhoenixes => {
        const newPhoenixes = [...prevPhoenixes];
        let pointsEarned = 0;

        newBullets.forEach((bullet, bulletIndex) => {
          if (!bullet.active) return;

          newPhoenixes.forEach((phoenix, phoenixIndex) => {
            if (!phoenix.active) return;

            if (
              bullet.x >= phoenix.x && 
              bullet.x <= phoenix.x + PHOENIX_SIZE &&
              bullet.y >= phoenix.y && 
              bullet.y <= phoenix.y + PHOENIX_SIZE
            ) {
              newBullets[bulletIndex] = { ...bullet, active: false };
              newPhoenixes[phoenixIndex] = { 
                ...phoenix, 
                health: phoenix.health - 1 
              };
              
              if (newPhoenixes[phoenixIndex].health <= 0) {
                newPhoenixes[phoenixIndex].active = false;
                pointsEarned += phoenix.points * level;
              }
            }
          });
        });

        if (pointsEarned > 0) {
          setScore(prev => prev + pointsEarned);
        }

        return newPhoenixes;
      });

      return newBullets.filter(bullet => bullet.active);
    });

    // Phoenix bullets vs player
    setPhoenixBullets(prevBullets => {
      const newBullets = prevBullets.filter(bullet => {
        if (!bullet.active) return false;

        if (
          bullet.x >= player.x && 
          bullet.x <= player.x + PLAYER_SIZE &&
          bullet.y >= player.y && 
          bullet.y <= player.y + PLAYER_SIZE
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

    // Phoenix vs player collision
    const phoenixHit = phoenixes.some(phoenix => 
      phoenix.active &&
      phoenix.x < player.x + PLAYER_SIZE &&
      phoenix.x + PHOENIX_SIZE > player.x &&
      phoenix.y < player.y + PLAYER_SIZE &&
      phoenix.y + PHOENIX_SIZE > player.y
    );

    if (phoenixHit) {
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setGameOver(true);
          if (onScoreUpdate) onScoreUpdate(score);
        }
        return newLives;
      });
    }
  }, [phoenixes, player, gameOver, paused, score, onScoreUpdate]);

  const resetGame = () => {
    setPlayer({ x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, y: CANVAS_HEIGHT - 50 });
    setBullets([]);
    setPhoenixes(createWave());
    setPhoenixBullets([]);
    setScore(0);
    setLives(3);
    setLevel(1);
    setWaveType('birds');
    setWaveComplete(false);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (phoenixes.length === 0) {
      setPhoenixes(createWave());
    }
  }, [phoenixes.length, createWave]);

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
      updatePhoenixes();
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateBullets, updatePhoenixes, checkCollisions]);

  const getPhoenixColor = (phoenix: Phoenix) => {
    switch (phoenix.type) {
      case 'boss': return 'bg-red-500';
      case 'egg': return 'bg-yellow-500';
      case 'bird': return 'bg-orange-500';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">PHOENIX</div>
            <div className="text-sm">Score: {score} | Lives: {lives} | Level: {level}</div>
            <div className="text-sm">Wave: {waveType.toUpperCase()}</div>
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
          className="relative bg-gradient-to-b from-orange-900 to-black border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Player */}
          <div
            className="absolute bg-cyan-400 shadow-lg"
            style={{
              left: player.x,
              top: player.y,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
              boxShadow: '0 0 10px cyan'
            }}
          />

          {/* Player bullets */}
          {bullets.map((bullet, index) => (
            <div
              key={`bullet-${index}`}
              className="absolute bg-yellow-400 rounded-full shadow-lg"
              style={{
                left: bullet.x - BULLET_SIZE / 2,
                top: bullet.y - BULLET_SIZE / 2,
                width: BULLET_SIZE,
                height: BULLET_SIZE,
                boxShadow: '0 0 5px yellow'
              }}
            />
          ))}

          {/* Phoenix bullets */}
          {phoenixBullets.map((bullet, index) => (
            <div
              key={`phoenix-bullet-${index}`}
              className="absolute bg-red-400 rounded-full shadow-lg"
              style={{
                left: bullet.x - BULLET_SIZE / 2,
                top: bullet.y - BULLET_SIZE / 2,
                width: BULLET_SIZE,
                height: BULLET_SIZE,
                boxShadow: '0 0 5px red'
              }}
            />
          ))}

          {/* Phoenixes */}
          {phoenixes.filter(phoenix => phoenix.active).map((phoenix, index) => (
            <div
              key={`phoenix-${index}`}
              className={`absolute ${getPhoenixColor(phoenix)} border border-white shadow-lg`}
              style={{
                left: phoenix.x,
                top: phoenix.y,
                width: PHOENIX_SIZE,
                height: PHOENIX_SIZE,
                transform: `rotate(${phoenix.angle}rad) ${phoenix.type === 'boss' ? 'scale(1.5)' : ''}`,
                clipPath: phoenix.type === 'egg' ? 'ellipse(50% 60% at 50% 50%)' : 
                         phoenix.type === 'boss' ? 'polygon(50% 0%, 0% 30%, 20% 100%, 80% 100%, 100% 30%)' :
                         'polygon(50% 0%, 0% 100%, 100% 100%)',
                boxShadow: `0 0 ${phoenix.type === 'boss' ? '15px' : '8px'} ${
                  phoenix.type === 'boss' ? 'red' : phoenix.type === 'egg' ? 'yellow' : 'orange'
                }`,
                opacity: phoenix.health > 1 ? 1 : 0.8
              }}
            >
              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                {phoenix.type === 'boss' ? '🔥' : phoenix.type === 'egg' ? '🥚' : '🐦'}
              </div>
            </div>
          ))}

          {waveComplete && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
              <div className="text-orange-400 text-2xl font-bold retro-font animate-pulse">
                {waveType === 'birds' ? 'EGGS INCOMING!' : 
                 waveType === 'eggs' ? 'BOSS PHOENIX!' : 
                 'LEVEL COMPLETE!'}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font space-y-1">
          <p><strong>←→</strong> Move • <strong>Space</strong> Shoot • <strong>P</strong> Pause</p>
          <p>Fight through all three waves! Eggs hatch into birds!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">PHOENIX RISES!</div>
            <p className="text-cyan-400 mb-4 retro-font">Final Score: {score}</p>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-bold border-2 border-cyan-400"
            >
              RISE AGAIN
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

export default PhoenixGame;