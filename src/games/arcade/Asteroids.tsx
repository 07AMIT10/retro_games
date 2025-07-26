import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const SHIP_SIZE = 20;
const BULLET_SIZE = 3;
const ASTEROID_SIZES = [60, 40, 20];

interface Position {
  x: number;
  y: number;
}

interface Velocity {
  dx: number;
  dy: number;
}

interface Ship extends Position {
  angle: number;
  velocity: Velocity;
  thrust: boolean;
}

interface Bullet extends Position, Velocity {
  active: boolean;
  life: number;
}

interface Asteroid extends Position, Velocity {
  size: number;
  angle: number;
  rotationSpeed: number;
}

interface AsteroidsProps {
  onScoreUpdate?: (score: number) => void;
}

const Asteroids: React.FC<AsteroidsProps> = ({ onScoreUpdate }) => {
  const [ship, setShip] = useState<Ship>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    angle: 0,
    velocity: { dx: 0, dy: 0 },
    thrust: false
  });
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [asteroids, setAsteroids] = useState<Asteroid[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());

  const createAsteroids = useCallback((count: number) => {
    const newAsteroids: Asteroid[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      
      newAsteroids.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        size: ASTEROID_SIZES[0],
        angle: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.1
      });
    }
    return newAsteroids;
  }, []);

  const wrapPosition = (pos: Position): Position => ({
    x: ((pos.x % CANVAS_WIDTH) + CANVAS_WIDTH) % CANVAS_WIDTH,
    y: ((pos.y % CANVAS_HEIGHT) + CANVAS_HEIGHT) % CANVAS_HEIGHT
  });

  const shoot = useCallback(() => {
    if (gameOver || paused || bullets.length >= 10) return;
    
    setBullets(prev => [
      ...prev,
      {
        x: ship.x,
        y: ship.y,
        dx: Math.cos(ship.angle) * 10,
        dy: Math.sin(ship.angle) * 10,
        active: true,
        life: 60
      }
    ]);
  }, [ship, bullets.length, gameOver, paused]);

  const updateShip = useCallback(() => {
    if (gameOver || paused) return;

    setShip(prev => {
      let newAngle = prev.angle;
      let newVelocity = { ...prev.velocity };
      let thrust = false;

      if (keys.has('ArrowLeft')) {
        newAngle -= 0.15;
      }
      if (keys.has('ArrowRight')) {
        newAngle += 0.15;
      }
      if (keys.has('ArrowUp')) {
        thrust = true;
        newVelocity.dx += Math.cos(newAngle) * 0.3;
        newVelocity.dy += Math.sin(newAngle) * 0.3;
      }

      // Apply friction
      newVelocity.dx *= 0.99;
      newVelocity.dy *= 0.99;

      // Limit max speed
      const maxSpeed = 8;
      const speed = Math.sqrt(newVelocity.dx ** 2 + newVelocity.dy ** 2);
      if (speed > maxSpeed) {
        newVelocity.dx = (newVelocity.dx / speed) * maxSpeed;
        newVelocity.dy = (newVelocity.dy / speed) * maxSpeed;
      }

      const newPos = wrapPosition({
        x: prev.x + newVelocity.dx,
        y: prev.y + newVelocity.dy
      });

      return {
        ...prev,
        x: newPos.x,
        y: newPos.y,
        angle: newAngle,
        velocity: newVelocity,
        thrust
      };
    });
  }, [keys, gameOver, paused]);

  const updateBullets = useCallback(() => {
    if (gameOver || paused) return;

    setBullets(prev => 
      prev
        .map(bullet => {
          const newPos = wrapPosition({
            x: bullet.x + bullet.dx,
            y: bullet.y + bullet.dy
          });
          return {
            ...bullet,
            x: newPos.x,
            y: newPos.y,
            life: bullet.life - 1
          };
        })
        .filter(bullet => bullet.life > 0)
    );
  }, [gameOver, paused]);

  const updateAsteroids = useCallback(() => {
    if (gameOver || paused) return;

    setAsteroids(prev => 
      prev.map(asteroid => {
        const newPos = wrapPosition({
          x: asteroid.x + asteroid.dx,
          y: asteroid.y + asteroid.dy
        });
        return {
          ...asteroid,
          x: newPos.x,
          y: newPos.y,
          angle: asteroid.angle + asteroid.rotationSpeed
        };
      })
    );
  }, [gameOver, paused]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Bullet vs Asteroid
    setBullets(prevBullets => {
      let newBullets = [...prevBullets];
      
      setAsteroids(prevAsteroids => {
        let newAsteroids = [...prevAsteroids];
        let pointsEarned = 0;

        newBullets.forEach((bullet, bulletIndex) => {
          if (!bullet.active) return;

          newAsteroids.forEach((asteroid, asteroidIndex) => {
            const distance = Math.sqrt(
              (bullet.x - asteroid.x) ** 2 + (bullet.y - asteroid.y) ** 2
            );

            if (distance < asteroid.size / 2) {
              newBullets[bulletIndex] = { ...bullet, active: false };
              
              const points = asteroid.size === ASTEROID_SIZES[0] ? 20 :
                            asteroid.size === ASTEROID_SIZES[1] ? 50 : 100;
              pointsEarned += points;

              // Split asteroid if not smallest
              if (asteroid.size > ASTEROID_SIZES[2]) {
                const newSize = asteroid.size === ASTEROID_SIZES[0] ? 
                                ASTEROID_SIZES[1] : ASTEROID_SIZES[2];
                
                for (let i = 0; i < 2; i++) {
                  const angle = Math.random() * Math.PI * 2;
                  const speed = 2 + Math.random();
                  
                  newAsteroids.push({
                    x: asteroid.x,
                    y: asteroid.y,
                    dx: Math.cos(angle) * speed,
                    dy: Math.sin(angle) * speed,
                    size: newSize,
                    angle: 0,
                    rotationSpeed: (Math.random() - 0.5) * 0.2
                  });
                }
              }

              newAsteroids.splice(asteroidIndex, 1);
            }
          });
        });

        if (pointsEarned > 0) {
          setScore(prev => prev + pointsEarned);
        }

        // Check if all asteroids destroyed
        if (newAsteroids.length === 0) {
          setLevel(prev => prev + 1);
          return createAsteroids(4 + level);
        }

        return newAsteroids;
      });

      return newBullets.filter(bullet => bullet.active);
    });

    // Ship vs Asteroid
    const shipHit = asteroids.some(asteroid => {
      const distance = Math.sqrt(
        (ship.x - asteroid.x) ** 2 + (ship.y - asteroid.y) ** 2
      );
      return distance < asteroid.size / 2 + SHIP_SIZE / 2;
    });

    if (shipHit) {
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setGameOver(true);
          if (onScoreUpdate) onScoreUpdate(score);
        }
        return newLives;
      });
      setShip(prev => ({
        ...prev,
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        velocity: { dx: 0, dy: 0 }
      }));
    }
  }, [asteroids, ship, gameOver, paused, level, createAsteroids, score, onScoreUpdate]);

  const resetGame = () => {
    setShip({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      angle: 0,
      velocity: { dx: 0, dy: 0 },
      thrust: false
    });
    setBullets([]);
    setAsteroids(createAsteroids(4));
    setScore(0);
    setLives(3);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (asteroids.length === 0) {
      setAsteroids(createAsteroids(4));
    }
  }, [asteroids.length, createAsteroids]);

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
      updateShip();
      updateBullets();
      updateAsteroids();
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updateShip, updateBullets, updateAsteroids, checkCollisions]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">SCORE: {score}</div>
            <div className="text-sm">LIVES: {lives} | LEVEL: {level}</div>
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
          {/* Ship */}
          <div
            className="absolute bg-cyan-400"
            style={{
              left: ship.x - SHIP_SIZE / 2,
              top: ship.y - SHIP_SIZE / 2,
              width: SHIP_SIZE,
              height: SHIP_SIZE,
              transform: `rotate(${ship.angle}rad)`,
              clipPath: 'polygon(100% 50%, 0% 0%, 30% 50%, 0% 100%)'
            }}
          />

          {/* Thrust effect */}
          {ship.thrust && (
            <div
              className="absolute bg-orange-400 opacity-80"
              style={{
                left: ship.x - SHIP_SIZE / 2 - Math.cos(ship.angle) * 15,
                top: ship.y - SHIP_SIZE / 2 - Math.sin(ship.angle) * 15,
                width: 10,
                height: 5,
                transform: `rotate(${ship.angle}rad)`
              }}
            />
          )}

          {/* Bullets */}
          {bullets.map((bullet, index) => (
            <div
              key={index}
              className="absolute bg-white rounded-full"
              style={{
                left: bullet.x - BULLET_SIZE / 2,
                top: bullet.y - BULLET_SIZE / 2,
                width: BULLET_SIZE,
                height: BULLET_SIZE
              }}
            />
          ))}

          {/* Asteroids */}
          {asteroids.map((asteroid, index) => (
            <div
              key={index}
              className="absolute bg-gray-400 rounded-full border-2 border-gray-300"
              style={{
                left: asteroid.x - asteroid.size / 2,
                top: asteroid.y - asteroid.size / 2,
                width: asteroid.size,
                height: asteroid.size,
                transform: `rotate(${asteroid.angle}rad)`
              }}
            />
          ))}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Destroy all asteroids! Use thrust to navigate space.</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">GAME OVER!</div>
            <p className="text-cyan-400 mb-4 retro-font">Score: {score}</p>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-bold border-2 border-cyan-400"
            >
              PLAY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Asteroids;