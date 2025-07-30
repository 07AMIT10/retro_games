import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface MissileDefenseProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CITY_WIDTH = 40;
const CITY_HEIGHT = 30;
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
  type: 'enemy' | 'defense';
  trail: Position[];
}

interface City extends Position {
  active: boolean;
  health: number;
  population: number;
}

interface DefenseBase extends Position {
  missiles: number;
  active: boolean;
  reloadTimer: number;
  range: number;
}

interface Explosion extends Position {
  radius: number;
  maxRadius: number;
  growing: boolean;
  type: 'defense' | 'enemy';
  timer: number;
}

const MissileDefense: React.FC<MissileDefenseProps> = ({ onScoreUpdate }) => {
  const [missiles, setMissiles] = useState<Missile[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [defenseBases, setDefenseBases] = useState<DefenseBase[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  const [selectedBase, setSelectedBase] = useState<number>(0);
  const [waveProgress, setWaveProgress] = useState(0);
  const [maxWaveMissiles] = useState(10);

  const createCities = useCallback(() => {
    const newCities: City[] = [];
    for (let i = 0; i < 6; i++) {
      newCities.push({
        x: 100 + i * 120,
        y: CANVAS_HEIGHT - CITY_HEIGHT - 10,
        active: true,
        health: 3,
        population: 10000 + Math.random() * 40000
      });
    }
    return newCities;
  }, []);

  const createDefenseBases = useCallback(() => {
    return [
      { x: 50, y: CANVAS_HEIGHT - 60, missiles: 10, active: true, reloadTimer: 0, range: 200 },
      { x: CANVAS_WIDTH / 2 - 25, y: CANVAS_HEIGHT - 60, missiles: 10, active: true, reloadTimer: 0, range: 250 },
      { x: CANVAS_WIDTH - 100, y: CANVAS_HEIGHT - 60, missiles: 10, active: true, reloadTimer: 0, range: 200 }
    ];
  }, []);

  const spawnEnemyMissile = useCallback(() => {
    if (waveProgress >= maxWaveMissiles + level * 5) return;

    const spawnChance = 0.008 + level * 0.002;
    if (Math.random() < spawnChance) {
      const startX = Math.random() * CANVAS_WIDTH;
      const targets = [
        ...cities.filter(c => c.active).map(c => ({ x: c.x + CITY_WIDTH/2, y: c.y + CITY_HEIGHT/2, priority: 2 })),
        ...defenseBases.filter(b => b.active).map(b => ({ x: b.x + 25, y: b.y + 25, priority: 1 }))
      ];
      
      if (targets.length === 0) return;
      
      // Weighted target selection
      const weightedTargets = targets.flatMap(target => 
        Array(target.priority).fill(target)
      );
      const target = weightedTargets[Math.floor(Math.random() * weightedTargets.length)];

      setMissiles(prev => [...prev, {
        x: startX,
        y: 0,
        targetX: target.x + (Math.random() - 0.5) * 40,
        targetY: target.y,
        speed: MISSILE_SPEED + level * 0.3,
        active: true,
        type: 'enemy',
        trail: []
      }]);
      
      setWaveProgress(prev => prev + 1);
    }
  }, [level, cities, defenseBases, waveProgress, maxWaveMissiles]);

  const fireDefenseMissile = useCallback((targetX: number, targetY: number) => {
    const base = defenseBases[selectedBase];
    if (!base || !base.active || base.missiles <= 0 || base.reloadTimer > 0) return;

    // Check if target is in range
    const distance = Math.sqrt((targetX - base.x) ** 2 + (targetY - base.y) ** 2);
    if (distance > base.range) return;

    setMissiles(prev => [...prev, {
      x: base.x + 25,
      y: base.y,
      targetX,
      targetY,
      speed: 6,
      active: true,
      type: 'defense',
      trail: []
    }]);

    setDefenseBases(prev => prev.map((b, idx) => 
      idx === selectedBase 
        ? { ...b, missiles: b.missiles - 1, reloadTimer: 30 }
        : b
    ));
  }, [selectedBase, defenseBases]);

  const updateMissiles = useCallback(() => {
    if (gameOver || paused) return;

    setMissiles(prev => 
      prev.map(missile => {
        if (!missile.active) return missile;

        const dx = missile.targetX - missile.x;
        const dy = missile.targetY - missile.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);

        // Add to trail
        const newTrail = [...missile.trail, { x: missile.x, y: missile.y }];
        if (newTrail.length > 8) newTrail.shift();

        if (distance < missile.speed) {
          // Missile reached target
          setExplosions(prevExp => [...prevExp, {
            x: missile.targetX,
            y: missile.targetY,
            radius: 0,
            maxRadius: missile.type === 'defense' ? 100 : 50,
            growing: true,
            type: missile.type,
            timer: 0
          }]);

          return { ...missile, active: false };
        }

        const moveX = (dx / distance) * missile.speed;
        const moveY = (dy / distance) * missile.speed;

        return {
          ...missile,
          x: missile.x + moveX,
          y: missile.y + moveY,
          trail: newTrail
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
          const newRadius = explosion.radius + 3;
          if (newRadius >= explosion.maxRadius) {
            return { ...explosion, radius: explosion.maxRadius, growing: false, timer: 60 };
          }
          return { ...explosion, radius: newRadius };
        } else {
          const newTimer = explosion.timer - 1;
          if (newTimer <= 0) {
            return { ...explosion, radius: 0 };
          }
          return { ...explosion, timer: newTimer };
        }
      }).filter(explosion => explosion.radius > 0)
    );
  }, [gameOver, paused]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Explosion vs missiles
    setMissiles(prevMissiles => {
      let newMissiles = [...prevMissiles];
      let pointsEarned = 0;

      explosions.forEach(explosion => {
        newMissiles.forEach((missile, index) => {
          if (!missile.active || missile.type !== 'enemy') return;

          const distance = Math.sqrt(
            (missile.x - explosion.x) ** 2 + (missile.y - explosion.y) ** 2
          );

          if (distance <= explosion.radius) {
            newMissiles[index] = { ...missile, active: false };
            pointsEarned += 25 * level;
          }
        });
      });

      if (pointsEarned > 0) {
        setScore(prev => prev + pointsEarned);
      }

      return newMissiles.filter(missile => missile.active);
    });

    // Explosion vs cities and bases
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
            active: newHealth > 0,
            population: newHealth > 0 ? city.population * 0.7 : 0
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

    // Update base reload timers
    setDefenseBases(prev => prev.map(base => ({
      ...base,
      reloadTimer: Math.max(0, base.reloadTimer - 1)
    })));

    // Check game over conditions
    const activeCities = cities.filter(city => city.active);
    const activeBases = defenseBases.filter(base => base.active);
    
    if (activeCities.length === 0 || activeBases.length === 0) {
      setGameOver(true);
      if (onScoreUpdate) onScoreUpdate(score);
    }

    // Check wave complete
    if (missiles.length === 0 && explosions.length === 0 && waveProgress >= maxWaveMissiles + level * 5) {
      const bonusPoints = activeCities.reduce((sum, city) => sum + city.population / 100, 0) + 
                         activeBases.reduce((sum, base) => sum + base.missiles * 5, 0);
      setScore(prev => prev + Math.floor(bonusPoints));
      setLevel(prev => prev + 1);
      setWaveProgress(0);
      
      // Restore some missiles to bases
      setDefenseBases(prev => prev.map(base => ({
        ...base,
        missiles: base.active ? Math.min(10, base.missiles + 3) : base.missiles
      })));
    }
  }, [explosions, cities, defenseBases, missiles, gameOver, paused, score, onScoreUpdate, waveProgress, maxWaveMissiles, level]);

  const resetGame = () => {
    setMissiles([]);
    setExplosions([]);
    setCities(createCities());
    setDefenseBases(createDefenseBases());
    setScore(0);
    setLevel(1);
    setWaveProgress(0);
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

    const gameArea = document.querySelector('[data-game="missile-defense"]');
    if (gameArea) {
      gameArea.addEventListener('mousemove', handleMouseMove);
      gameArea.addEventListener('click', handleClick);
    }
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      if (gameArea) {
        gameArea.removeEventListener('mousemove', handleMouseMove);
        gameArea.removeEventListener('click', handleClick);
      }
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [fireDefenseMissile]);

  useEffect(() => {
    const gameInterval = setInterval(() => {
      updateMissiles();
      updateExplosions();
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updateMissiles, updateExplosions, checkCollisions]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">MISSILE DEFENSE</div>
            <div className="text-sm">Score: {score} | Level: {level}</div>
            <div className="text-sm">Cities: {cities.filter(c => c.active).length}/6 | Wave: {waveProgress}/{maxWaveMissiles + level * 5}</div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-cyan-400 retro-font text-sm">
              <div>Base {selectedBase + 1}: {defenseBases[selectedBase]?.missiles || 0} missiles</div>
              <div className={defenseBases[selectedBase]?.reloadTimer > 0 ? 'text-red-400' : ''}>
                {defenseBases[selectedBase]?.reloadTimer > 0 ? 'RELOADING...' : 'READY'}
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
        </div>

        <div
          data-game="missile-defense"
          className="relative bg-gradient-to-b from-blue-900 to-black border-2 border-gray-600 overflow-hidden cursor-crosshair"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Cities */}
          {cities.map((city, index) => (
            <div key={index}>
              {city.active && (
                <div
                  className={`absolute border-2 ${
                    city.health === 3 ? 'bg-blue-400 border-blue-300' :
                    city.health === 2 ? 'bg-yellow-400 border-yellow-300' :
                    'bg-red-400 border-red-300'
                  }`}
                  style={{
                    left: city.x,
                    top: city.y,
                    width: CITY_WIDTH,
                    height: CITY_HEIGHT,
                    boxShadow: '0 0 8px rgba(0,255,255,0.5)'
                  }}
                >
                  <div className="text-white text-xs text-center leading-3 pt-1">
                    🏙️
                  </div>
                  <div className="text-white text-xs text-center">
                    {Math.floor(city.population / 1000)}K
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Defense Bases */}
          {defenseBases.map((base, index) => (
            <div key={index}>
              {base.active && (
                <div
                  className={`absolute border-2 ${
                    index === selectedBase ? 'bg-green-400 border-green-300 shadow-lg' : 'bg-gray-400 border-gray-300'
                  }`}
                  style={{
                    left: base.x,
                    top: base.y,
                    width: 50,
                    height: 50,
                    borderRadius: '50%',
                    boxShadow: index === selectedBase ? '0 0 15px lime' : '0 0 5px gray'
                  }}
                >
                  <div className="w-full h-full flex flex-col items-center justify-center text-white text-xs font-bold">
                    <div>🚀</div>
                    <div>{base.missiles}</div>
                  </div>
                  {/* Range indicator for selected base */}
                  {index === selectedBase && (
                    <div
                      className="absolute border border-green-400 rounded-full pointer-events-none"
                      style={{
                        left: -base.range + 25,
                        top: -base.range + 25,
                        width: base.range * 2,
                        height: base.range * 2,
                        opacity: 0.3
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Missiles */}
          {missiles.map((missile, index) => (
            <div key={index}>
              {/* Missile trail */}
              {missile.trail.map((pos, trailIndex) => (
                <div
                  key={`trail-${index}-${trailIndex}`}
                  className={`absolute rounded-full ${
                    missile.type === 'defense' ? 'bg-cyan-400' : 'bg-red-400'
                  }`}
                  style={{
                    left: pos.x - 1,
                    top: pos.y - 1,
                    width: 2,
                    height: 2,
                    opacity: (trailIndex + 1) / missile.trail.length * 0.7
                  }}
                />
              ))}
              {/* Missile */}
              <div
                className={`absolute ${
                  missile.type === 'defense' ? 'bg-cyan-400' : 'bg-red-400'
                } rounded-full shadow-lg`}
                style={{
                  left: missile.x - 3,
                  top: missile.y - 3,
                  width: 6,
                  height: 6,
                  boxShadow: `0 0 8px ${missile.type === 'defense' ? 'cyan' : 'red'}`
                }}
              />
            </div>
          ))}

          {/* Explosions */}
          {explosions.map((explosion, index) => (
            <div
              key={`explosion-${index}`}
              className={`absolute rounded-full border-2 ${
                explosion.type === 'defense' ? 'bg-cyan-400 border-cyan-300' : 'bg-red-400 border-red-300'
              }`}
              style={{
                left: explosion.x - explosion.radius,
                top: explosion.y - explosion.radius,
                width: explosion.radius * 2,
                height: explosion.radius * 2,
                opacity: explosion.growing ? 0.8 : 0.6,
                boxShadow: `0 0 ${explosion.radius}px ${explosion.type === 'defense' ? 'cyan' : 'red'}`
              }}
            />
          ))}

          {/* Crosshair */}
          <div
            className="absolute pointer-events-none"
            style={{ left: mousePos.x - 15, top: mousePos.y - 15 }}
          >
            <div className="w-8 h-1 bg-cyan-400" />
            <div className="w-1 h-8 bg-cyan-400 absolute top-0 left-3.5" />
            <div className="absolute top-3.5 left-8 text-cyan-400 text-xs">
              {Math.round(mousePos.x)},{Math.round(mousePos.y)}
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font space-y-1">
          <p><strong>Click</strong> to fire defensive missiles • <strong>1/2/3</strong> Select base • <strong>P</strong> Pause</p>
          <p>Protect your cities! Intercept incoming missiles with defensive explosions!</p>
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

export default MissileDefense;