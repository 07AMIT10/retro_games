import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface DesertRallyProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 500;
const CAR_WIDTH = 30;
const CAR_HEIGHT = 40;

interface Position {
  x: number;
  y: number;
}

interface Car extends Position {
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  drift: number;
}

interface Obstacle extends Position {
  width: number;
  height: number;
  type: 'cactus' | 'rock' | 'dune';
}

interface Dust extends Position {
  life: number;
  size: number;
}

const DesertRally: React.FC<DesertRallyProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Car>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 80,
    vx: 0,
    vy: 0,
    angle: 0,
    speed: 0,
    drift: 0
  });
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [dustClouds, setDustClouds] = useState<Dust[]>([]);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [turbo, setTurbo] = useState(100);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [speed, setSpeed] = useState(2);

  const createObstacles = useCallback(() => {
    const newObstacles: Obstacle[] = [];
    for (let i = 0; i < 10; i++) {
      const types: Obstacle['type'][] = ['cactus', 'rock', 'dune'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      newObstacles.push({
        x: Math.random() * (CANVAS_WIDTH - 50),
        y: -i * 80 - 100,
        width: type === 'dune' ? 80 : type === 'cactus' ? 25 : 40,
        height: type === 'dune' ? 40 : type === 'cactus' ? 60 : 30,
        type
      });
    }
    return newObstacles;
  }, []);

  const createDust = useCallback((x: number, y: number) => {
    if (player.speed > 2) {
      setDustClouds(prev => [...prev, {
        x: x + (Math.random() - 0.5) * CAR_WIDTH,
        y: y + CAR_HEIGHT,
        life: 30,
        size: 5 + Math.random() * 10
      }]);
    }
  }, [player.speed]);

  const updatePlayer = useCallback(() => {
    if (gameOver || paused) return;

    setPlayer(prev => {
      let newVx = prev.vx;
      let newVy = prev.vy;
      let newAngle = prev.angle;
      let newDrift = prev.drift;

      // Steering with drift mechanics
      if (keys.has('ArrowLeft')) {
        if (prev.speed > 4) {
          newDrift = Math.min(0.3, prev.drift + 0.05);
          newAngle -= 0.08 + newDrift;
        } else {
          newAngle -= 0.05;
        }
        newVx = Math.max(-6, prev.vx - 0.4);
      } else if (keys.has('ArrowRight')) {
        if (prev.speed > 4) {
          newDrift = Math.min(0.3, prev.drift + 0.05);
          newAngle += 0.08 + newDrift;
        } else {
          newAngle += 0.05;
        }
        newVx = Math.min(6, prev.vx + 0.4);
      } else {
        newDrift *= 0.9;
        newVx *= 0.85;
      }

      // Acceleration/Braking
      if (keys.has('ArrowUp')) {
        newVy = Math.max(-8, prev.vy - 0.5);
      } else if (keys.has('ArrowDown')) {
        newVy = Math.min(3, prev.vy + 0.8); // Brake/reverse
      } else {
        newVy = prev.vy * 0.9;
      }

      // Turbo boost
      if (keys.has(' ') && turbo > 0) {
        newVy = Math.max(-12, newVy - 0.8);
        setTurbo(prev => Math.max(0, prev - 2));
        createDust(prev.x, prev.y);
      } else if (turbo < 100) {
        setTurbo(prev => Math.min(100, prev + 0.2));
      }

      let newX = prev.x + newVx;
      let newY = prev.y + newVy;

      // Keep on screen horizontally
      newX = Math.max(CAR_WIDTH / 2, Math.min(CANVAS_WIDTH - CAR_WIDTH / 2, newX));

      // Wrap vertically
      if (newY < -CAR_HEIGHT) {
        newY = CANVAS_HEIGHT;
      } else if (newY > CANVAS_HEIGHT) {
        newY = -CAR_HEIGHT;
      }

      const newSpeed = Math.sqrt(newVx ** 2 + newVy ** 2);

      // Create dust when moving fast
      if (Math.random() < 0.3 && newSpeed > 3) {
        createDust(newX, newY);
      }

      return {
        x: newX,
        y: newY,
        vx: newVx,
        vy: newVy,
        angle: newAngle,
        speed: newSpeed,
        drift: newDrift
      };
    });
  }, [keys, gameOver, paused, turbo, createDust]);

  const updateObstacles = useCallback(() => {
    if (gameOver || paused) return;

    setObstacles(prev => {
      let newObstacles = prev.map(obstacle => ({
        ...obstacle,
        y: obstacle.y + speed
      })).filter(obstacle => obstacle.y < CANVAS_HEIGHT + 100);

      // Add new obstacles
      while (newObstacles.length < 10) {
        const types: Obstacle['type'][] = ['cactus', 'rock', 'dune'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        newObstacles.push({
          x: Math.random() * (CANVAS_WIDTH - 50),
          y: -100,
          width: type === 'dune' ? 80 : type === 'cactus' ? 25 : 40,
          height: type === 'dune' ? 40 : type === 'cactus' ? 60 : 30,
          type
        });
      }

      return newObstacles;
    });

    // Update score and speed
    setScore(prev => prev + 1);
    setDistance(prev => prev + 0.1);
    setSpeed(prev => Math.min(6, prev + 0.002));
  }, [gameOver, paused, speed]);

  const updateDust = useCallback(() => {
    if (gameOver || paused) return;

    setDustClouds(prev => 
      prev.map(dust => ({
        ...dust,
        life: dust.life - 1,
        y: dust.y + 1,
        size: dust.size * 1.05
      })).filter(dust => dust.life > 0)
    );
  }, [gameOver, paused]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    const collision = obstacles.some(obstacle =>
      player.x < obstacle.x + obstacle.width &&
      player.x + CAR_WIDTH > obstacle.x &&
      player.y < obstacle.y + obstacle.height &&
      player.y + CAR_HEIGHT > obstacle.y
    );

    if (collision) {
      setGameOver(true);
      if (onScoreUpdate) {
        onScoreUpdate(Math.floor(score + distance * 10));
      }
    }
  }, [obstacles, player, gameOver, paused, score, distance, onScoreUpdate]);

  const resetGame = () => {
    setPlayer({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 80,
      vx: 0,
      vy: 0,
      angle: 0,
      speed: 0,
      drift: 0
    });
    setObstacles(createObstacles());
    setDustClouds([]);
    setScore(0);
    setDistance(0);
    setTurbo(100);
    setSpeed(2);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (obstacles.length === 0) {
      setObstacles(createObstacles());
    }
  }, [obstacles.length, createObstacles]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
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
  }, []);

  useEffect(() => {
    const gameInterval = setInterval(() => {
      updatePlayer();
      updateObstacles();
      updateDust();
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateObstacles, updateDust, checkCollisions]);

  const getObstacleColor = (type: Obstacle['type']) => {
    switch (type) {
      case 'cactus': return 'bg-green-600';
      case 'rock': return 'bg-gray-700';
      case 'dune': return 'bg-yellow-700';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">DESERT RALLY</div>
            <div className="text-sm">Score: {score} | Distance: {Math.floor(distance)}km</div>
            <div className="text-sm">Turbo: {Math.floor(turbo)}%</div>
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

        {/* Turbo meter */}
        <div className="mb-4 bg-gray-800 border border-cyan-400 rounded p-2">
          <div className="text-cyan-400 text-xs retro-font mb-1">TURBO BOOST</div>
          <div className="w-full h-3 bg-gray-600 border border-gray-500 rounded">
            <div
              className={`h-full rounded transition-all duration-200 ${
                turbo > 60 ? 'bg-green-400' : 
                turbo > 30 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${turbo}%` }}
            />
          </div>
        </div>

        <div
          className="relative bg-gradient-to-b from-yellow-600 to-orange-400 border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Desert sand texture */}
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-orange-500 opacity-30" />

          {/* Dust clouds */}
          {dustClouds.map((dust, index) => (
            <div
              key={index}
              className="absolute bg-yellow-200 rounded-full opacity-40"
              style={{
                left: dust.x - dust.size / 2,
                top: dust.y - dust.size / 2,
                width: dust.size,
                height: dust.size
              }}
            />
          ))}

          {/* Obstacles */}
          {obstacles.map((obstacle, index) => (
            <div
              key={index}
              className={`absolute ${getObstacleColor(obstacle.type)} rounded`}
              style={{
                left: obstacle.x,
                top: obstacle.y,
                width: obstacle.width,
                height: obstacle.height
              }}
            />
          ))}

          {/* Player car */}
          <div
            className={`absolute rounded transition-all duration-100 ${
              player.drift > 0.1 ? 'bg-orange-400' : 'bg-blue-500'
            }`}
            style={{
              left: player.x - CAR_WIDTH / 2,
              top: player.y - CAR_HEIGHT / 2,
              width: CAR_WIDTH,
              height: CAR_HEIGHT,
              transform: `rotate(${player.angle}rad)`,
              clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 100%, 0% 100%, 0% 30%)'
            }}
          />
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Off-road racing through the desert! Use Space for turbo boost.</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">CRASHED!</div>
            <p className="text-cyan-400 mb-4 retro-font">
              Score: {Math.floor(score + distance * 10)} | Distance: {Math.floor(distance)}km
            </p>
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

export default DesertRally;