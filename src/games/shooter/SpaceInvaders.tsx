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
  type: 'basic' | 'medium' | 'boss';
  health: number;
  points: number;
}

interface Barrier extends Position {
  active: boolean;
  health: number;
}

const SpaceInvaders: React.FC<SpaceInvadersProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Position>({ 
    x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, 
    y: CANVAS_HEIGHT - 50 
  });
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [invaders, setInvaders] = useState<Invader[]>([]);
  const [invaderBullets, setInvaderBullets] = useState<Bullet[]>([]);
  const [barriers, setBarriers] = useState<Barrier[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState(1);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [invaderDirection, setInvaderDirection] = useState(1);
  const [invaderDropTimer, setInvaderDropTimer] = useState(0);

  const createInvaders = useCallback(() => {
    const newInvaders: Invader[] = [];
    const rows = Math.min(5 + Math.floor(level / 3), 7);
    const cols = Math.min(10 + Math.floor(level / 2), 12);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let type: 'basic' | 'medium' | 'boss';
        let health: number;
        let points: number;
        
        if (row === 0) {
          type = 'boss';
          health = 2;
          points = 40;
        } else if (row <= 2) {
          type = 'medium';
          health = 1;
          points = 20;
        } else {
          type = 'basic';
          health = 1;
          points = 10;
        }
        
        newInvaders.push({
          x: 100 + col * 45,
          y: 50 + row * 35,
          active: true,
          type,
          health,
          points
        });
      }
    }
    return newInvaders;
  }, [level]);

  const createBarriers = useCallback(() => {
    const newBarriers: Barrier[] = [];
    for (let i = 0; i < 4; i++) {
      newBarriers.push({
        x: 150 + i * 150,
        y: CANVAS_HEIGHT - 150,
        active: true,
        health: 3
      });
    }
    return newBarriers;
  }, []);

  const resetGame = () => {
    setPlayer({ x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, y: CANVAS_HEIGHT - 50 });
    setBullets([]);
    setInvaders(createInvaders());
    setInvaderBullets([]);
    setBarriers(createBarriers());
    setScore(0);
    setLives(3);
    setLevel(1);
    setInvaderDirection(1);
    setInvaderDropTimer(0);
    setGameOver(false);
    setPaused(false);
  };

  const shoot = useCallback(() => {
    if (gameOver || paused || bullets.length >= 3) return;
    
    setBullets(prev => [
      ...prev,
      {
        x: player.x + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2,
        y: player.y,
        active: true
      }
    ]);
  }, [player, bullets.length, gameOver, paused]);

  const updatePlayer = useCallback(() => {
    if (gameOver || paused) return;

    setPlayer(prev => {
      let newX = prev.x;
      
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) {
        newX = Math.max(0, prev.x - 7);
      }
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) {
        newX = Math.min(CANVAS_WIDTH - PLAYER_WIDTH, prev.x + 7);
      }
      
      return { ...prev, x: newX };
    });
  }, [keys, gameOver, paused]);

  const updateBullets = useCallback(() => {
    if (gameOver || paused) return;

    setBullets(prev => 
      prev.map(bullet => ({
        ...bullet,
        y: bullet.y - 10,
        active: bullet.active && bullet.y > 0
      })).filter(bullet => bullet.active)
    );

    setInvaderBullets(prev =>
      prev.map(bullet => ({
        ...bullet,
        y: bullet.y + 5 + level * 0.5,
        active: bullet.active && bullet.y < CANVAS_HEIGHT
      })).filter(bullet => bullet.active)
    );
  }, [gameOver, paused, level]);

  const updateInvaders = useCallback(() => {
    if (gameOver || paused) return;

    const activeInvaders = invaders.filter(inv => inv.active);
    if (activeInvaders.length === 0) {
      // Next level
      setLevel(prev => prev + 1);
      setInvaders(createInvaders());
      setBarriers(createBarriers());
      setInvaderDirection(1);
      setInvaderDropTimer(0);
      return;
    }

    // Move invaders
    setInvaders(prev => {
      const activeInvs = prev.filter(inv => inv.active);
      const rightmost = Math.max(...activeInvs.map(inv => inv.x));
      const leftmost = Math.min(...activeInvs.map(inv => inv.x));
      
      let shouldMoveDown = false;
      let newDirection = invaderDirection;
      
      if (rightmost >= CANVAS_WIDTH - INVADER_WIDTH - 10 && invaderDirection > 0) {
        shouldMoveDown = true;
        newDirection = -1;
      } else if (leftmost <= 10 && invaderDirection < 0) {
        shouldMoveDown = true;
        newDirection = 1;
      }
      
      if (shouldMoveDown) {
        setInvaderDirection(newDirection);
        setInvaderDropTimer(10);
      }

      return prev.map(invader => {
        if (!invader.active) return invader;
        
        if (invaderDropTimer > 0) {
          return { ...invader, y: invader.y + 2 };
        } else {
          const speed = 1 + level * 0.2;
          return { ...invader, x: invader.x + invaderDirection * speed };
        }
      });
    });

    if (invaderDropTimer > 0) {
      setInvaderDropTimer(prev => prev - 1);
    }

    // Random invader shooting
    const shootChance = 0.001 + level * 0.0005;
    if (Math.random() < shootChance) {
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
  }, [invaders, gameOver, paused, level, createInvaders, createBarriers, invaderDirection, invaderDropTimer]);

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
              bullet.x >= invader.x && 
              bullet.x <= invader.x + INVADER_WIDTH &&
              bullet.y >= invader.y && 
              bullet.y <= invader.y + INVADER_HEIGHT
            ) {
              newBullets[bulletIndex] = { ...bullet, active: false };
              newInvaders[invaderIndex] = { 
                ...invader, 
                health: invader.health - 1 
              };
              
              if (newInvaders[invaderIndex].health <= 0) {
                newInvaders[invaderIndex].active = false;
                pointsEarned += invader.points * level;
              }
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

    // Bullets vs barriers
    setBullets(prevBullets => {
      let newBullets = [...prevBullets];
      
      setBarriers(prevBarriers => {
        return prevBarriers.map(barrier => {
          if (!barrier.active) return barrier;
          
          const hit = newBullets.some((bullet, index) => {
            if (!bullet.active) return false;
            
            if (
              bullet.x >= barrier.x && 
              bullet.x <= barrier.x + 60 &&
              bullet.y >= barrier.y && 
              bullet.y <= barrier.y + 40
            ) {
              newBullets[index] = { ...bullet, active: false };
              return true;
            }
            return false;
          });
          
          if (hit) {
            const newHealth = barrier.health - 1;
            return { ...barrier, health: newHealth, active: newHealth > 0 };
          }
          
          return barrier;
        });
      });
      
      return newBullets.filter(bullet => bullet.active);
    });

    // Invader bullets vs player
    setInvaderBullets(prevBullets => {
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

    // Invader bullets vs barriers
    setInvaderBullets(prevBullets => {
      let newBullets = [...prevBullets];
      
      setBarriers(prevBarriers => {
        return prevBarriers.map(barrier => {
          if (!barrier.active) return barrier;
          
          const hit = newBullets.some((bullet, index) => {
            if (!bullet.active) return false;
            
            if (
              bullet.x >= barrier.x && 
              bullet.x <= barrier.x + 60 &&
              bullet.y >= barrier.y && 
              bullet.y <= barrier.y + 40
            ) {
              newBullets[index] = { ...bullet, active: false };
              return true;
            }
            return false;
          });
          
          if (hit) {
            const newHealth = barrier.health - 1;
            return { ...barrier, health: newHealth, active: newHealth > 0 };
          }
          
          return barrier;
        });
      });
      
      return newBullets.filter(bullet => bullet.active);
    });

    // Check if invaders reached player
    const activeInvaders = invaders.filter(inv => inv.active);
    const reachedPlayer = activeInvaders.some(invader => 
      invader.y + INVADER_HEIGHT >= player.y
    );

    if (reachedPlayer) {
      setGameOver(true);
      if (onScoreUpdate) onScoreUpdate(score);
    }
  }, [invaders, player, gameOver, paused, score, onScoreUpdate]);

  useEffect(() => {
    if (invaders.length === 0) {
      setInvaders(createInvaders());
    }
    if (barriers.length === 0) {
      setBarriers(createBarriers());
    }
  }, [invaders.length, barriers.length, createInvaders, createBarriers]);

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
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateBullets, updateInvaders, checkCollisions]);

  const getInvaderColor = (invader: Invader) => {
    if (invader.health > 1) return 'bg-red-500';
    switch (invader.type) {
      case 'boss': return 'bg-purple-500';
      case 'medium': return 'bg-orange-500';
      case 'basic': return 'bg-green-500';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">SPACE INVADERS</div>
            <div className="text-sm">Score: {score} | Lives: {lives} | Level: {level}</div>
            <div className="text-sm">Invaders: {invaders.filter(inv => inv.active).length}</div>
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
          className="relative bg-gradient-to-b from-blue-900 to-black border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Player */}
          <div
            className="absolute bg-cyan-400 shadow-lg"
            style={{
              left: player.x,
              top: player.y,
              width: PLAYER_WIDTH,
              height: PLAYER_HEIGHT,
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
              boxShadow: '0 0 10px cyan'
            }}
          />

          {/* Player bullets */}
          {bullets.map((bullet, index) => (
            <div
              key={`bullet-${index}`}
              className="absolute bg-yellow-400 shadow-lg"
              style={{
                left: bullet.x,
                top: bullet.y,
                width: BULLET_WIDTH,
                height: BULLET_HEIGHT,
                boxShadow: '0 0 5px yellow'
              }}
            />
          ))}

          {/* Invader bullets */}
          {invaderBullets.map((bullet, index) => (
            <div
              key={`invader-bullet-${index}`}
              className="absolute bg-red-400 shadow-lg"
              style={{
                left: bullet.x,
                top: bullet.y,
                width: BULLET_WIDTH,
                height: BULLET_HEIGHT,
                boxShadow: '0 0 5px red'
              }}
            />
          ))}

          {/* Barriers */}
          {barriers.filter(barrier => barrier.active).map((barrier, index) => (
            <div
              key={`barrier-${index}`}
              className={`absolute border-2 ${
                barrier.health === 3 ? 'bg-green-400 border-green-300' :
                barrier.health === 2 ? 'bg-yellow-400 border-yellow-300' :
                'bg-red-400 border-red-300'
              }`}
              style={{
                left: barrier.x,
                top: barrier.y,
                width: 60,
                height: 40,
                opacity: 0.8
              }}
            />
          ))}

          {/* Invaders */}
          {invaders.filter(inv => inv.active).map((invader, index) => (
            <div
              key={`invader-${index}`}
              className={`absolute ${getInvaderColor(invader)} border border-white shadow-lg`}
              style={{
                left: invader.x,
                top: invader.y,
                width: INVADER_WIDTH,
                height: INVADER_HEIGHT,
                clipPath: invader.type === 'boss' ? 'polygon(50% 0%, 0% 50%, 50% 100%, 100% 50%)' : 'none',
                boxShadow: `0 0 5px ${invader.type === 'boss' ? 'purple' : invader.type === 'medium' ? 'orange' : 'green'}`
              }}
            >
              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                {invader.type === 'boss' ? '👾' : invader.type === 'medium' ? '🛸' : '👽'}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font space-y-1">
          <p><strong>←→</strong> Move • <strong>Space</strong> Shoot • <strong>P</strong> Pause</p>
          <p>Destroy all invaders to advance! Use barriers for cover!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">INVASION COMPLETE!</div>
            <p className="text-cyan-400 mb-4 retro-font">Final Score: {score}</p>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-bold border-2 border-cyan-400"
            >
              DEFEND AGAIN
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

export default SpaceInvaders;