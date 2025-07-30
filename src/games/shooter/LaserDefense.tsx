import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface LaserDefenseProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 30;
const ALIEN_SIZE = 25;
const BULLET_SIZE = 4;
const POWERUP_SIZE = 20;

interface Position {
  x: number;
  y: number;
}

interface Bullet extends Position {
  vx: number;
  vy: number;
  active: boolean;
  type: 'normal' | 'laser' | 'plasma';
  damage: number;
}

interface Alien extends Position {
  vx: number;
  vy: number;
  active: boolean;
  type: 'scout' | 'fighter' | 'bomber' | 'boss';
  health: number;
  maxHealth: number;
  shootTimer: number;
  points: number;
  special: boolean;
}

interface PowerUp extends Position {
  type: 'health' | 'weapon' | 'shield' | 'multishot' | 'speed';
  active: boolean;
  timer: number;
}

interface Explosion extends Position {
  radius: number;
  maxRadius: number;
  timer: number;
}

const LaserDefense: React.FC<LaserDefenseProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Position>({ 
    x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, 
    y: CANVAS_HEIGHT - PLAYER_SIZE - 10 
  });
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [aliens, setAliens] = useState<Alien[]>([]);
  const [alienBullets, setAlienBullets] = useState<Bullet[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [weaponType, setWeaponType] = useState<'normal' | 'laser' | 'plasma'>('normal');
  const [weaponLevel, setWeaponLevel] = useState(1);
  const [shield, setShield] = useState(false);
  const [shieldTimer, setShieldTimer] = useState(0);
  const [speedBoost, setSpeedBoost] = useState(false);
  const [speedTimer, setSpeedTimer] = useState(0);
  const [multishot, setMultishot] = useState(false);
  const [multishotTimer, setMultishotTimer] = useState(0);
  const [bossActive, setBossActive] = useState(false);

  const createAliens = useCallback(() => {
    const newAliens: Alien[] = [];
    const alienCount = 8 + level * 3;
    const bossChance = level % 5 === 0;
    
    if (bossChance && !bossActive) {
      // Spawn boss
      newAliens.push({
        x: CANVAS_WIDTH / 2 - ALIEN_SIZE / 2,
        y: 50,
        vx: 1,
        vy: 0.5,
        active: true,
        type: 'boss',
        health: 50 + level * 10,
        maxHealth: 50 + level * 10,
        shootTimer: 0,
        points: 1000,
        special: false
      });
      setBossActive(true);
    }

    for (let i = 0; i < alienCount; i++) {
      const types: Alien['type'][] = ['scout', 'fighter', 'bomber'];
      const weights = [0.4, 0.4, 0.2]; // Probabilities
      
      let type: Alien['type'] = 'scout';
      const rand = Math.random();
      let cumulative = 0;
      
      for (let j = 0; j < types.length; j++) {
        cumulative += weights[j];
        if (rand <= cumulative) {
          type = types[j];
          break;
        }
      }

      let health: number;
      let points: number;
      let special = false;

      switch (type) {
        case 'scout':
          health = 1 + Math.floor(level / 3);
          points = 100;
          special = Math.random() < 0.1; // 10% chance for special scout
          break;
        case 'fighter':
          health = 2 + Math.floor(level / 2);
          points = 200;
          special = Math.random() < 0.15;
          break;
        case 'bomber':
          health = 3 + Math.floor(level / 2);
          points = 300;
          special = Math.random() < 0.2;
          break;
        default:
          health = 1;
          points = 100;
      }

      newAliens.push({
        x: Math.random() * (CANVAS_WIDTH - ALIEN_SIZE),
        y: -ALIEN_SIZE - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: 1 + Math.random() * 2 + level * 0.1,
        active: true,
        type,
        health,
        maxHealth: health,
        shootTimer: Math.random() * 120,
        points,
        special
      });
    }
    
    return newAliens;
  }, [level, bossActive]);

  const spawnPowerUp = useCallback(() => {
    if (Math.random() < 0.008 && powerUps.length < 2) {
      const types: PowerUp['type'][] = ['health', 'weapon', 'shield', 'multishot', 'speed'];
      setPowerUps(prev => [...prev, {
        x: Math.random() * (CANVAS_WIDTH - POWERUP_SIZE),
        y: -POWERUP_SIZE,
        type: types[Math.floor(Math.random() * types.length)],
        active: true,
        timer: 600
      }]);
    }
  }, [powerUps.length]);

  const shoot = useCallback(() => {
    if (gameOver || paused || bullets.length >= (multishot ? 8 : 4)) return;
    
    const bulletSpeed = 12;
    const damage = weaponLevel;
    
    if (multishot) {
      // Multiple bullets
      for (let i = -1; i <= 1; i++) {
        setBullets(prev => [...prev, {
          x: player.x + PLAYER_SIZE / 2 + i * 15,
          y: player.y,
          vx: i * 2,
          vy: -bulletSpeed,
          active: true,
          type: weaponType,
          damage
        }]);
      }
    } else {
      setBullets(prev => [...prev, {
        x: player.x + PLAYER_SIZE / 2,
        y: player.y,
        vx: 0,
        vy: -bulletSpeed,
        active: true,
        type: weaponType,
        damage
      }]);
    }
  }, [player, bullets.length, gameOver, paused, weaponType, weaponLevel, multishot]);

  const updatePlayer = useCallback(() => {
    if (gameOver || paused) return;

    setPlayer(prev => {
      let newX = prev.x;
      const moveSpeed = speedBoost ? 8 : 5;

      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) {
        newX = Math.max(0, prev.x - moveSpeed);
      }
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) {
        newX = Math.min(CANVAS_WIDTH - PLAYER_SIZE, prev.x + moveSpeed);
      }

      return { ...prev, x: newX };
    });
  }, [keys, gameOver, paused, speedBoost]);

  const updateBullets = useCallback(() => {
    if (gameOver || paused) return;

    setBullets(prev => 
      prev.map(bullet => ({
        ...bullet,
        x: bullet.x + bullet.vx,
        y: bullet.y + bullet.vy,
        active: bullet.active && bullet.y > 0
      })).filter(bullet => bullet.active)
    );

    setAlienBullets(prev =>
      prev.map(bullet => ({
        ...bullet,
        x: bullet.x + bullet.vx,
        y: bullet.y + bullet.vy,
        active: bullet.active && bullet.y < CANVAS_HEIGHT && bullet.x > 0 && bullet.x < CANVAS_WIDTH
      })).filter(bullet => bullet.active)
    );
  }, [gameOver, paused]);

  const updateAliens = useCallback(() => {
    if (gameOver || paused) return;

    setAliens(prev => prev.map(alien => {
      if (!alien.active) return alien;

      let newX = alien.x + alien.vx;
      let newY = alien.y + alien.vy;
      let newVx = alien.vx;
      let newVy = alien.vy;
      let newShootTimer = alien.shootTimer - 1;

      // Boundary checking and movement patterns
      if (alien.type === 'boss') {
        // Boss movement pattern
        if (newX <= 0 || newX >= CANVAS_WIDTH - ALIEN_SIZE) {
          newVx = -newVx;
        }
        newY += Math.sin(Date.now() * 0.002) * 0.5;
        
        // Boss shooting pattern
        if (newShootTimer <= 0) {
          const patterns = [
            // Spread shot
            () => {
              for (let i = -2; i <= 2; i++) {
                setAlienBullets(prev => [...prev, {
                  x: alien.x + ALIEN_SIZE / 2,
                  y: alien.y + ALIEN_SIZE,
                  vx: i * 2,
                  vy: 4,
                  active: true,
                  type: 'plasma',
                  damage: 1
                }]);
              }
            },
            // Targeted shot
            () => {
              const dx = player.x - alien.x;
              const dy = player.y - alien.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              setAlienBullets(prev => [...prev, {
                x: alien.x + ALIEN_SIZE / 2,
                y: alien.y + ALIEN_SIZE,
                vx: (dx / distance) * 5,
                vy: (dy / distance) * 5,
                active: true,
                type: 'laser',
                damage: 1
              }]);
            }
          ];
          
          patterns[Math.floor(Math.random() * patterns.length)]();
          newShootTimer = 60 + Math.random() * 60;
        }
      } else {
        // Regular alien movement
        if (newX <= 0 || newX >= CANVAS_WIDTH - ALIEN_SIZE) {
          newVx = -newVx;
        }

        // Special movement for different types
        if (alien.type === 'scout') {
          // Fast zigzag movement
          newVx += (Math.random() - 0.5) * 1;
          newVx = Math.max(-3, Math.min(3, newVx));
        } else if (alien.type === 'fighter') {
          // Pursue player
          if (Math.abs(alien.x - player.x) > 50) {
            newVx = alien.x > player.x ? -1 : 1;
          }
        } else if (alien.type === 'bomber') {
          // Slow but steady
          newVy = Math.max(0.5, newVy);
        }

        // Shooting
        if (newShootTimer <= 0 && alien.y > 0) {
          const shootChance = alien.type === 'fighter' ? 0.02 : 
                            alien.type === 'bomber' ? 0.015 : 0.01;
          
          if (Math.random() < shootChance) {
            if (alien.special) {
              // Special aliens shoot better
              const dx = player.x - alien.x;
              const dy = player.y - alien.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              setAlienBullets(prev => [...prev, {
                x: alien.x + ALIEN_SIZE / 2,
                y: alien.y + ALIEN_SIZE,
                vx: (dx / distance) * 3,
                vy: (dy / distance) * 3,
                active: true,
                type: 'laser',
                damage: 1
              }]);
            } else {
              setAlienBullets(prev => [...prev, {
                x: alien.x + ALIEN_SIZE / 2,
                y: alien.y + ALIEN_SIZE,
                vx: 0,
                vy: 3 + level * 0.2,
                active: true,
                type: 'normal',
                damage: 1
              }]);
            }
            newShootTimer = 120 + Math.random() * 180;
          }
        }
      }

      return { 
        ...alien, 
        x: newX, 
        y: newY, 
        vx: newVx, 
        vy: newVy, 
        shootTimer: newShootTimer 
      };
    }));

    spawnPowerUp();
  }, [gameOver, paused, level, player, spawnPowerUp]);

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

  const updateExplosions = useCallback(() => {
    if (gameOver || paused) return;

    setExplosions(prev => 
      prev.map(explosion => ({
        ...explosion,
        radius: Math.min(explosion.radius + 2, explosion.maxRadius),
        timer: explosion.timer - 1
      })).filter(explosion => explosion.timer > 0)
    );
  }, [gameOver, paused]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Player bullets vs aliens
    setBullets(prevBullets => {
      let newBullets = [...prevBullets];
      
      setAliens(prevAliens => {
        let newAliens = [...prevAliens];
        let pointsEarned = 0;

        newBullets.forEach((bullet, bulletIndex) => {
          if (!bullet.active) return;

          newAliens.forEach((alien, alienIndex) => {
            if (!alien.active) return;

            if (
              bullet.x >= alien.x && 
              bullet.x <= alien.x + ALIEN_SIZE &&
              bullet.y >= alien.y && 
              bullet.y <= alien.y + ALIEN_SIZE
            ) {
              newBullets[bulletIndex] = { ...bullet, active: false };
              newAliens[alienIndex] = { 
                ...alien, 
                health: alien.health - bullet.damage 
              };
              
              if (newAliens[alienIndex].health <= 0) {
                newAliens[alienIndex].active = false;
                pointsEarned += alien.points * level;
                
                // Create explosion
                setExplosions(prev => [...prev, {
                  x: alien.x + ALIEN_SIZE / 2,
                  y: alien.y + ALIEN_SIZE / 2,
                  radius: 0,
                  maxRadius: alien.type === 'boss' ? 50 : 25,
                  timer: 30
                }]);

                // Boss defeated
                if (alien.type === 'boss') {
                  setBossActive(false);
                  pointsEarned += 2000; // Bonus for boss
                }

                // Chance to drop power-up
                if (Math.random() < 0.1) {
                  const types: PowerUp['type'][] = ['health', 'weapon', 'shield', 'multishot', 'speed'];
                  setPowerUps(prevPowerUps => [...prevPowerUps, {
                    x: alien.x,
                    y: alien.y,
                    type: types[Math.floor(Math.random() * types.length)],
                    active: true,
                    timer: 300
                  }]);
                }
              }
            }
          });
        });

        if (pointsEarned > 0) {
          setScore(prev => prev + pointsEarned);
        }

        // Check if wave complete
        const activeAliens = newAliens.filter(alien => alien.active);
        if (activeAliens.length === 0) {
          setLevel(prev => prev + 1);
          return createAliens();
        }

        return newAliens;
      });

      return newBullets.filter(bullet => bullet.active);
    });

    // Alien bullets vs player
    if (!shield) {
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
    } else {
      // Shield deflects bullets
      setAlienBullets(prev => prev.filter(bullet => 
        !(bullet.x >= player.x && 
          bullet.x <= player.x + PLAYER_SIZE &&
          bullet.y >= player.y && 
          bullet.y <= player.y + PLAYER_SIZE)
      ));
    }

    // Aliens vs player collision
    if (!shield) {
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
            case 'health':
              setLives(prev => Math.min(5, prev + 1));
              break;
            case 'weapon':
              if (weaponType === 'normal') {
                setWeaponType('laser');
                setWeaponLevel(1);
              } else if (weaponType === 'laser') {
                setWeaponType('plasma');
                setWeaponLevel(1);
              } else {
                setWeaponLevel(prev => Math.min(3, prev + 1));
              }
              break;
            case 'shield':
              setShield(true);
              setShieldTimer(300); // 5 seconds
              break;
            case 'multishot':
              setMultishot(true);
              setMultishotTimer(360); // 6 seconds
              break;
            case 'speed':
              setSpeedBoost(true);
              setSpeedTimer(240); // 4 seconds
              break;
          }
          return false; // Remove power-up
        }
        return true;
      });
    });

    // Check aliens reaching bottom
    const reachedBottom = aliens.some(alien => alien.active && alien.y >= CANVAS_HEIGHT - 30);
    if (reachedBottom) {
      setGameOver(true);
      if (onScoreUpdate) onScoreUpdate(score);
    }
  }, [aliens, player, shield, gameOver, paused, score, onScoreUpdate, level, createAliens, weaponType]);

  // Update power-up timers
  useEffect(() => {
    if (shieldTimer > 0) {
      const timer = setTimeout(() => setShieldTimer(prev => prev - 1), 16);
      return () => clearTimeout(timer);
    } else {
      setShield(false);
    }
  }, [shieldTimer]);

  useEffect(() => {
    if (speedTimer > 0) {
      const timer = setTimeout(() => setSpeedTimer(prev => prev - 1), 16);
      return () => clearTimeout(timer);
    } else {
      setSpeedBoost(false);
    }
  }, [speedTimer]);

  useEffect(() => {
    if (multishotTimer > 0) {
      const timer = setTimeout(() => setMultishotTimer(prev => prev - 1), 16);
      return () => clearTimeout(timer);
    } else {
      setMultishot(false);
    }
  }, [multishotTimer]);

  const resetGame = () => {
    setPlayer({ x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, y: CANVAS_HEIGHT - PLAYER_SIZE - 10 });
    setBullets([]);
    setAliens(createAliens());
    setAlienBullets([]);
    setPowerUps([]);
    setExplosions([]);
    setScore(0);
    setLives(3);
    setLevel(1);
    setWeaponType('normal');
    setWeaponLevel(1);
    setShield(false);
    setShieldTimer(0);
    setSpeedBoost(false);
    setSpeedTimer(0);
    setMultishot(false);
    setMultishotTimer(0);
    setBossActive(false);
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
      updateAliens();
      updatePowerUps();
      updateExplosions();
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateBullets, updateAliens, updatePowerUps, updateExplosions, checkCollisions]);

  const getAlienColor = (alien: Alien) => {
    if (alien.special) return 'bg-yellow-500 animate-pulse';
    switch (alien.type) {
      case 'boss': return 'bg-red-600';
      case 'bomber': return 'bg-orange-500';
      case 'fighter': return 'bg-purple-500';
      case 'scout': return 'bg-green-500';
    }
  };

  const getPowerUpColor = (type: PowerUp['type']) => {
    switch (type) {
      case 'health': return 'bg-red-400';
      case 'weapon': return 'bg-blue-400';
      case 'shield': return 'bg-purple-400';
      case 'multishot': return 'bg-orange-400';
      case 'speed': return 'bg-green-400';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">LASER DEFENSE</div>
            <div className="text-sm">Score: {score} | Lives: {lives} | Level: {level}</div>
            <div className="text-sm">
              Weapon: {weaponType.toUpperCase()} L{weaponLevel}
              {multishot && ' + MULTI'}
              {speedBoost && ' + SPEED'}
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
          className="relative bg-gradient-to-b from-purple-900 to-black border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Player */}
          <div
            className={`absolute shadow-lg ${
              shield ? 'bg-purple-400 animate-pulse' : 'bg-cyan-400'
            }`}
            style={{
              left: player.x,
              top: player.y,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
              boxShadow: shield ? '0 0 20px purple' : '0 0 10px cyan'
            }}
          />

          {/* Player bullets */}
          {bullets.map((bullet, index) => (
            <div
              key={`bullet-${index}`}
              className={`absolute rounded-full shadow-lg ${
                bullet.type === 'plasma' ? 'bg-purple-400' :
                bullet.type === 'laser' ? 'bg-red-400' : 'bg-yellow-400'
              }`}
              style={{
                left: bullet.x - BULLET_SIZE / 2,
                top: bullet.y - BULLET_SIZE / 2,
                width: bullet.type === 'plasma' ? BULLET_SIZE * 1.5 : BULLET_SIZE,
                height: bullet.type === 'laser' ? BULLET_SIZE * 2 : BULLET_SIZE,
                boxShadow: `0 0 8px ${
                  bullet.type === 'plasma' ? 'purple' : bullet.type === 'laser' ? 'red' : 'yellow'
                }`
              }}
            />
          ))}

          {/* Alien bullets */}
          {alienBullets.map((bullet, index) => (
            <div
              key={`alien-bullet-${index}`}
              className={`absolute rounded-full shadow-lg ${
                bullet.type === 'plasma' ? 'bg-purple-600' :
                bullet.type === 'laser' ? 'bg-red-600' : 'bg-orange-400'
              }`}
              style={{
                left: bullet.x - BULLET_SIZE / 2,
                top: bullet.y - BULLET_SIZE / 2,
                width: BULLET_SIZE,
                height: BULLET_SIZE,
                boxShadow: `0 0 5px ${
                  bullet.type === 'plasma' ? 'purple' : bullet.type === 'laser' ? 'red' : 'orange'
                }`
              }}
            />
          ))}

          {/* Aliens */}
          {aliens.filter(alien => alien.active).map((alien, index) => (
            <div
              key={`alien-${index}`}
              className={`absolute ${getAlienColor(alien)} border border-white shadow-lg`}
              style={{
                left: alien.x,
                top: alien.y,
                width: alien.type === 'boss' ? ALIEN_SIZE * 2 : ALIEN_SIZE,
                height: alien.type === 'boss' ? ALIEN_SIZE * 2 : ALIEN_SIZE,
                clipPath: alien.type === 'boss' ? 'polygon(50% 0%, 0% 40%, 20% 100%, 80% 100%, 100% 40%)' : 'none',
                boxShadow: `0 0 10px ${
                  alien.type === 'boss' ? 'red' : alien.type === 'bomber' ? 'orange' :
                  alien.type === 'fighter' ? 'purple' : 'green'
                }`
              }}
            >
              {/* Health bar for damaged aliens */}
              {alien.health < alien.maxHealth && (
                <div className="absolute -top-2 left-0 w-full h-1 bg-red-800">
                  <div 
                    className="h-full bg-red-400"
                    style={{ width: `${(alien.health / alien.maxHealth) * 100}%` }}
                  />
                </div>
              )}
              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                {alien.type === 'boss' ? '👾' : alien.type === 'bomber' ? '💣' :
                 alien.type === 'fighter' ? '⚔️' : '🛸'}
              </div>
            </div>
          ))}

          {/* Power-ups */}
          {powerUps.map((powerUp, index) => (
            <div
              key={`powerup-${index}`}
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
                {powerUp.type === 'health' ? '❤️' :
                 powerUp.type === 'weapon' ? '🔫' :
                 powerUp.type === 'shield' ? '🛡️' :
                 powerUp.type === 'multishot' ? '💥' :
                 '⚡'}
              </div>
            </div>
          ))}

          {/* Explosions */}
          {explosions.map((explosion, index) => (
            <div
              key={`explosion-${index}`}
              className="absolute bg-orange-400 border-2 border-red-400 rounded-full"
              style={{
                left: explosion.x - explosion.radius,
                top: explosion.y - explosion.radius,
                width: explosion.radius * 2,
                height: explosion.radius * 2,
                opacity: 0.8,
                boxShadow: '0 0 20px orange'
              }}
            />
          ))}

          {/* Power-up timers */}
          <div className="absolute top-4 left-4 space-y-1">
            {shield && (
              <div className="bg-purple-900 border border-purple-400 p-1 rounded">
                <div className="text-purple-400 text-xs retro-font">SHIELD: {Math.ceil(shieldTimer / 60)}s</div>
              </div>
            )}
            {speedBoost && (
              <div className="bg-green-900 border border-green-400 p-1 rounded">
                <div className="text-green-400 text-xs retro-font">SPEED: {Math.ceil(speedTimer / 60)}s</div>
              </div>
            )}
            {multishot && (
              <div className="bg-orange-900 border border-orange-400 p-1 rounded">
                <div className="text-orange-400 text-xs retro-font">MULTI: {Math.ceil(multishotTimer / 60)}s</div>
              </div>
            )}
          </div>

          {bossActive && (
            <div className="absolute top-4 right-4 bg-red-900 border border-red-400 p-2 rounded">
              <div className="text-red-400 text-sm retro-font font-bold animate-pulse">BOSS BATTLE!</div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font space-y-1">
          <p><strong>←→</strong> Move • <strong>Space</strong> Shoot • <strong>P</strong> Pause</p>
          <p>Collect power-ups to upgrade your weapons! Special aliens glow and are more dangerous!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">DEFENSE FAILED!</div>
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

export default LaserDefense;