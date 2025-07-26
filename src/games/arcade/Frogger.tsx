import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 700;
const FROG_SIZE = 30;
const LANE_HEIGHT = 50;
const CAR_WIDTH = 80;
const CAR_HEIGHT = 40;
const LOG_WIDTH = 120;
const LOG_HEIGHT = 40;

interface Position {
  x: number;
  y: number;
}

interface Vehicle extends Position {
  width: number;
  speed: number;
  color: string;
}

interface FroggerProps {
  onScoreUpdate?: (score: number) => void;
}

const Frogger: React.FC<FroggerProps> = ({ onScoreUpdate }) => {
  const [frog, setFrog] = useState<Position>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 60 });
  const [cars, setCars] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<Vehicle[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState(1);

  const spawnVehicle = useCallback(() => {
    if (Math.random() < 0.02) {
      const lane = Math.floor(Math.random() * 5) + 2; // lanes 2-6 (roads)
      const direction = lane % 2 === 0 ? 1 : -1;
      const startX = direction > 0 ? -CAR_WIDTH : CANVAS_WIDTH;
      
      setCars(prev => [...prev, {
        x: startX,
        y: CANVAS_HEIGHT - (lane * LANE_HEIGHT) - 20,
        width: CAR_WIDTH,
        speed: (2 + Math.random() * 3) * direction,
        color: ['#ff4444', '#44ff44', '#4444ff', '#ffff44'][Math.floor(Math.random() * 4)]
      }]);
    }

    if (Math.random() < 0.015) {
      const lane = Math.floor(Math.random() * 4) + 8; // lanes 8-11 (water)
      const direction = lane % 2 === 0 ? 1 : -1;
      const startX = direction > 0 ? -LOG_WIDTH : CANVAS_WIDTH;
      
      setLogs(prev => [...prev, {
        x: startX,
        y: CANVAS_HEIGHT - (lane * LANE_HEIGHT) - 20,
        width: LOG_WIDTH,
        speed: (1 + Math.random() * 2) * direction,
        color: '#8B4513'
      }]);
    }
  }, []);

  const moveFrog = (direction: string) => {
    if (gameOver || paused) return;

    setFrog(prev => {
      let newX = prev.x;
      let newY = prev.y;

      switch (direction) {
        case 'up':
          newY = Math.max(0, prev.y - LANE_HEIGHT);
          if (newY < prev.y) setScore(s => s + 10);
          break;
        case 'down':
          newY = Math.min(CANVAS_HEIGHT - 60, prev.y + LANE_HEIGHT);
          break;
        case 'left':
          newX = Math.max(0, prev.x - 30);
          break;
        case 'right':
          newX = Math.min(CANVAS_WIDTH - FROG_SIZE, prev.x + 30);
          break;
      }

      return { x: newX, y: newY };
    });
  };

  const updateGame = useCallback(() => {
    if (gameOver || paused) return;

    // Move vehicles
    setCars(prevCars => 
      prevCars
        .map(car => ({ ...car, x: car.x + car.speed }))
        .filter(car => car.x > -CAR_WIDTH - 50 && car.x < CANVAS_WIDTH + 50)
    );

    setLogs(prevLogs => 
      prevLogs
        .map(log => ({ ...log, x: log.x + log.speed }))
        .filter(log => log.x > -LOG_WIDTH - 50 && log.x < CANVAS_WIDTH + 50)
    );

    // Check collisions with cars
    const carHit = cars.some(car => 
      frog.x < car.x + car.width &&
      frog.x + FROG_SIZE > car.x &&
      frog.y < car.y + CAR_HEIGHT &&
      frog.y + FROG_SIZE > car.y
    );

    if (carHit) {
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setGameOver(true);
          if (onScoreUpdate) onScoreUpdate(score);
        }
        return newLives;
      });
      setFrog({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 60 });
      return;
    }

    // Check if in water
    const waterLanes = [8, 9, 10, 11];
    const frogLane = Math.floor((CANVAS_HEIGHT - frog.y) / LANE_HEIGHT);
    
    if (waterLanes.includes(frogLane)) {
      const onLog = logs.some(log => 
        frog.x < log.x + log.width &&
        frog.x + FROG_SIZE > log.x &&
        Math.abs(frog.y - log.y) < 20
      );

      if (!onLog) {
        setLives(prev => {
          const newLives = prev - 1;
          if (newLives <= 0) {
            setGameOver(true);
            if (onScoreUpdate) onScoreUpdate(score);
          }
          return newLives;
        });
        setFrog({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 60 });
        return;
      }

      // Move frog with log
      const currentLog = logs.find(log => 
        frog.x < log.x + log.width &&
        frog.x + FROG_SIZE > log.x &&
        Math.abs(frog.y - log.y) < 20
      );

      if (currentLog) {
        setFrog(prev => ({
          ...prev,
          x: Math.max(0, Math.min(CANVAS_WIDTH - FROG_SIZE, prev.x + currentLog.speed))
        }));
      }
    }

    // Check win condition
    if (frog.y < 60) {
      setScore(prev => prev + 100 * level);
      setLevel(prev => prev + 1);
      setFrog({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 60 });
    }

    spawnVehicle();
  }, [cars, logs, frog, gameOver, paused, score, level, spawnVehicle, onScoreUpdate]);

  const resetGame = () => {
    setFrog({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 60 });
    setCars([]);
    setLogs([]);
    setScore(0);
    setLives(3);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveFrog('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveFrog('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          moveFrog('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveFrog('right');
          break;
        case ' ':
          e.preventDefault();
          setPaused(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    const gameInterval = setInterval(updateGame, 100);
    return () => clearInterval(gameInterval);
  }, [updateGame]);

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
          className="relative bg-green-600 border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Goal area */}
          <div className="absolute top-0 w-full h-12 bg-green-400 border-b-2 border-yellow-400" />
          
          {/* Water lanes */}
          {[8, 9, 10, 11].map(lane => (
            <div
              key={lane}
              className="absolute w-full bg-blue-600"
              style={{
                top: CANVAS_HEIGHT - (lane * LANE_HEIGHT) - LANE_HEIGHT,
                height: LANE_HEIGHT
              }}
            />
          ))}

          {/* Road lanes */}
          {[2, 3, 4, 5, 6].map(lane => (
            <div
              key={lane}
              className="absolute w-full bg-gray-700"
              style={{
                top: CANVAS_HEIGHT - (lane * LANE_HEIGHT) - LANE_HEIGHT,
                height: LANE_HEIGHT
              }}
            />
          ))}

          {/* Cars */}
          {cars.map((car, index) => (
            <div
              key={index}
              className="absolute rounded"
              style={{
                left: car.x,
                top: car.y,
                width: car.width,
                height: CAR_HEIGHT,
                backgroundColor: car.color
              }}
            />
          ))}

          {/* Logs */}
          {logs.map((log, index) => (
            <div
              key={index}
              className="absolute rounded"
              style={{
                left: log.x,
                top: log.y,
                width: log.width,
                height: LOG_HEIGHT,
                backgroundColor: log.color
              }}
            />
          ))}

          {/* Frog */}
          <div
            className="absolute bg-green-400 rounded-full border-2 border-green-300"
            style={{
              left: frog.x,
              top: frog.y,
              width: FROG_SIZE,
              height: FROG_SIZE
            }}
          />
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Get the frog safely across the road and river!</p>
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

export default Frogger;