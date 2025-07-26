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
}

interface Alien extends Position {
  id: number;
  vx: number;
  vy: number;
  active: boolean;
  abducting: boolean;
  targetHumanId?: number;
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

  const createHumans = useCallback(() => {
    const newHumans: Human[] = [];
    for (let i = 0; i < 10; i++) {
      newHumans.push({
        x: 50 + i * 70,
        y: CANVAS_HEIGHT - 20,
        active: true,
        beingAbducted: false
      });
    }
    return newHumans;
  }, []);

  const createAliens = useCallback(() => {
    const newAliens: Alien[] = [];
    for (let i = 0; i < 6 + level; i++) {
      newAliens.push({
        id: i,
        x: Math.random() * CANVAS_WIDTH,
        y: 50 + Math.random() * 100,
        vx: (Math.random() - 0.5) * 4,
        vy: 0,
        active: true,
        abducting: false
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
        vx: ship.vx,
        vy: -8,
        active: true
      }
    ]);
  }, [ship, bullets.length, gameOver, paused]);

  const updateShip = useCallback(() => {
    if (gameOver || paused) return;

    setShip(prev => {
      let newVx = prev.vx;
      let newVy = prev.vy;

      if (keys.has('ArrowLeft')) {
        newVx = Math.max(-6, prev.vx - 0.3);
      }
      if (keys.has('ArrowRight')) {
        newVx = Math.min(6, prev.vx + 0.3);
      }
      if (keys.has('ArrowUp')) {
        newVy = Math.max(-4, prev.vy - 0.2);
      }
      if (keys.has('ArrowDown')) {
        newVy = Math.min(4, prev.vy + 0.2);
      }

      // Apply friction
      newVx *= 0.95;
      newVy *= 0.95;

      let newX = prev.x + newVx;
      let newY = prev.y + newVy;

      // Screen wrapping
      if (newX < -SHIP_WIDTH) newX = CANVAS_WIDTH;
      if (newX > CANVAS_WIDTH) newX = -SHIP_WIDTH;

      // Vertical bounds
      newY = Math.max(20, Math.min(CANVAS_HEIGHT - SHIP_HEIGHT - 20, newY));

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
        active: bullet.active && bullet.y > 0 && bullet.y < CANVAS_HEIGHT
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

      // Screen wrapping
      if (newX < -ALIEN_SIZE) newX = CANVAS_WIDTH;
      if (newX > CANVAS_WIDTH) newX = -ALIEN_SIZE;

      // Abduction behavior
      if (!alien.abducting && Math.random() < 0.001) {
        const availableHumans = humans.filter(h => h.active && !h.beingAbducted);
        if (availableHumans.length > 0) {
          const targetHuman = availableHumans[Math.floor(Math.random() * availableHumans.length)];
          setHumans(prevHumans => 
            prevHumans.map(h => 
              h === targetHuman ? { ...h, beingAbducted: true, abductorId: alien.id } : h
            )
          );
          
          return {
            ...alien,
            abducting: true,
            targetHumanId: humans.indexOf(targetHuman),
            vy: 2
          };
        }
      }

      if (alien.abducting && alien.targetHumanId !== undefined) {
        const targetHuman = humans[alien.targetHumanId];
        if (targetHuman && targetHuman.active) {
          newVx = (targetHuman.x - alien.x) * 0.02;
          newVy = 1;
          
          // Check if alien reached human
          if (Math.abs(alien.x - targetHuman.x) < 20 && alien.y > targetHuman.y - 30) {
            setHumans(prevHumans => 
              prevHumans.map(h => 
                h === targetHuman ? { ...h, active: false } : h
              )
            );
            newVy = -3; // Fly away with human
          }
        }
      }

      return { ...alien, x: newX, y: newY, vx: newVx, vy: newVy };
    }));
  }, [gameOver, paused, humans]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Bullets vs aliens
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
              newAliens[alienIndex] = { ...alien, active: false };
              pointsEarned += 150;

              // Free any human being abducted
              if (alien.abducting && alien.targetHumanId !== undefined) {
                setHumans(prevHumans => 
                  prevHumans.map(h => 
                    h.abductorId === alien.id ? 
                    { ...h, beingAbducted: false, abductorId: undefined } : h
                  )
                );
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
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updateShip, updateBullets, updateAliens, checkCollisions]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">DEFENDER</div>
            <div className="text-sm">Score: {score} | Lives: {lives} | Level: {level}</div>
            <div className="text-sm">Humans: {humans.filter(h => h.active).length}/10</div>
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
            className="absolute bg-cyan-400"
            style={{
              left: ship.x,
              top: ship.y,
              width: SHIP_WIDTH,
              height: SHIP_HEIGHT,
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
            }}
          />

          {/* Bullets */}
          {bullets.map((bullet, index) => (
            <div
              key={`bullet-${index}`}
              className="absolute bg-yellow-400 rounded-full"
              style={{
                left: bullet.x - 2,
                top: bullet.y - 2,
                width: 4,
                height: 4
              }}
            />
          ))}

          {/* Humans */}
          {humans.filter(h => h.active).map((human, index) => (
            <div
              key={`human-${index}`}
              className={`absolute rounded ${
                human.beingAbducted ? 'bg-red-400 animate-pulse' : 'bg-blue-400'
              }`}
              style={{
                left: human.x - HUMAN_SIZE / 2,
                top: human.y - HUMAN_SIZE / 2,
                width: HUMAN_SIZE,
                height: HUMAN_SIZE
              }}
            />
          ))}

          {/* Aliens */}
          {aliens.filter(alien => alien.active).map((alien, index) => (
            <div
              key={`alien-${index}`}
              className={`absolute rounded ${
                alien.abducting ? 'bg-red-500' : 'bg-purple-500'
              }`}
              style={{
                left: alien.x,
                top: alien.y,
                width: ALIEN_SIZE,
                height: ALIEN_SIZE
              }}
            />
          ))}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Arrow Keys - Move • Space - Shoot • Protect the humans from abduction!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">MISSION FAILED!</div>
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

export default Defender;