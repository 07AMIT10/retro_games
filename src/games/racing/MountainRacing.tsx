import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface MountainRacingProps {
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
}

interface Obstacle extends Position {
  width: number;
  height: number;
  type: 'rock' | 'tree' | 'cliff';
}

const MountainRacing: React.FC<MountainRacingProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Car>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 80,
    vx: 0,
    vy: 0,
    angle: 0,
    speed: 0
  });
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [score, setScore] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [speed, setSpeed] = useState(2);

  const createObstacles = useCallback(() => {
    const newObstacles: Obstacle[] = [];
    for (let i = 0; i < 8; i++) {
      const types: Obstacle['type'][] = ['rock', 'tree', 'cliff'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      newObstacles.push({
        x: Math.random() * (CANVAS_WIDTH - 50),
        y: -i * 100 - 100,
        width: type === 'cliff' ? 80 : type === 'tree' ? 30 : 40,
        height: type === 'cliff' ? 60 : type === 'tree' ? 50 : 30,
        type
      });
    }
    return newObstacles;
  }, []);

  const updatePlayer = useCallback(() => {
    if (gameOver || paused) return;

    setPlayer(prev => {
      let newVx = prev.vx;
      let newVy = prev.vy;
      let newAngle = prev.angle;

      // Steering
      if (keys.has('ArrowLeft')) {
        newVx = Math.max(-6, prev.vx - 0.3);
        newAngle -= 0.1;
      }
      if (keys.has('ArrowRight')) {
        newVx = Math.min(6, prev.vx + 0.3);
        newAngle += 0.1;
      }

      // Acceleration/Braking
      if (keys.has('ArrowUp')) {
        newVy = Math.max(-8, prev.vy - 0.4);
      } else if (keys.has('ArrowDown')) {
        newVy = Math.min(2, prev.vy + 0.6); // Brake/reverse
      } else {
        newVy = prev.vy * 0.95; // Natural deceleration
      }

      // Apply friction
      newVx *= 0.9;

      let newX = prev.x + newVx;
      let newY = prev.y + newVy;

      // Keep on screen horizontally
      newX = Math.max(CAR_WIDTH / 2, Math.min(CANVAS_WIDTH - CAR_WIDTH / 2, newX));

      // Wrap vertically (continuous mountain road)
      if (newY < -CAR_HEIGHT) {
        newY = CANVAS_HEIGHT;
      } else if (newY > CANVAS_HEIGHT) {
        newY = -CAR_HEIGHT;
      }

      const newSpeed = Math.sqrt(newVx ** 2 + newVy ** 2);

      return {
        x: newX,
        y: newY,
        vx: newVx,
        vy: newVy,
        angle: newAngle,
        speed: newSpeed
      };
    });
  }, [keys, gameOver, paused]);

  const updateObstacles = useCallback(() => {
    if (gameOver || paused) return;

    setObstacles(prev => {
      let newObstacles = prev.map(obstacle => ({
        ...obstacle,
        y: obstacle.y + speed
      })).filter(obstacle => obstacle.y < CANVAS_HEIGHT + 100);

      // Add new obstacles at the top
      while (newObstacles.length < 8) {
        const types: Obstacle['type'][] = ['rock', 'tree', 'cliff'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        newObstacles.push({
          x: Math.random() * (CANVAS_WIDTH - 50),
          y: -100,
          width: type === 'cliff' ? 80 : type === 'tree' ? 30 : 40,
          height: type === 'cliff' ? 60 : type === 'tree' ? 50 : 30,
          type
        });
      }

      return newObstacles;
    });

    // Update score and speed
    setScore(prev => prev + 1);
    setAltitude(prev => prev + 0.1);
    setSpeed(prev => Math.min(6, prev + 0.001));
  }, [gameOver, paused, speed]);

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
        onScoreUpdate(Math.floor(score + altitude * 10));
      }
    }
  }, [obstacles, player, gameOver, paused, score, altitude, onScoreUpdate]);

  const resetGame = () => {
    setPlayer({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 80,
      vx: 0,
      vy: 0,
      angle: 0,
      speed: 0
    });
    setObstacles(createObstacles());
    setScore(0);
    setAltitude(0);
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
      if (e.key === ' ') {
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
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateObstacles, checkCollisions]);

  const getObstacleColor = (type: Obstacle['type']) => {
    switch (type) {
      case 'rock': return 'bg-gray-600';
      case 'tree': return 'bg-green-700';
      case 'cliff': return 'bg-orange-800';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">MOUNTAIN RACING</div>
            <div className="text-sm">Score: {score} | Altitude: {Math.floor(altitude)}m</div>
            <div className="text-sm">Speed: {speed.toFixed(1)}</div>
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
          className="relative bg-gradient-to-b from-blue-300 to-green-600 border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Mountain road */}
          <div className="absolute inset-0 bg-gradient-to-b from-gray-400 to-gray-500 opacity-50" />

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
            className="absolute bg-red-500 rounded"
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
          <p>Navigate treacherous mountain roads! Avoid rocks, trees, and cliffs.</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">CRASHED!</div>
            <p className="text-cyan-400 mb-4 retro-font">
              Score: {Math.floor(score + altitude * 10)} | Altitude: {Math.floor(altitude)}m
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

export default MountainRacing;