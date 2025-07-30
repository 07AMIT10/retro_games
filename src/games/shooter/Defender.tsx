import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface DefenderProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const SHIP_WIDTH = 30;
const SHIP_HEIGHT = 20;
const HUMAN_SIZE = 10;
const ALIEN_SIZE = 15;

interface Position {
  x: number;
  y: number;
}

interface Ship extends Position {
  vx: number;
  vy: number;
}

interface Bullet extends Position {
  vx: number;
  vy: number;
  active: boolean;
}

interface Human extends Position {
  active: boolean;
  beingAbducted: boolean;
  abductorId?: number;
  rescued: boolean;
  fallSpeed?: number;
}

interface Alien extends Position {
  id: number;
  vx: number;
  vy: number;
  active: boolean;
  abducting: boolean;
  targetHumanId?: number;
  type: 'lander' | 'mutant' | 'bomber';
  health: number;
  points: number;
  shootTimer: number;
}

const Defender: React.FC<DefenderProps> = ({ onScoreUpdate }) => {
  const [ship, setShip] = useState<Ship>({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT / 2, 
    vx: 0, 
    vy: 0 
  });
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [humans, setHumans] = useState<Human[]>([]);
  const [aliens, setAliens] = useState<Alien[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [worldOffset, setWorldOffset] = useState(0);

  const createHumans = useCallback(() => {
    const newHumans: Human[] = [];
    const humanCount = 10 + Math.floor(level / 2);
    for (let i = 0; i < humanCount; i++) {
      newHumans.push({
        x: 50 + i * 70,
        y: CANVAS_HEIGHT - 20,
        active: true,
        beingAbducted: false,
        rescued: false
      });
    }
    return newHumans;
  }, [level]);

  const createAliens = useCallback(() => {
    const newAliens: Alien[] = [];
    const alienCount = 6 + level * 2;
    
    for (let i = 0; i < alienCount; i++) {
      const types: Alien['type'][] = ['lander', 'mutant', 'bomber'];
      const type = types[Math.floor(Math.random() * types.length)];
      let health: number;
      let points: number;
      
      switch (type) {
        case 'bomber':
          health = 2;
          points = 250;
          break;
        case 'mutant':
          health = 1;
          points = 150;
          break;
        default:
          health = 1;
          points = 150;
      }
      
      newAliens.push({
        id: i,
        x: Math.random() * CANVAS_WIDTH * 3, // Wider world
        y: 50 + Math.random() * 100,
        vx: (Math.random() - 0.5) * 4,
        vy: 0,
        active: true,
        abducting: false,
        type,
        health,
        points,
        shootTimer: Math.random() * 180
      });
    }
    return newAliens;
  }, [level]);

  const shoot = useCallback(() => {
    if (gameOver || paused || bullets.length >= 4) return;
    
    setBullets(prev => [
      ...prev,
      {
        x: ship.x + SHIP_WIDTH / 2,
        y: ship.y,
        vx: ship.vx + (keys.has('ArrowLeft') ? -8 : keys.has('ArrowRight') ? 8 : 0),
        vy: -8,
        active: true
      }
    ]);
  }, [ship, bullets.length, gameOver, paused, keys]);

  const updateShip = useCallback(() => {
    if (gameOver || paused) return;

    setShip(prev => {
      let newVx = prev.vx;
      let newVy = prev.vy;

      if (keys.has('ArrowLeft')) {
        newVx = Math.max(-8, prev.vx - 0.5);
      }
      if (keys.has('ArrowRight')) {
        newVx = Math.min(8, prev.vx + 0.5);
      }
      if (keys.has('ArrowUp')) {
        newVy = Math.max(-6, prev.vy - 0.3);
      }
      if (keys.has('ArrowDown')) {
        newVy = Math.min(6, prev.vy + 0.3);
      }

      // Apply friction
      newVx *= 0.95;
      newVy *= 0.95;

      let newX = prev.x + newVx;
      let newY = prev.y + newVy;

      // World wrapping (3x canvas width)
      if (newX < -SHIP_WIDTH) newX = CANVAS_WIDTH * 3;
      if (newX > CANVAS_WIDTH * 3) newX = -SHIP_WIDTH;

      // Vertical bounds
      newY = Math.max(20, Math.min(CANVAS_HEIGHT - SHIP_HEIGHT - 20, newY));

      // Update world offset to follow ship
      setWorldOffset(Math.max(0, Math.min(newX - CANVAS_WIDTH / 2, CANVAS_WIDTH * 2)));

      return { x: newX, y: newY, vx: newVx, vy: newVy };
    });
  }, [keys, gameOver, paused]);

  const updateBullets = useCallback(() => {
    if (gameOver || paused) return;

    setBullets(prev => 
      prev.map(bullet => ({
        ...bullet,
        x: bullet.x + bullet.vx,
        y: bullet.y + bullet.vy,
        active: bullet.active && bullet.y > 0 && bullet.y < CANVAS_HEIGHT && 
                bullet.x > -50 && bullet.x < CANVAS_WIDTH * 3 + 50
      })).filter(bullet => bullet.active)
    );
  }, [gameOver, paused]);

  const updateAliens = useCallback(() => {
    if (gameOver || paused) return;

    setAliens(prev => prev.map(alien => {
      if (!alien.active) return alien;

      let newX = alien.x + alien.vx;
      const newY = alien.y + alien.vy;
      let newVx = alien.vx;
      let newVy = alien.vy;
      let newShootTimer = alien.shootTimer - 1;

      // World wrapping
      if (newX < -ALIEN_SIZE) newX = CANVAS_WIDTH * 3;
      if (newX > CANVAS_WIDTH * 3) newX = -ALIEN_SIZE;

      // Different behavior per alien type
      if (alien.type === 'lander') {
        // Abduction behavior
        if (!alien.abducting && Math.random() < 0.002) {
          const availableHumans = humans.filter(h => h.active && !h.beingAbducted);
          if (availableHumans.length > 0) {
            const targetHuman = availableHumans[Math.floor(Math.random() * availableHumans.length)];
            const humanIndex = humans.indexOf(targetHuman);
            
            setHumans(prevHumans => 
              prevHumans.map((h, idx) => 
                idx === humanIndex ? { ...h, beingAbducted: true, abductorId: alien.id } : h
              )
            );
            
            return {
              ...alien,
              abducting: true,
              targetHumanId: humanIndex,
              vy: 2
            };
          }
        }

        if (alien.abducting && alien.targetHumanId !== undefined) {
          const targetHuman = humans[alien.targetHumanId];
          if (targetHuman && targetHuman.active) {
            newVx = (targetHuman.x - alien.x) * 0.03;
            newVy = 2;
            
            // Check if alien reached human
            if (Math.abs(alien.x - targetHuman.x) < 20 && alien.y > targetHuman.y - 30) {
              setHumans(prevHumans => 
                prevHumans.map((h, idx) => 
                  idx === alien.targetHumanId ? { ...h, active: false } : h
                )
              );
              newVy = -4; // Fly away with human
            }
          }
        }
      } else if (alien.type === 'mutant') {
        // Aggressive pursuit of player
        const dx = ship.x - alien.x;
        const dy = ship.y - alien.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          newVx = (dx / distance) * 3;
          newVy = (dy / distance) * 2;
        }
      } else if (alien.type === 'bomber') {
        // Bombing runs
        if (Math.abs(alien.x - ship.x) < 100) {
          newVy = 3; // Dive toward player
        } else {
          newVy = Math.sin(Date.now() * 0.001) * 2;
        }
      }

      // Shooting
      if (newShootTimer <= 0 && Math.random() < 0.01) {
        // Aliens don't shoot bullets in this simplified version
        // But they could shoot at the player here
        newShootTimer = 60 + Math.random() * 120;
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
  }, [gameOver, paused, humans, ship]);

  const updateHumans = useCallback(() => {
    if (gameOver || paused) return;

    setHumans(prev => prev.map(human => {
      if (!human.active || human.beingAbducted) return human;

      // Handle falling humans (rescued but dropped)
      if (human.fallSpeed) {
        const newY = human.y + human.fallSpeed;
        if (newY >= CANVAS_HEIGHT - 20) {
          return { ...human, y: CANVAS_HEIGHT - 20, fallSpeed: undefined };
        }
        return { ...human, y: newY, fallSpeed: human.fallSpeed + 0.5 };
      }

      return human;
    }));
  }, [gameOver, paused]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Bullets vs aliens
    setBullets(prevBullets => {
      const newBullets = [...prevBullets];
      
      setAliens(prevAliens => {
        const newAliens = [...prevAliens];
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
                health: alien.health - 1 
              };
              
              if (newAliens[alienIndex].health <= 0) {
                newAliens[alienIndex].active = false;
                pointsEarned += alien.points * level;

                // Free any human being abducted
                if (alien.abducting && alien.targetHumanId !== undefined) {
                  setHumans(prevHumans => 
                    prevHumans.map((h, idx) => 
                      idx === alien.targetHumanId ? 
                      { ...h, beingAbducted: false, abductorId: undefined, fallSpeed: 2 } : h
                    )
                  );
                }
              }
            }
          });
        });

        if (pointsEarned > 0) {
          setScore(prev => prev + pointsEarned);
        }

        // Check if all aliens destroyed
        const activeAliens = newAliens.filter(alien => alien.active);
        if (activeAliens.length === 0) {
          setLevel(prev => prev + 1);
          return createAliens();
        }

        return newAliens;
      });

      return newBullets.filter(bullet => bullet.active);
    });

    // Ship vs aliens collision
    const shipHit = aliens.some(alien => 
      alien.active &&
      ship.x < alien.x + ALIEN_SIZE &&
      ship.x + SHIP_WIDTH > alien.x &&
      ship.y < alien.y + ALIEN_SIZE &&
      ship.y + SHIP_HEIGHT > alien.y
    );

    if (shipHit) {
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setGameOver(true);
          if (onScoreUpdate) onScoreUpdate(score);
        }
        return newLives;
      });
    }

    // Ship vs human rescue
    humans.forEach((human, humanIndex) => {
      if (human.active && !human.beingAbducted && human.fallSpeed &&
          ship.x < human.x + HUMAN_SIZE &&
          ship.x + SHIP_WIDTH > human.x &&
          ship.y < human.y + HUMAN_SIZE &&
          ship.y + SHIP_HEIGHT > human.y) {
        
        setHumans(prev => 
          prev.map((h, idx) => 
            idx === humanIndex ? { ...h, rescued: true, fallSpeed: undefined } : h
          )
        );
        setScore(prev => prev + 500); // Rescue bonus
      }
    });

    // Check if all humans are gone
    const activeHumans = humans.filter(h => h.active);
    if (activeHumans.length === 0) {
      setGameOver(true);
      if (onScoreUpdate) onScoreUpdate(score);
    }
  }, [aliens, ship, humans, gameOver, paused, score, level, createAliens, onScoreUpdate]);

  const resetGame = () => {
    setShip({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, vx: 0, vy: 0 });
    setBullets([]);
    setHumans(createHumans());
    setAliens(createAliens());
    setScore(0);
    setLives(3);
    setLevel(1);
    setWorldOffset(0);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (humans.length === 0) {
      setHumans(createHumans());
    }
    if (aliens.length === 0) {
      setAliens(createAliens());
    }
  }, [humans.length, aliens.length, createHumans, createAliens]);

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
      updateShip();
      updateBullets();
      updateAliens();
      updateHumans();
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updateShip, updateBullets, updateAliens, updateHumans, checkCollisions]);

  const getAlienColor = (alien: Alien) => {
    switch (alien.type) {
      case 'bomber': return 'bg-red-500';
      case 'mutant': return 'bg-purple-500';
      case 'lander': return 'bg-orange-500';
    }
  };

  // Calculate visible positions based on world offset
  const getVisibleX = (worldX: number) => worldX - worldOffset;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">DEFENDER</div>
            <div className="text-sm">Score: {score} | Lives: {lives} | Level: {level}</div>
            <div className="text-sm">Humans: {humans.filter(h => h.active).length}/
              {humans.filter(h => h.rescued).length} rescued</div>
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
          className="relative bg-gradient-to-b from-purple-900 to-green-800 border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Ground */}
          <div
            className="absolute bg-green-600"
            style={{
              left: 0,
              top: CANVAS_HEIGHT - 30,
              width: CANVAS_WIDTH,
              height: 30
            }}
          />

          {/* Ship */}
          <div
            className="absolute bg-cyan-400 shadow-lg"
            style={{
              left: getVisibleX(ship.x),
              top: ship.y,
              width: SHIP_WIDTH,
              height: SHIP_HEIGHT,
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
              boxShadow: '0 0 10px cyan'
            }}
          />

          {/* Bullets */}
          {bullets.map((bullet, index) => (
            <div
              key={`bullet-${index}`}
              className="absolute bg-yellow-400 rounded-full shadow-lg"
              style={{
                left: getVisibleX(bullet.x) - 2,
                top: bullet.y - 2,
                width: 4,
                height: 4,
                boxShadow: '0 0 5px yellow'
              }}
            />
          ))}

          {/* Humans */}
          {humans.filter(h => h.active).map((human, index) => {
            const visibleX = getVisibleX(human.x);
            if (visibleX < -HUMAN_SIZE || visibleX > CANVAS_WIDTH) return null;
            
            return (
              <div
                key={`human-${index}`}
                className={`absolute rounded shadow-lg ${
                  human.beingAbducted ? 'bg-red-400 animate-pulse' : 
                  human.rescued ? 'bg-green-400' :
                  human.fallSpeed ? 'bg-yellow-400' : 'bg-blue-400'
                }`}
                style={{
                  left: visibleX - HUMAN_SIZE / 2,
                  top: human.y - HUMAN_SIZE / 2,
                  width: HUMAN_SIZE,
                  height: HUMAN_SIZE,
                  boxShadow: human.rescued ? '0 0 8px green' : '0 0 5px blue'
                }}
              />
            );
          })}

          {/* Aliens */}
          {aliens.filter(alien => alien.active).map((alien, index) => {
            const visibleX = getVisibleX(alien.x);
            if (visibleX < -ALIEN_SIZE || visibleX > CANVAS_WIDTH) return null;
            
            return (
              <div
                key={`alien-${index}`}
                className={`absolute ${getAlienColor(alien)} border border-white shadow-lg`}
                style={{
                  left: visibleX,
                  top: alien.y,
                  width: ALIEN_SIZE,
                  height: ALIEN_SIZE,
                  clipPath: alien.type === 'bomber' ? 'polygon(50% 0%, 0% 50%, 50% 100%, 100% 50%)' : 'none',
                  boxShadow: `0 0 8px ${alien.type === 'bomber' ? 'red' : alien.type === 'mutant' ? 'purple' : 'orange'}`,
                  opacity: alien.abducting ? 0.8 : 1
                }}
              >
                <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                  {alien.type === 'bomber' ? '💣' : alien.type === 'mutant' ? '👹' : '👽'}
                </div>
              </div>
            );
          })}

          {/* Minimap */}
          <div className="absolute top-2 right-2 bg-black bg-opacity-70 border border-cyan-400 p-1">
            <div className="w-24 h-8 relative">
              {/* Ship position on minimap */}
              <div
                className="absolute bg-cyan-400 w-1 h-2"
                style={{ left: (ship.x / (CANVAS_WIDTH * 3)) * 24 }}
              />
              {/* Humans on minimap */}
              {humans.filter(h => h.active).map((human, idx) => (
                <div
                  key={idx}
                  className={`absolute w-0.5 h-1 ${human.beingAbducted ? 'bg-red-400' : 'bg-blue-400'}`}
                  style={{ left: (human.x / (CANVAS_WIDTH * 3)) * 24, top: 6 }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font space-y-1">
          <p><strong>Arrow Keys</strong> Move • <strong>Space</strong> Shoot • <strong>P</strong> Pause</p>
          <p>Protect humans from abduction! Rescue falling humans for bonus points!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">MISSION FAILED!</div>
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

export default Defender;