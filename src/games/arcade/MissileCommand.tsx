import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CITY_WIDTH = 80;
const CITY_HEIGHT = 40;
const MISSILE_SPEED = 2;

interface Position {
  x: number;
  y: number;
}

interface Missile extends Position {
  targetX: number;
  targetY: number;
  speed: number;
  active: boolean;
}

interface Explosion extends Position {
  radius: number;
  maxRadius: number;
  growing: boolean;
}

interface City extends Position {
  active: boolean;
}

interface MissileCommandProps {
  onScoreUpdate?: (score: number) => void;
}

const MissileCommand: React.FC<MissileCommandProps> = ({ onScoreUpdate }) => {
  const [missiles, setMissiles] = useState<Missile[]>([]);
  const [playerMissiles, setPlayerMissiles] = useState<Missile[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });

  const createCities = useCallback(() => {
    const newCities: City[] = [];
    for (let i = 0; i < 6; i++) {
      newCities.push({
        x: 50 + i * 120,
        y: CANVAS_HEIGHT - CITY_HEIGHT - 10,
        active: true
      });
    }
    return newCities;
  }, []);

  const spawnMissile = useCallback(() => {
    if (Math.random() < 0.01 + level * 0.005) {
      const startX = Math.random() * CANVAS_WIDTH;
      const targetX = Math.random() * CANVAS_WIDTH;
      const targetY = CANVAS_HEIGHT - 10;

      setMissiles(prev => [...prev, {
        x: startX,
        y: 0,
        targetX,
        targetY,
        speed: MISSILE_SPEED + level * 0.5,
        active: true
      }]);
    }
  }, [level]);

  const fireMissile = useCallback((targetX: number, targetY: number) => {
    if (gameOver || paused) return;

    setPlayerMissiles(prev => [...prev, {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 50,
      targetX,
      targetY,
      speed: 8,
      active: true
    }]);
  }, [gameOver, paused]);

  const updateMissiles = useCallback(() => {
    if (gameOver || paused) return;

    // Update enemy missiles
    setMissiles(prev => 
      prev.map(missile => {
        if (!missile.active) return missile;

        const dx = missile.targetX - missile.x;
        const dy = missile.targetY - missile.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);

        if (distance < missile.speed) {
          // Missile reached target
          setExplosions(prevExp => [...prevExp, {
            x: missile.targetX,
            y: missile.targetY,
            radius: 0,
            maxRadius: 50,
            growing: true
          }]);

          return { ...missile, active: false };
        }

        const moveX = (dx / distance) * missile.speed;
        const moveY = (dy / distance) * missile.speed;

        return {
          ...missile,
          x: missile.x + moveX,
          y: missile.y + moveY
        };
      }).filter(missile => missile.active)
    );

    // Update player missiles
    setPlayerMissiles(prev => 
      prev.map(missile => {
        if (!missile.active) return missile;

        const dx = missile.targetX - missile.x;
        const dy = missile.targetY - missile.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);

        if (distance < missile.speed) {
          // Missile reached target
          setExplosions(prevExp => [...prevExp, {
            x: missile.targetX,
            y: missile.targetY,
            radius: 0,
            maxRadius: 80,
            growing: true
          }]);

          return { ...missile, active: false };
        }

        const moveX = (dx / distance) * missile.speed;
        const moveY = (dy / distance) * missile.speed;

        return {
          ...missile,
          x: missile.x + moveX,
          y: missile.y + moveY
        };
      }).filter(missile => missile.active)
    );

    spawnMissile();
  }, [gameOver, paused, spawnMissile]);

  const updateExplosions = useCallback(() => {
    if (gameOver || paused) return;

    setExplosions(prev => 
      prev.map(explosion => {
        if (explosion.growing) {
          const newRadius = explosion.radius + 3;
          if (newRadius >= explosion.maxRadius) {
            return { ...explosion, radius: explosion.maxRadius, growing: false };
          }
          return { ...explosion, radius: newRadius };
        } else {
          const newRadius = explosion.radius - 2;
          return { ...explosion, radius: Math.max(0, newRadius) };
        }
      }).filter(explosion => explosion.radius > 0)
    );
  }, [gameOver, paused]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Missile vs explosion collisions
    setMissiles(prevMissiles => {
      let newMissiles = [...prevMissiles];
      let pointsEarned = 0;

      explosions.forEach(explosion => {
        newMissiles.forEach((missile, index) => {
          if (!missile.active) return;

          const distance = Math.sqrt(
            (missile.x - explosion.x) ** 2 + (missile.y - explosion.y) ** 2
          );

          if (distance <= explosion.radius) {
            newMissiles[index] = { ...missile, active: false };
            pointsEarned += 25;
          }
        });
      });

      if (pointsEarned > 0) {
        setScore(prev => prev + pointsEarned);
      }

      return newMissiles.filter(missile => missile.active);
    });

    // Explosion vs city collisions
    setCities(prevCities => 
      prevCities.map(city => {
        if (!city.active) return city;

        const hit = explosions.some(explosion => {
          const distance = Math.sqrt(
            (city.x + CITY_WIDTH / 2 - explosion.x) ** 2 + 
            (city.y + CITY_HEIGHT / 2 - explosion.y) ** 2
          );
          return distance <= explosion.radius;
        });

        return hit ? { ...city, active: false } : city;
      })
    );

    // Check if all cities destroyed
    const activeCities = cities.filter(city => city.active);
    if (activeCities.length === 0) {
      setGameOver(true);
      if (onScoreUpdate) onScoreUpdate(score);
    }

    // Check if wave complete
    if (missiles.length === 0 && explosions.length === 0) {
      setLevel(prev => prev + 1);
    }
  }, [explosions, cities, missiles, gameOver, paused, score, onScoreUpdate]);

  const resetGame = () => {
    setMissiles([]);
    setPlayerMissiles([]);
    setExplosions([]);
    setCities(createCities());
    setScore(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (cities.length === 0) {
      setCities(createCities());
    }
  }, [cities.length, createCities]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      fireMissile(e.clientX - rect.left, e.clientY - rect.top);
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'p') {
        e.preventDefault();
        setPaused(prev => !prev);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [fireMissile]);

  useEffect(() => {
    const gameInterval = setInterval(() => {
      updateMissiles();
      updateExplosions();
      checkCollisions();
    }, 50);

    return () => clearInterval(gameInterval);
  }, [updateMissiles, updateExplosions, checkCollisions]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">SCORE: {score}</div>
            <div className="text-sm">LEVEL: {level} | CITIES: {cities.filter(c => c.active).length}</div>
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
          className="relative bg-black border-2 border-gray-600 overflow-hidden cursor-crosshair"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Cities */}
          {cities.map((city, index) => (
            <div
              key={index}
              className={`absolute ${city.active ? 'bg-green-400' : 'bg-red-800'}`}
              style={{
                left: city.x,
                top: city.y,
                width: CITY_WIDTH,
                height: CITY_HEIGHT
              }}
            />
          ))}

          {/* Enemy missiles */}
          {missiles.map((missile, index) => (
            <div key={index}>
              <div
                className="absolute bg-red-400 rounded-full"
                style={{
                  left: missile.x - 3,
                  top: missile.y - 3,
                  width: 6,
                  height: 6
                }}
              />
              {/* Missile trail */}
              <div
                className="absolute bg-red-600 opacity-50"
                style={{
                  left: missile.x - 1,
                  top: missile.y - 20,
                  width: 2,
                  height: 20
                }}
              />
            </div>
          ))}

          {/* Player missiles */}
          {playerMissiles.map((missile, index) => (
            <div key={index}>
              <div
                className="absolute bg-cyan-400 rounded-full"
                style={{
                  left: missile.x - 3,
                  top: missile.y - 3,
                  width: 6,
                  height: 6
                }}
              />
              {/* Missile trail */}
              <div
                className="absolute bg-cyan-600 opacity-50"
                style={{
                  left: missile.x - 1,
                  top: missile.y,
                  width: 2,
                  height: 20
                }}
              />
            </div>
          ))}

          {/* Explosions */}
          {explosions.map((explosion, index) => (
            <div
              key={index}
              className="absolute bg-yellow-400 rounded-full opacity-80"
              style={{
                left: explosion.x - explosion.radius,
                top: explosion.y - explosion.radius,
                width: explosion.radius * 2,
                height: explosion.radius * 2
              }}
            />
          ))}

          {/* Crosshair */}
          <div
            className="absolute pointer-events-none"
            style={{ left: mousePos.x - 10, top: mousePos.y - 10 }}
          >
            <div className="w-5 h-1 bg-cyan-400" />
            <div className="w-1 h-5 bg-cyan-400 absolute top-0 left-2" />
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Defend your cities! Click to fire defensive missiles.</p>
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

export default MissileCommand;