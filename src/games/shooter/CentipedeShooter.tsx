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
  isHead: boolean;
  direction: 'left' | 'right';
  speed: number;
}

interface Mushroom extends Position {
  hits: number;
  maxHits: number;
  poisoned: boolean;
}

interface PowerUp extends Position {
  type: 'laser' | 'spread' | 'rapid' | 'shield' | 'bomb';
  active: boolean;
  timer: number;
}

interface Spider extends Position {
  active: boolean;
  vx: number;
  vy: number;
  points: number;
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
  const [spiders, setSpiders] = useState<Spider[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [weaponType, setWeaponType] = useState<'normal' | 'laser' | 'spread' | 'rapid'>('normal');
  const [weaponAmmo, setWeaponAmmo] = useState(0);
  const [shield, setShield] = useState(false);
  const [shieldTimer, setShieldTimer] = useState(0);
  const [rapidFireTimer, setRapidFireTimer] = useState(0);

  const createMushrooms = useCallback(() => {
    const newMushrooms: Mushroom[] = [];
    const mushroomCount = 25 + level * 3;
    
    for (let i = 0; i < mushroomCount; i++) {
      let x, y;
      let attempts = 0;
      
      do {
        x = Math.floor(Math.random() * (CANVAS_WIDTH / MUSHROOM_SIZE)) * MUSHROOM_SIZE;
        y = Math.floor(Math.random() * (CANVAS_HEIGHT * 0.7 / MUSHROOM_SIZE)) * MUSHROOM_SIZE;
        attempts++;
      } while (attempts < 50 && newMushrooms.some(m => 
        Math.abs(m.x - x) < MUSHROOM_SIZE * 2 && Math.abs(m.y - y) < MUSHROOM_SIZE * 2
      ));
      
      if (attempts < 50) {
        newMushrooms.push({
          x,
          y,
          hits: 0,
          maxHits: 3 + Math.floor(level / 3),
          poisoned: false
        });
      }
    }
    return newMushrooms;
  }, [level]);

  const createCentipede = useCallback((length: number) => {
    const newSegments: Segment[] = [];
    const startX = Math.random() * (CANVAS_WIDTH - length * SEGMENT_SIZE);
    const speed = 1 + level * 0.2;
    
    for (let i = 0; i < length; i++) {
      newSegments.push({
        id: i,
        x: startX + i * SEGMENT_SIZE,
        y: 0,
        isHead: i === 0,
        direction: 'right',
        speed
      });
    }
    return newSegments;
  }, [level]);

  const spawnPowerUp = useCallback(() => {
    if (Math.random() < 0.01 && powerUps.length < 3) {
      const types: PowerUp['type'][] = ['laser', 'spread', 'rapid', 'shield', 'bomb'];
      setPowerUps(prev => [...prev, {
        x: Math.random() * (CANVAS_WIDTH - POWERUP_SIZE),
        y: 50,
        type: types[Math.floor(Math.random() * types.length)],
        active: true,
        timer: 600 // 10 seconds at 60fps
      }]);
    }
  }, [powerUps.length]);

  const spawnSpider = useCallback(() => {
    if (Math.random() < 0.003 && spiders.length < 2) {
      const fromLeft = Math.random() > 0.5;
      setSpiders(prev => [...prev, {
        x: fromLeft ? -20 : CANVAS_WIDTH + 20,
        y: CANVAS_HEIGHT - 150 + Math.random() * 100,
        active: true,
        vx: fromLeft ? 2 + Math.random() * 2 : -(2 + Math.random() * 2),
        vy: (Math.random() - 0.5) * 3,
        points: 300 + Math.floor(Math.random() * 500)
      }]);
    }
  }, [spiders.length]);

  const shoot = useCallback(() => {
    if (gameOver || paused) return;
    
    const canShoot = rapidFireTimer > 0 || bullets.length < (weaponType === 'rapid' ? 6 : 3);
    if (!canShoot) return;
    
    if (weaponType === 'normal' || weaponAmmo <= 0) {
      setBullets(prev => [
        ...prev,
        {
          x: player.x + PLAYER_SIZE / 2,
          y: player.y,
          active: true,
          vy: -10,
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
          vy: -15,
          type: 'laser'
        }
      ]);
      setWeaponAmmo(prev => prev - 1);
    } else if (weaponType === 'spread' && weaponAmmo > 0) {
      for (let i = -1; i <= 1; i++) {
        setBullets(prev => [
          ...prev,
          {
            x: player.x + PLAYER_SIZE / 2 + i * 15,
            y: player.y,
            active: true,
            vy: -8,
            type: 'spread'
          }
        ]);
      }
      setWeaponAmmo(prev => prev - 1);
    } else if (weaponType === 'rapid') {
      setBullets(prev => [
        ...prev,
        {
          x: player.x + PLAYER_SIZE / 2,
          y: player.y,
          active: true,
          vy: -12,
          type: 'normal'
        }
      ]);
    }
  }, [player, weaponType, weaponAmmo, gameOver, paused, bullets.length, rapidFireTimer]);

  const updatePlayer = useCallback(() => {
    if (gameOver || paused) return;

    setPlayer(prev => {
      let newX = prev.x;
      let newY = prev.y;

      if (keys.has('ArrowLeft')) {
        newX = Math.max(0, prev.x - 6);
      }
      if (keys.has('ArrowRight')) {
        newX = Math.min(CANVAS_WIDTH - PLAYER_SIZE, prev.x + 6);
      }
      if (keys.has('ArrowUp')) {
        newY = Math.max(CANVAS_HEIGHT / 2, prev.y - 6);
      }
      if (keys.has('ArrowDown')) {
        newY = Math.min(CANVAS_HEIGHT - PLAYER_SIZE, prev.y + 6);
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

    setCentipede(prev => {
      return prev.map(segment => {
        let newX = segment.x;
        let newY = segment.y;
        let newDirection = segment.direction;

        // Move horizontally
        if (segment.direction === 'right') {
          newX += segment.speed;
        } else {
          newX -= segment.speed;
        }

        // Check bounds and mushroom collisions
        const hitBound = newX <= 0 || newX >= CANVAS_WIDTH - SEGMENT_SIZE;
        const hitMushroom = mushrooms.some(mushroom => 
          newX < mushroom.x + MUSHROOM_SIZE &&
          newX + SEGMENT_SIZE > mushroom.x &&
          newY < mushroom.y + MUSHROOM_SIZE &&
          newY + SEGMENT_SIZE > mushroom.y
        );

        if (hitBound || hitMushroom) {
          newY += SEGMENT_SIZE;
          newDirection = segment.direction === 'right' ? 'left' : 'right';
          newX = segment.x; // Don't move horizontally this frame
        }

        return { 
          ...segment, 
          x: newX, 
          y: newY, 
          direction: newDirection 
        };
      });
    });

    spawnPowerUp();
    spawnSpider();
  }, [gameOver, paused, mushrooms, spawnPowerUp, spawnSpider]);

  const updatePowerUps = useCallback(() => {
    if (gameOver || paused) return;

    setPowerUps(prev => 
      prev.map(powerUp => ({
        ...powerUp,
        y: powerUp.y + 2,
        timer: powerUp.timer - 1,
        active: powerUp.active && powerUp.y < CANVAS_HEIGHT && powerUp.timer > 0
      })).filter(powerUp => powerUp.active)
    );
  }, [gameOver, paused]);

  const updateSpiders = useCallback(() => {
    if (gameOver || paused) return;

    setSpiders(prev => 
      prev.map(spider => ({
        ...spider,
        x: spider.x + spider.vx,
        y: spider.y + spider.vy,
        active: spider.active && spider.x > -50 && spider.x < CANVAS_WIDTH + 50
      })).filter(spider => spider.active)
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
              
              const isHead = segment.isHead;
              pointsEarned += isHead ? 100 : 10;

              // Add mushroom where segment was hit
              setMushrooms(prevMushrooms => [...prevMushrooms, { 
                x: segment.x, 
                y: segment.y, 
                hits: 0, 
                maxHits: 3,
                poisoned: false
              }]);

              // Remove segment and split centipede if necessary
              newSegments.splice(segmentIndex, 1);
              
              // If we hit a middle segment, split the centipede
              if (segmentIndex < newSegments.length) {
                const remainingSegments = newSegments.slice(segmentIndex);
                remainingSegments.forEach((seg, i) => {
                  seg.id = newSegments.length + i;
                  if (i === 0) seg.isHead = true;
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
              bullet.y <= mushroom.y + MUSHROOM_SIZE
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

    // Bullets vs spiders
    setBullets(prevBullets => {
      let newBullets = [...prevBullets];
      
      setSpiders(prevSpiders => {
        let newSpiders = [...prevSpiders];
        let pointsEarned = 0;

        newBullets.forEach((bullet, bulletIndex) => {
          if (!bullet.active) return;

          newSpiders.forEach((spider, spiderIndex) => {
            if (
              bullet.x >= spider.x && 
              bullet.x <= spider.x + 30 &&
              bullet.y >= spider.y && 
              bullet.y <= spider.y + 20
            ) {
              newBullets[bulletIndex] = { ...bullet, active: false };
              pointsEarned += spider.points;
              newSpiders[spiderIndex] = { ...spider, active: false };
            }
          });
        });

        if (pointsEarned > 0) {
          setScore(prev => prev + pointsEarned);
        }

        return newSpiders.filter(spider => spider.active);
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

    // Player vs spiders
    if (!shield) {
      const spiderHit = spiders.some(spider =>
        spider.active &&
        player.x < spider.x + 30 &&
        player.x + PLAYER_SIZE > spider.x &&
        player.y < spider.y + 20 &&
        player.y + PLAYER_SIZE > spider.y
      );

      if (spiderHit) {
        setLives(prev => {
          const newLives = prev - 1;
          if (newLives <= 0) {
            setGameOver(true);
            if (onScoreUpdate) onScoreUpdate(score);
          }
          return newLives;
        });
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
              setWeaponAmmo(25);
              break;
            case 'spread':
              setWeaponType('spread');
              setWeaponAmmo(20);
              break;
            case 'rapid':
              setRapidFireTimer(300); // 5 seconds
              break;
            case 'shield':
              setShield(true);
              setShieldTimer(300);
              break;
            case 'bomb':
              // Clear all enemies on screen
              setCentipede([]);
              setSpiders([]);
              setScore(prev => prev + 500);
              break;
          }
          return false; // Remove power-up
        }
        return true;
      });
    });

    // Check centipede reaching bottom
    const reachedBottom = centipede.some(segment => segment.y >= CANVAS_HEIGHT - 60);
    if (reachedBottom) {
      setGameOver(true);
      if (onScoreUpdate) onScoreUpdate(score);
    }
  }, [centipede, player, shield, spiders, powerUps, gameOver, paused, level, createMushrooms, createCentipede, score, onScoreUpdate]);

  // Update timers
  useEffect(() => {
    if (shieldTimer > 0) {
      const timer = setTimeout(() => setShieldTimer(prev => prev - 1), 16);
      return () => clearTimeout(timer);
    } else {
      setShield(false);
    }
  }, [shieldTimer]);

  useEffect(() => {
    if (rapidFireTimer > 0) {
      const timer = setTimeout(() => setRapidFireTimer(prev => prev - 1), 16);
      return () => clearTimeout(timer);
    }
  }, [rapidFireTimer]);

  useEffect(() => {
    if (weaponAmmo <= 0 && weaponType !== 'normal') {
      setWeaponType('normal');
    }
  }, [weaponAmmo, weaponType]);

  const resetGame = () => {
    setPlayer({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50 });
    setBullets([]);
    setCentipede(createCentipede(12));
    setMushrooms(createMushrooms());
    setPowerUps([]);
    setSpiders([]);
    setScore(0);
    setLives(3);
    setLevel(1);
    setWeaponType('normal');
    setWeaponAmmo(0);
    setShield(false);
    setShieldTimer(0);
    setRapidFireTimer(0);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (centipede.length === 0) {
      setCentipede(createCentipede(12));
    }
    if (mushrooms.length === 0) {
      setMushrooms(createMushrooms());
    }
  }, [centipede.length, mushrooms.length, createCentipede, createMushrooms]);

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
      updateSpiders();
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateBullets, updateCentipede, updatePowerUps, updateSpiders, checkCollisions]);

  const getPowerUpColor = (type: PowerUp['type']) => {
    switch (type) {
      case 'laser': return 'bg-red-400';
      case 'spread': return 'bg-blue-400';
      case 'rapid': return 'bg-yellow-400';
      case 'shield': return 'bg-purple-400';
      case 'bomb': return 'bg-orange-400';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">CENTIPEDE SHOOTER</div>
            <div className="text-sm">Score: {score} | Lives: {lives} | Level: {level}</div>
            <div className="text-sm">
              Weapon: {weaponType.toUpperCase()} 
              {weaponAmmo > 0 && ` (${weaponAmmo})`}
              {rapidFireTimer > 0 && ' + RAPID'}
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
          className="relative bg-gradient-to-b from-green-900 to-black border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Player */}
          <div
            className={`absolute rounded shadow-lg ${
              shield ? 'bg-purple-400 animate-pulse' : 'bg-cyan-400'
            }`}
            style={{
              left: player.x,
              top: player.y,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
              boxShadow: shield ? '0 0 15px purple' : '0 0 10px cyan'
            }}
          />

          {/* Bullets */}
          {bullets.map((bullet, index) => (
            <div
              key={index}
              className={`absolute rounded-full shadow-lg ${
                bullet.type === 'laser' ? 'bg-red-400' :
                bullet.type === 'spread' ? 'bg-blue-400' : 'bg-white'
              }`}
              style={{
                left: bullet.x - BULLET_SIZE / 2,
                top: bullet.y - BULLET_SIZE / 2,
                width: bullet.type === 'laser' ? BULLET_SIZE * 2 : BULLET_SIZE,
                height: bullet.type === 'laser' ? BULLET_SIZE * 3 : BULLET_SIZE,
                boxShadow: `0 0 5px ${
                  bullet.type === 'laser' ? 'red' : bullet.type === 'spread' ? 'blue' : 'white'
                }`
              }}
            />
          ))}

          {/* Centipede */}
          {centipede.map((segment, index) => (
            <div
              key={segment.id}
              className={`absolute border border-white shadow-lg ${
                segment.isHead ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{
                left: segment.x,
                top: segment.y,
                width: SEGMENT_SIZE,
                height: SEGMENT_SIZE,
                borderRadius: '50%',
                boxShadow: `0 0 8px ${segment.isHead ? 'red' : 'green'}`
              }}
            >
              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                {segment.isHead ? '🐛' : '●'}
              </div>
            </div>
          ))}

          {/* Mushrooms */}
          {mushrooms.map((mushroom, index) => (
            <div
              key={index}
              className={`absolute border shadow-lg ${
                mushroom.poisoned ? 'bg-purple-400 border-purple-300' :
                mushroom.hits === 0 ? 'bg-green-400 border-green-300' :
                mushroom.hits === 1 ? 'bg-yellow-400 border-yellow-300' :
                'bg-red-400 border-red-300'
              }`}
              style={{
                left: mushroom.x,
                top: mushroom.y,
                width: MUSHROOM_SIZE,
                height: MUSHROOM_SIZE,
                opacity: 0.8
              }}
            >
              <div className="w-full h-full flex items-center justify-center text-white text-xs">
                🍄
              </div>
            </div>
          ))}

          {/* Power-ups */}
          {powerUps.map((powerUp, index) => (
            <div
              key={index}
              className={`absolute ${getPowerUpColor(powerUp.type)} border-2 border-white rounded shadow-lg animate-pulse`}
              style={{
                left: powerUp.x,
                top: powerUp.y,
                width: POWERUP_SIZE,
                height: POWERUP_SIZE,
                boxShadow: '0 0 10px white'
              }}
            >
              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                {powerUp.type === 'laser' ? '⚡' :
                 powerUp.type === 'spread' ? '💥' :
                 powerUp.type === 'rapid' ? '⚡' :
                 powerUp.type === 'shield' ? '🛡️' :
                 '💣'}
              </div>
            </div>
          ))}

          {/* Spiders */}
          {spiders.map((spider, index) => (
            <div
              key={index}
              className="absolute bg-orange-500 border border-white rounded shadow-lg"
              style={{
                left: spider.x,
                top: spider.y,
                width: 30,
                height: 20,
                boxShadow: '0 0 8px orange'
              }}
            >
              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                🕷️
              </div>
            </div>
          ))}

          {/* Shield indicator */}
          {shield && (
            <div className="absolute top-4 left-4 bg-purple-900 border border-purple-400 p-2 rounded">
              <div className="text-purple-400 text-xs retro-font">SHIELD: {Math.ceil(shieldTimer / 60)}s</div>
            </div>
          )}

          {/* Rapid fire indicator */}
          {rapidFireTimer > 0 && (
            <div className="absolute top-4 right-4 bg-yellow-900 border border-yellow-400 p-2 rounded">
              <div className="text-yellow-400 text-xs retro-font">RAPID: {Math.ceil(rapidFireTimer / 60)}s</div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font space-y-1">
          <p><strong>Arrow Keys</strong> Move • <strong>Space</strong> Shoot • <strong>P</strong> Pause</p>
          <p>Collect power-ups for special weapons! Don't let the centipede reach the bottom!</p>
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