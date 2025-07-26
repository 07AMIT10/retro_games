import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface MissileDefenseProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CITY_WIDTH = 80;
const CITY_HEIGHT = 40;
const MISSILE_SPEED = 2;
const DEFENSE_MISSILE_SPEED = 8;

interface Position {
  x: number;
  y: number;
}

interface Missile extends Position {
  targetX: number;
  targetY: number;
  speed: number;
  active: boolean;
  type: 'enemy' | 'defense';
}

interface Explosion extends Position {
  radius: number;
  maxRadius: number;
  growing: boolean;
  type: 'defense' | 'enemy';
}

interface City extends Position {
  active: boolean;
  health: number;
}

interface DefenseBase extends Position {
  missiles: number;
  active: boolean;
}

const MissileDefense: React.FC<MissileDefenseProps> = ({ onScoreUpdate }) => {
  const [missiles, setMissiles] = useState<Missile[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [defenseBases, setDefenseBases] = useState<DefenseBase[]>([]);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  const [selectedBase, setSelectedBase] = useState<number>(0);

  const createCities = useCallback(() => {
    const newCities: City[] = [];
    for (let i = 0; i < 6; i++) {
      newCities.push({
        x: 100 + i * 120,
        y: CANVAS_HEIGHT - CITY_HEIGHT - 10,
        active: true,
        health: 3
      });
    }
    return newCities;
  }, []);

  const createDefenseBases = useCallback(() => {
    return [
      { x: 50, y: CANVAS_HEIGHT - 60, missiles: 10, active: true },
      { x: CANVAS_WIDTH / 2 - 25, y: CANVAS_HEIGHT - 60, missiles: 10, active: true },
      { x: CANVAS_WIDTH - 100, y: CANVAS_HEIGHT - 60, missiles: 10, active: true }
    ];
  }, []);

  const spawnEnemyMissile = useCallback(() => {
    if (Math.random() < 0.01 + level * 0.005) {
      const startX = Math.random() * CANVAS_WIDTH;
      const targetX = Math.random() * CANVAS_WIDTH;
      const targetY = CANVAS_HEIGHT - 20;

      setMissiles(prev => [...prev, {
        x: startX,
        y: 0,
        targetX,
        targetY,
        speed: MISSILE_SPEED + level * 0.3,
        active: true,
        type: 'enemy'
      }]);
    }
  }, [level]);

  const fireDefenseMissile = useCallback((targetX: number, targetY: number) => {
    if (gameOver || paused) return;

    const activeBase = defenseBases[selectedBase];
    if (!activeBase.active || activeBase.missiles <= 0) return;

    setMissiles(prev => [...prev, {
      x: activeBase.x + 25,
      y: activeBase.y,
      targetX,
      targetY,
      speed: DEFENSE_MISSILE_SPEED,
      active: true,
      type: 'defense'
    }]);

    setDefenseBases(prev => prev.map((base, index) => 
      index === selectedBase ? { ...base, missiles: base.missiles - 1 } : base
    ));
  }, [defenseBases, selectedBase, gameOver, paused]);

  const updateMissiles = useCallback(() => {
    if (gameOver || paused) return;

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
            maxRadius: missile.type === 'defense' ? 80 : 40,
            growing: true,
            type: missile.type
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

    spawnEnemyMissile();
  }, [gameOver, paused, spawnEnemyMissile]);

  const updateExplosions = useCallback(() => {
    if (gameOver || paused) return;

    setExplosions(prev => 
      prev.map(explosion => {
        if (explosion.growing) {
          const newRadius = explosion.radius + 4;
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
        if (explosion.type !== 'defense') return;

        newMissiles.forEach((missile, index) => {
          if (!missile.active || missile.type !== 'enemy') return;

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

    // Explosion vs city/base collisions
    setCities(prevCities => 
      prevCities.map(city => {
        if (!city.active) return city;

        const hit = explosions.some(explosion => {
          if (explosion.type !== 'enemy') return false;
          
          const distance = Math.sqrt(
            (city.x + CITY_WIDTH / 2 - explosion.x) ** 2 + 
            (city.y + CITY_HEIGHT / 2 - explosion.y) ** 2
          );
          return distance <= explosion.radius;
        });

        if (hit) {
          const newHealth = city.health - 1;
          return { 
            ...city, 
            health: newHealth, 
            active: newHealth > 0 
          };
        }

        return city;
      })
    );

    setDefenseBases(prevBases =>
      prevBases.map(base => {
        if (!base.active) return base;

        const hit = explosions.some(explosion => {
          if (explosion.type !== 'enemy') return false;
          
          const distance = Math.sqrt(
            (base.x + 25 - explosion.x) ** 2 + 
            (base.y + 25 - explosion.y) ** 2
          );
          return distance <= explosion.radius;
        });

        return hit ? { ...base, active: false } : base;
      })
    );

    // Check game over conditions
    const activeCities = cities.filter(city => city.active);
    const activeBases = defenseBases.filter(base => base.active);
    
    if (activeCities.length === 0 || activeBases.length === 0) {
      setGameOver(true);
      if (onScoreUpdate) onScoreUpdate(score);
    }

    // Check wave complete
    if (missiles.length === 0 && explosions.length === 0) {
      const bonusPoints = activeCities.length * 100 + 
                         activeBases.reduce((sum, base) => sum + base.missiles * 5, 0);
      setScore(prev => prev + bonusPoints);
      setLevel(prev => prev + 1);
      
      // Restore some missiles to bases
      setDefenseBases(prev => prev.map(base => ({
        ...base,
        missiles: base.active ? Math.min(10, base.missiles + 5) : base.missiles
      })));
    }
  }, [explosions, cities, defenseBases, missiles, gameOver, paused, score, onScoreUpdate]);

  const resetGame = () => {
    setMissiles([]);
    setExplosions([]);
    setCities(createCities());
    setDefenseBases(createDefenseBases());
    setScore(0);
    setLevel(1);
    setSelectedBase(0);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (cities.length === 0) {
      setCities(createCities());
    }
    if (defenseBases.length === 0) {
      setDefenseBases(createDefenseBases());
    }
  }, [cities.length, defenseBases.length, createCities, createDefenseBases]);

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
      fireDefenseMissile(e.clientX - rect.left, e.clientY - rect.top);
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'p':
          e.preventDefault();
          setPaused(prev => !prev);
          break;
        case '1':
          e.preventDefault();
          setSelectedBase(0);
          break;
        case '2':
          e.preventDefault();
          setSelectedBase(1);
          break;
        case '3':
          e.preventDefault();
          setSelectedBase(2);
          break;
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
  }, [fireDefenseMissile]);

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
            <div className="text-lg font-bold">MISSILE DEFENSE</div>
            <div className="text-sm">Score: {score} | Level: {level}</div>
            <div className="text-sm">Cities: {cities.filter(c => c.active).length}/6</div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-cyan-400 retro-font text-sm">
              Base {selectedBase + 1}: {defenseBases[selectedBase]?.missiles || 0} missiles
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

        <div
          className="relative bg-gradient-to-b from-blue-900 to-black border-2 border-gray-600 overflow-hidden cursor-crosshair"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Cities */}
          {cities.map((city, index) => (
            <div
              key={index}
              className={`absolute ${
                city.active ? 
                  city.health === 3 ? 'bg-green-400' :
                  city.health === 2 ? 'bg-yellow-400' : 'bg-red-400'
                : 'bg-gray-600'
              }`}
              style={{
                left: city.x,
                top: city.y,
                width: CITY_WIDTH,
                height: CITY_HEIGHT
              }}
            />
          ))}

          {/* Defense bases */}
          {defenseBases.map((base, index) => (
            <div
              key={index}
              className={`absolute border-2 ${
                base.active ? 
                  selectedBase === index ? 'bg-cyan-400 border-cyan-300' : 'bg-blue-400 border-blue-300'
                : 'bg-gray-600 border-gray-500'
              }`}
              style={{
                left: base.x,
                top: base.y,
                width: 50,
                height: 30
              }}
            >
              <div className="text-xs text-center text-black font-bold mt-1">
                {base.missiles}
              </div>
            </div>
          ))}

          {/* Missiles */}
          {missiles.map((missile, index) => (
            <div key={index}>
              <div
                className={`absolute rounded-full ${
                  missile.type === 'enemy' ? 'bg-red-400' : 'bg-cyan-400'
                }`}
                style={{
                  left: missile.x - 3,
                  top: missile.y - 3,
                  width: 6,
                  height: 6
                }}
              />
              {/* Missile trail */}
              <svg className="absolute inset-0 pointer-events-none">
                <line
                  x1={missile.x}
                  y1={missile.y}
                  x2={missile.targetX}
                  y2={missile.targetY}
                  stroke={missile.type === 'enemy' ? '#ff6b6b' : '#22d3ee'}
                  strokeWidth="1"
                  strokeDasharray="2,2"
                  opacity="0.5"
                />
              </svg>
            </div>
          ))}

          {/* Explosions */}
          {explosions.map((explosion, index) => (
            <div
              key={index}
              className={`absolute rounded-full ${
                explosion.type === 'defense' ? 'bg-cyan-400' : 'bg-red-400'
              } opacity-80`}
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
          <p>Click to fire defensive missiles • 1/2/3 - Select base • Protect your cities!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">DEFENSE FAILED!</div>
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

export default MissileDefense;