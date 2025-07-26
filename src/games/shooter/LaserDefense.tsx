import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface LaserDefenseProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 700;
const PLAYER_SIZE = 30;
const ALIEN_SIZE = 25;
const LASER_WIDTH = 4;

interface Position {
  x: number;
  y: number;
}

interface Laser extends Position {
  active: boolean;
  height: number;
  charging: boolean;
  power: number;
}

interface Alien extends Position {
  vx: number;
  vy: number;
  active: boolean;
  type: 'scout' | 'fighter' | 'bomber';
  health: number;
  shootTimer: number;
}

interface AlienBullet extends Position {
  vy: number;
  active: boolean;
}

const LaserDefense: React.FC<LaserDefenseProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Position>({ 
    x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, 
    y: CANVAS_HEIGHT - 50 
  });
  const [laser, setLaser] = useState<Laser>({ 
    x: 0, 
    y: 0, 
    active: false, 
    height: 0, 
    charging: false, 
    power: 0 
  });
  const [aliens, setAliens] = useState<Alien[]>([]);
  const [alienBullets, setAlienBullets] = useState<AlienBullet[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [energy, setEnergy] = useState(100);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [overheated, setOverheated] = useState(false);

  const createAliens = useCallback(() => {
    const newAliens: Alien[] = [];
    const alienCount = 8 + level * 2;
    
    for (let i = 0; i < alienCount; i++) {
      const types: Alien['type'][] = ['scout', 'fighter', 'bomber'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      newAliens.push({
        x: Math.random() * (CANVAS_WIDTH - ALIEN_SIZE),
        y: -ALIEN_SIZE - i * 50,
        vx: (Math.random() - 0.5) * 4,
        vy: 1 + Math.random() * 2,
        active: true,
        type,
        health: type === 'bomber' ? 3 : type === 'fighter' ? 2 : 1,
        shootTimer: Math.random() * 60
      });
    }
    
    return newAliens;
  }, [level]);

  const chargeLaser = useCallback(() => {
    if (gameOver || paused || energy < 10 || overheated) return;
    
    setLaser(prev => ({
      ...prev,
      x: player.x + PLAYER_SIZE / 2,
      y: player.y,
      charging: true,
      power: 0
    }));
  }, [player, energy, overheated, gameOver, paused]);

  const fireLaser = useCallback(() => {
    if (!laser.charging || energy < 10) return;
    
    setLaser(prev => ({
      ...prev,
      active: true,
      charging: false,
      height: prev.power * 10
    }));
    
    setEnergy(prev => Math.max(0, prev - (laser.power / 2)));
    
    // Check for overheating
    if (energy < 30) {
      setOverheated(true);
      setTimeout(() => setOverheated(false), 2000);
    }
  }, [laser.charging, laser.power, energy]);

  const updatePlayer = useCallback(() => {
    if (gameOver || paused) return;

    setPlayer(prev => {
      let newX = prev.x;
      
      if (keys.has('ArrowLeft')) {
        newX = Math.max(0, prev.x - 6);
      }
      if (keys.has('ArrowRight')) {
        newX = Math.min(CANVAS_WIDTH - PLAYER_SIZE, prev.x + 6);
      }
      
      return { ...prev, x: newX };
    });
    
    // Energy regeneration
    if (!overheated) {
      setEnergy(prev => Math.min(100, prev + 0.5));
    }
  }, [keys, gameOver, paused, overheated]);

  const updateLaser = useCallback(() => {
    if (gameOver || paused) return;

    setLaser(prev => {
      if (prev.charging) {
        return {
          ...prev,
          x: player.x + PLAYER_SIZE / 2,
          power: Math.min(100, prev.power + 3)
        };
      }
      
      if (prev.active) {
        const newHeight = prev.height - 20;
        if (newHeight <= 0) {
          return { ...prev, active: false, height: 0 };
        }
        return { ...prev, height: newHeight };
      }
      
      return prev;
    });
  }, [gameOver, paused, player]);

  const updateAliens = useCallback(() => {
    if (gameOver || paused) return;

    setAliens(prev => {
      const activeAliens = prev.filter(alien => alien.active);
      
      if (activeAliens.length === 0) {
        setLevel(prevLevel => prevLevel + 1);
        return createAliens();
      }

      return prev.map(alien => {
        if (!alien.active) return alien;

        let newX = alien.x + alien.vx;
        let newY = alien.y + alien.vy;
        let newVx = alien.vx;
        let newShootTimer = alien.shootTimer - 1;

        // Bounce off walls
        if (newX <= 0 || newX >= CANVAS_WIDTH - ALIEN_SIZE) {
          newVx = -newVx;
          newY += 20; // Move down when hitting wall
        }

        // Shooting
        if (newShootTimer <= 0 && newY > 50) {
          const shootChance = alien.type === 'bomber' ? 0.05 : 
                             alien.type === 'fighter' ? 0.03 : 0.02;
          
          if (Math.random() < shootChance) {
            setAlienBullets(prevBullets => [...prevBullets, {
              x: alien.x + ALIEN_SIZE / 2,
              y: alien.y + ALIEN_SIZE,
              vy: 4,
              active: true
            }]);
          }
          
          newShootTimer = 60 + Math.random() * 60;
        }

        return {
          ...alien,
          x: newX,
          y: newY,
          vx: newVx,
          shootTimer: newShootTimer
        };
      });
    });

    // Spawn new wave periodically
    if (Math.random() < 0.005 && aliens.filter(a => a.active).length < 15) {
      const types: Alien['type'][] = ['scout', 'fighter', 'bomber'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      setAliens(prev => [...prev, {
        x: Math.random() * (CANVAS_WIDTH - ALIEN_SIZE),
        y: -ALIEN_SIZE,
        vx: (Math.random() - 0.5) * 4,
        vy: 1 + Math.random() * 2,
        active: true,
        type,
        health: type === 'bomber' ? 3 : type === 'fighter' ? 2 : 1,
        shootTimer: Math.random() * 60
      }]);
    }
  }, [aliens, gameOver, paused, level, createAliens]);

  const updateAlienBullets = useCallback(() => {
    if (gameOver || paused) return;

    setAlienBullets(prev => 
      prev.map(bullet => ({
        ...bullet,
        y: bullet.y + bullet.vy,
        active: bullet.active && bullet.y < CANVAS_HEIGHT
      })).filter(bullet => bullet.active)
    );
  }, [gameOver, paused]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Laser vs aliens
    if (laser.active) {
      setAliens(prevAliens => {
        let newAliens = [...prevAliens];
        let pointsEarned = 0;

        newAliens.forEach((alien, index) => {
          if (!alien.active) return;

          if (
            alien.x < laser.x + LASER_WIDTH &&
            alien.x + ALIEN_SIZE > laser.x &&
            alien.y < laser.y &&
            alien.y + ALIEN_SIZE > laser.y - laser.height
          ) {
            newAliens[index] = { ...alien, health: alien.health - 1 };
            
            if (newAliens[index].health <= 0) {
              newAliens[index].active = false;
              const points = alien.type === 'bomber' ? 200 : 
                           alien.type === 'fighter' ? 150 : 100;
              pointsEarned += points;
            }
          }
        });

        if (pointsEarned > 0) {
          setScore(prev => prev + pointsEarned);
        }

        return newAliens;
      });
    }

    // Alien bullets vs player
    setAlienBullets(prevBullets => {
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

    // Aliens vs player collision
    const alienHit = aliens.some(alien => 
      alien.active &&
      alien.x < player.x + PLAYER_SIZE &&
      alien.x + ALIEN_SIZE > player.x &&
      alien.y < player.y + PLAYER_SIZE &&
      alien.y + ALIEN_SIZE > player.y
    );

    if (alienHit) {
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setGameOver(true);
          if (onScoreUpdate) onScoreUpdate(score);
        }
        return newLives;
      });
    }

    // Check if aliens reached bottom
    const aliensReachedBottom = aliens.some(alien => 
      alien.active && alien.y + ALIEN_SIZE >= CANVAS_HEIGHT - 60
    );

    if (aliensReachedBottom) {
      setGameOver(true);
      if (onScoreUpdate) onScoreUpdate(score);
    }
  }, [laser, aliens, player, gameOver, paused, score, onScoreUpdate]);

  const resetGame = () => {
    setPlayer({ x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, y: CANVAS_HEIGHT - 50 });
    setLaser({ x: 0, y: 0, active: false, height: 0, charging: false, power: 0 });
    setAliens(createAliens());
    setAlienBullets([]);
    setScore(0);
    setLives(3);
    setLevel(1);
    setEnergy(100);
    setOverheated(false);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (aliens.length === 0) {
      setAliens(createAliens());
    }
  }, [aliens.length, createAliens]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      
      if (e.key === ' ') {
        if (gameOver) return;
        if (paused) {
          setPaused(false);
        } else if (!laser.charging && !laser.active) {
          chargeLaser();
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
      
      if (e.key === ' ' && laser.charging) {
        fireLaser();
        return;
      }
      
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
  }, [chargeLaser, fireLaser, laser.charging, gameOver, paused]);

  useEffect(() => {
    const gameInterval = setInterval(() => {
      updatePlayer();
      updateLaser();
      updateAliens();
      updateAlienBullets();
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateLaser, updateAliens, updateAlienBullets, checkCollisions]);

  const getAlienColor = (alien: Alien) => {
    switch (alien.type) {
      case 'bomber': return 'bg-red-500';
      case 'fighter': return 'bg-purple-500';
      case 'scout': return 'bg-blue-500';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">LASER DEFENSE</div>
            <div className="text-sm">Score: {score} | Lives: {lives} | Level: {level}</div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-cyan-400 retro-font text-sm">
              <div>Energy: {Math.round(energy)}%</div>
              {overheated && <div className="text-red-400">OVERHEATED!</div>}
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
        </div>

        {/* Energy bar */}
        <div className="mb-4 bg-gray-800 border border-cyan-400 rounded p-2">
          <div className="text-cyan-400 text-xs retro-font mb-1">LASER ENERGY</div>
          <div className="w-full h-3 bg-gray-600 border border-gray-500 rounded">
            <div
              className={`h-full rounded transition-all duration-200 ${
                overheated ? 'bg-red-500' : 
                energy > 60 ? 'bg-green-400' : 
                energy > 30 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${energy}%` }}
            />
          </div>
        </div>

        <div
          className="relative bg-gradient-to-b from-blue-900 to-black border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Player */}
          <div
            className={`absolute ${overheated ? 'bg-red-400' : 'bg-cyan-400'}`}
            style={{
              left: player.x,
              top: player.y,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
            }}
          />

          {/* Laser charging effect */}
          {laser.charging && (
            <div
              className="absolute bg-cyan-300 opacity-50"
              style={{
                left: laser.x - 2,
                top: laser.y - 20,
                width: 4,
                height: 20
              }}
            />
          )}

          {/* Laser beam */}
          {laser.active && (
            <div
              className="absolute bg-cyan-400 opacity-90"
              style={{
                left: laser.x - LASER_WIDTH / 2,
                top: laser.y - laser.height,
                width: LASER_WIDTH,
                height: laser.height
              }}
            />
          )}

          {/* Power meter while charging */}
          {laser.charging && (
            <div className="absolute top-4 left-4 bg-gray-800 border border-cyan-400 p-2 rounded">
              <div className="text-cyan-400 text-xs retro-font mb-1">POWER</div>
              <div className="w-20 h-3 bg-gray-600 border border-gray-500">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-red-400"
                  style={{ width: `${laser.power}%` }}
                />
              </div>
            </div>
          )}

          {/* Alien bullets */}
          {alienBullets.map((bullet, index) => (
            <div
              key={`alien-bullet-${index}`}
              className="absolute bg-red-400 rounded-full"
              style={{
                left: bullet.x - 2,
                top: bullet.y - 2,
                width: 4,
                height: 4
              }}
            />
          ))}

          {/* Aliens */}
          {aliens.filter(alien => alien.active).map((alien, index) => (
            <div
              key={`alien-${index}`}
              className={`absolute ${getAlienColor(alien)} rounded`}
              style={{
                left: alien.x,
                top: alien.y,
                width: ALIEN_SIZE,
                height: ALIEN_SIZE,
                opacity: alien.health === 1 ? 1 : alien.health === 2 ? 0.8 : 0.6
              }}
            />
          ))}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>←→ Move • Hold Space to charge laser, release to fire!</p>
          <p>Manage your energy - overheating will disable your weapon!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">DEFENSE OVERRUN!</div>
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

export default LaserDefense;