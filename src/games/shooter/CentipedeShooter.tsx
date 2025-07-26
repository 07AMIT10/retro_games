import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface CentipedeShooterProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 700;
const PLAYER_SIZE = 25;
const BULLET_SIZE = 4;
const SEGMENT_SIZE = 20;
const MUSHROOM_SIZE = 15;
const POWERUP_SIZE = 20;

interface Position {
  x: number;
  y: number;
}

interface Bullet extends Position {
  active: boolean;
  vy: number;
  type: 'normal' | 'laser' | 'spread';
}

interface Segment extends Position {
  id: number;
}

interface Mushroom extends Position {
  hits: number;
  maxHits: number;
}

interface PowerUp extends Position {
  type: 'laser' | 'spread' | 'rapid' | 'shield';
  active: boolean;
}

const CentipedeShooter: React.FC<CentipedeShooterProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Position>({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT - 50 
  });
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [centipede, setCentipede] = useState<Segment[]>([]);
  const [mushrooms, setMushrooms] = useState<Mushroom[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [weaponType, setWeaponType] = useState<'normal' | 'laser' | 'spread'>('normal');
  const [weaponAmmo, setWeaponAmmo] = useState(0);
  const [shield, setShield] = useState(false);
  const [shieldTimer, setShieldTimer] = useState(0);

  const createCentipede = useCallback((length: number = 12) => {
    const segments: Segment[] = [];
    for (let i = 0; i < length; i++) {
      segments.push({
        id: i,
        x: i * SEGMENT_SIZE,
        y: 50
      });
    }
    return segments;
  }, []);

  const createMushrooms = useCallback(() => {
    const newMushrooms: Mushroom[] = [];
    const mushroomCount = 20 + level * 3;
    
    for (let i = 0; i < mushroomCount; i++) {
      newMushrooms.push({
        x: Math.floor(Math.random() * (CANVAS_WIDTH / MUSHROOM_SIZE)) * MUSHROOM_SIZE,
        y: 100 + Math.floor(Math.random() * ((CANVAS_HEIGHT - 200) / MUSHROOM_SIZE)) * MUSHROOM_SIZE,
        hits: 0,
        maxHits: 3
      });
    }
    return newMushrooms;
  }, [level]);

  const spawnPowerUp = useCallback(() => {
    if (Math.random() < 0.05) {
      const types: PowerUp['type'][] = ['laser', 'spread', 'rapid', 'shield'];
      setPowerUps(prev => [...prev, {
        x: Math.random() * (CANVAS_WIDTH - POWERUP_SIZE),
        y: 50,
        type: types[Math.floor(Math.random() * types.length)],
        active: true
      }]);
    }
  }, []);

  const shoot = useCallback(() => {
    if (gameOver || paused) return;
    
    if (weaponType === 'normal') {
      setBullets(prev => [
        ...prev,
        {
          x: player.x + PLAYER_SIZE / 2,
          y: player.y,
          active: true,
          vy: -8,
          type: 'normal'
        }
      ]);
    } else if (weaponType === 'laser' && weaponAmmo > 0) {
      setBullets(prev => [
        ...prev,
        {
          x: player.x + PLAYER_SIZE / 2,
          y: player.y,
          active: true,
          vy: -12,
          type: 'laser'
        }
      ]);
      setWeaponAmmo(prev => prev - 1);
    } else if (weaponType === 'spread' && weaponAmmo > 0) {
      for (let i = -1; i <= 1; i++) {
        setBullets(prev => [
          ...prev,
          {
            x: player.x + PLAYER_SIZE / 2 + i * 10,
            y: player.y,
            active: true,
            vy: -7,
            type: 'spread'
          }
        ]);
      }
      setWeaponAmmo(prev => prev - 1);
    }
  }, [player, weaponType, weaponAmmo, gameOver, paused]);

  const updatePlayer = useCallback(() => {
    if (gameOver || paused) return;

    setPlayer(prev => {
      let newX = prev.x;
      let newY = prev.y;

      if (keys.has('ArrowLeft')) {
        newX = Math.max(0, prev.x - 5);
      }
      if (keys.has('ArrowRight')) {
        newX = Math.min(CANVAS_WIDTH - PLAYER_SIZE, prev.x + 5);
      }
      if (keys.has('ArrowUp')) {
        newY = Math.max(CANVAS_HEIGHT / 2, prev.y - 5);
      }
      if (keys.has('ArrowDown')) {
        newY = Math.min(CANVAS_HEIGHT - PLAYER_SIZE, prev.y + 5);
      }

      return { x: newX, y: newY };
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
  }, [gameOver, paused]);

  const updateCentipede = useCallback(() => {
    if (gameOver || paused) return;

    setCentipede(prevSegments => {
      if (prevSegments.length === 0) {
        return createCentipede(12 + level);
      }

      return prevSegments.map((segment, index) => {
        let newX = segment.x;
        let newY = segment.y;

        // Move right until hitting edge or mushroom
        newX += 2;

        if (newX >= CANVAS_WIDTH - SEGMENT_SIZE) {
          newX = CANVAS_WIDTH - SEGMENT_SIZE;
          newY += SEGMENT_SIZE;
        }

        // Check mushroom collision
        const hitMushroom = mushrooms.some(mushroom => 
          newX < mushroom.x + MUSHROOM_SIZE &&
          newX + SEGMENT_SIZE > mushroom.x &&
          newY < mushroom.y + MUSHROOM_SIZE &&
          newY + SEGMENT_SIZE > mushroom.y &&
          mushroom.hits < mushroom.maxHits
        );

        if (hitMushroom) {
          newY += SEGMENT_SIZE;
          newX = segment.x - 2;
        }

        return { ...segment, x: newX, y: newY };
      });
    });

    spawnPowerUp();
  }, [gameOver, paused, mushrooms, createCentipede, level, spawnPowerUp]);

  const updatePowerUps = useCallback(() => {
    if (gameOver || paused) return;

    setPowerUps(prev => 
      prev.map(powerUp => ({
        ...powerUp,
        y: powerUp.y + 2,
        active: powerUp.active && powerUp.y < CANVAS_HEIGHT
      })).filter(powerUp => powerUp.active)
    );
  }, [gameOver, paused]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Bullets vs centipede
    setBullets(prevBullets => {
      let newBullets = [...prevBullets];
      
      setCentipede(prevSegments => {
        let newSegments = [...prevSegments];
        let pointsEarned = 0;

        newBullets.forEach((bullet, bulletIndex) => {
          if (!bullet.active) return;

          newSegments.forEach((segment, segmentIndex) => {
            if (
              bullet.x >= segment.x && 
              bullet.x <= segment.x + SEGMENT_SIZE &&
              bullet.y >= segment.y && 
              bullet.y <= segment.y + SEGMENT_SIZE
            ) {
              newBullets[bulletIndex] = { ...bullet, active: false };
              newSegments.splice(segmentIndex, 1);
              pointsEarned += 10;

              // Add mushroom where segment was hit
              setMushrooms(prevMushrooms => [...prevMushrooms, { 
                x: segment.x, 
                y: segment.y, 
                hits: 0, 
                maxHits: 3 
              }]);

              // Split centipede if hit in middle
              if (segmentIndex < newSegments.length) {
                // Create new centipede from remaining segments
                const remainingSegments = newSegments.slice(segmentIndex);
                remainingSegments.forEach((seg, i) => {
                  seg.id = newSegments.length + i;
                });
              }
            }
          });
        });

        if (pointsEarned > 0) {
          setScore(prev => prev + pointsEarned);
        }

        // Check if centipede is destroyed
        if (newSegments.length === 0) {
          setLevel(prev => prev + 1);
          setMushrooms(createMushrooms());
          return createCentipede(12 + level);
        }

        return newSegments;
      });

      return newBullets.filter(bullet => bullet.active);
    });

    // Bullets vs mushrooms
    setBullets(prevBullets => {
      let newBullets = [...prevBullets];
      
      setMushrooms(prevMushrooms => {
        let newMushrooms = [...prevMushrooms];

        newBullets.forEach((bullet, bulletIndex) => {
          if (!bullet.active) return;

          newMushrooms.forEach((mushroom, mushroomIndex) => {
            if (
              bullet.x >= mushroom.x && 
              bullet.x <= mushroom.x + MUSHROOM_SIZE &&
              bullet.y >= mushroom.y && 
              bullet.y <= mushroom.y + MUSHROOM_SIZE &&
              mushroom.hits < mushroom.maxHits
            ) {
              if (bullet.type === 'laser') {
                // Laser destroys mushroom instantly
                newMushrooms.splice(mushroomIndex, 1);
                setScore(prev => prev + 5);
              } else {
                newBullets[bulletIndex] = { ...bullet, active: false };
                newMushrooms[mushroomIndex] = { 
                  ...mushroom, 
                  hits: mushroom.hits + 1 
                };
                
                if (newMushrooms[mushroomIndex].hits >= mushroom.maxHits) {
                  newMushrooms.splice(mushroomIndex, 1);
                  setScore(prev => prev + 5);
                }
              }
            }
          });
        });

        return newMushrooms;
      });

      return newBullets.filter(bullet => bullet.active);
    });

    // Player vs centipede
    if (!shield) {
      const playerHit = centipede.some(segment =>
        player.x < segment.x + SEGMENT_SIZE &&
        player.x + PLAYER_SIZE > segment.x &&
        player.y < segment.y + SEGMENT_SIZE &&
        player.y + PLAYER_SIZE > segment.y
      );

      if (playerHit) {
        setLives(prev => {
          const newLives = prev - 1;
          if (newLives <= 0) {
            setGameOver(true);
            if (onScoreUpdate) onScoreUpdate(score);
          }
          return newLives;
        });
        setPlayer({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50 });
      }
    }

    // Player vs power-ups
    setPowerUps(prevPowerUps => {
      return prevPowerUps.filter(powerUp => {
        if (
          powerUp.active &&
          player.x < powerUp.x + POWERUP_SIZE &&
          player.x + PLAYER_SIZE > powerUp.x &&
          player.y < powerUp.y + POWERUP_SIZE &&
          player.y + PLAYER_SIZE > powerUp.y
        ) {
          // Activate power-up
          switch (powerUp.type) {
            case 'laser':
              setWeaponType('laser');
              setWeaponAmmo(20);
              break;
            case 'spread':
              setWeaponType('spread');
              setWeaponAmmo(15);
              break;
            case 'rapid':
              // Temporary rapid fire (handled in shooting logic)
              break;
            case 'shield':
              setShield(true);
              setShieldTimer(300); // 5 seconds at 60fps
              break;
          }
          return false; // Remove power-up
        }
        return true;
      });
    });
  }, [centipede, player, shield, gameOver, paused, level, createMushrooms, createCentipede, score, onScoreUpdate]);

  const resetGame = () => {
    setPlayer({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50 });
    setBullets([]);
    setCentipede(createCentipede());
    setMushrooms(createMushrooms());
    setPowerUps([]);
    setScore(0);
    setLives(3);
    setLevel(1);
    setWeaponType('normal');
    setWeaponAmmo(0);
    setShield(false);
    setShieldTimer(0);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (centipede.length === 0) {
      setCentipede(createCentipede());
    }
    if (mushrooms.length === 0) {
      setMushrooms(createMushrooms());
    }
  }, [centipede.length, mushrooms.length, createCentipede, createMushrooms]);

  useEffect(() => {
    if (shield && shieldTimer > 0) {
      const timer = setTimeout(() => {
        setShieldTimer(prev => prev - 1);
      }, 16);

      if (shieldTimer <= 0) {
        setShield(false);
      }

      return () => clearTimeout(timer);
    }
  }, [shield, shieldTimer]);

  useEffect(() => {
    if (weaponAmmo <= 0 && weaponType !== 'normal') {
      setWeaponType('normal');
    }
  }, [weaponAmmo, weaponType]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      
      if (e.key === ' ') {
        if (paused) {
          setPaused(false);
        } else {
          shoot();
        }
        return;
      }
      
      if (e.key === 'p') {
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
  }, [shoot, paused]);

  useEffect(() => {
    const gameInterval = setInterval(() => {
      updatePlayer();
      updateBullets();
      updateCentipede();
      updatePowerUps();
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateBullets, updateCentipede, updatePowerUps, checkCollisions]);

  const getPowerUpColor = (type: PowerUp['type']) => {
    switch (type) {
      case 'laser': return 'bg-red-400';
      case 'spread': return 'bg-blue-400';
      case 'rapid': return 'bg-green-400';
      case 'shield': return 'bg-purple-400';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">CENTIPEDE+</div>
            <div className="text-sm">Score: {score} | Lives: {lives} | Level: {level}</div>
            <div className="text-sm">
              Weapon: {weaponType.toUpperCase()} 
              {weaponAmmo > 0 && ` (${weaponAmmo})`}
              {shield && ` | SHIELD: ${Math.ceil(shieldTimer / 60)}s`}
            </div>
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
          {/* Mushrooms */}
          {mushrooms.map((mushroom, index) => (
            <div
              key={index}
              className={`absolute rounded ${
                mushroom.hits === 0 ? 'bg-yellow-400' :
                mushroom.hits === 1 ? 'bg-yellow-500' : 'bg-orange-400'
              }`}
              style={{
                left: mushroom.x,
                top: mushroom.y,
                width: MUSHROOM_SIZE,
                height: MUSHROOM_SIZE
              }}
            />
          ))}

          {/* Centipede */}
          {centipede.map((segment, index) => (
            <div
              key={segment.id}
              className={`absolute rounded ${
                index === 0 ? 'bg-red-400' : 'bg-green-400'
              }`}
              style={{
                left: segment.x,
                top: segment.y,
                width: SEGMENT_SIZE,
                height: SEGMENT_SIZE
              }}
            />
          ))}

          {/* Power-ups */}
          {powerUps.map((powerUp, index) => (
            <div
              key={index}
              className={`absolute ${getPowerUpColor(powerUp.type)} rounded-full animate-pulse`}
              style={{
                left: powerUp.x,
                top: powerUp.y,
                width: POWERUP_SIZE,
                height: POWERUP_SIZE
              }}
            />
          ))}

          {/* Player */}
          <div
            className={`absolute rounded ${shield ? 'bg-purple-400 animate-pulse' : 'bg-cyan-400'}`}
            style={{
              left: player.x,
              top: player.y,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
            }}
          />

          {/* Bullets */}
          {bullets.map((bullet, index) => (
            <div
              key={index}
              className={`absolute rounded-full ${
                bullet.type === 'laser' ? 'bg-red-400' :
                bullet.type === 'spread' ? 'bg-blue-400' : 'bg-white'
              }`}
              style={{
                left: bullet.x - BULLET_SIZE / 2,
                top: bullet.y - BULLET_SIZE / 2,
                width: BULLET_SIZE,
                height: BULLET_SIZE
              }}
            />
          ))}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Arrow Keys - Move • Space - Shoot • Collect power-ups for special weapons!</p>
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

export default CentipedeShooter;