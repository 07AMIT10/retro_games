import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const ROAD_WIDTH = 300;
const CAR_WIDTH = 40;
const CAR_HEIGHT = 60;
const LANE_WIDTH = ROAD_WIDTH / 3;

interface Position {
  x: number;
  y: number;
}

interface Car extends Position {
  lane: number;
  color: string;
  speed: number;
}

interface RoadRacerProps {
  onScoreUpdate?: (score: number) => void;
}

const RoadRacer: React.FC<RoadRacerProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Position>({ 
    x: CANVAS_WIDTH / 2 - CAR_WIDTH / 2, 
    y: CANVAS_HEIGHT - 100 
  });
  const [playerLane, setPlayerLane] = useState<number>(1); // 0, 1, 2
  const [cars, setCars] = useState<Car[]>([]);
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());

  const carColors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff'];

  const spawnCar = useCallback(() => {
    if (Math.random() < 0.02 + speed * 0.001) {
      const lane = Math.floor(Math.random() * 3);
      const roadStart = (CANVAS_WIDTH - ROAD_WIDTH) / 2;
      const newCar: Car = {
        x: roadStart + lane * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2,
        y: -CAR_HEIGHT,
        lane,
        color: carColors[Math.floor(Math.random() * carColors.length)],
        speed: 2 + Math.random() * 2
      };
      setCars(prev => [...prev, newCar]);
    }
  }, [speed]);

  const updateGame = useCallback(() => {
    if (gameOver || paused) return;

    // Update player position based on lane
    const roadStart = (CANVAS_WIDTH - ROAD_WIDTH) / 2;
    setPlayer(prev => ({
      ...prev,
      x: roadStart + playerLane * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2
    }));

    // Move cars down
    setCars(prevCars => {
      const newCars = prevCars
        .map(car => ({ ...car, y: car.y + car.speed + speed }))
        .filter(car => car.y < CANVAS_HEIGHT + CAR_HEIGHT);

      // Check collisions
      const collision = newCars.some(car => 
        car.lane === playerLane && 
        car.y + CAR_HEIGHT > player.y && 
        car.y < player.y + CAR_HEIGHT
      );

      if (collision) {
        setGameOver(true);
        if (onScoreUpdate) {
          onScoreUpdate(score);
        }
      }

      return newCars;
    });

    // Increase score and speed
    setScore(prev => {
      const newScore = prev + 1;
      setSpeed(2 + Math.floor(newScore / 500) * 0.5);
      return newScore;
    });

    spawnCar();
  }, [gameOver, paused, playerLane, player.y, score, speed, spawnCar, onScoreUpdate]);

  const resetGame = () => {
    setPlayer({ x: CANVAS_WIDTH / 2 - CAR_WIDTH / 2, y: CANVAS_HEIGHT - 100 });
    setPlayerLane(1);
    setCars([]);
    setScore(0);
    setSpeed(2);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      setKeys(prev => new Set(prev).add(e.key));

      switch (e.key) {
        case 'ArrowLeft':
          if (!gameOver && !paused) {
            setPlayerLane(prev => Math.max(0, prev - 1));
          }
          break;
        case 'ArrowRight':
          if (!gameOver && !paused) {
            setPlayerLane(prev => Math.min(2, prev + 1));
          }
          break;
        case ' ':
          if (!gameOver) {
            setPaused(prev => !prev);
          }
          break;
      }
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
  }, [gameOver, paused]);

  useEffect(() => {
    const gameInterval = setInterval(updateGame, 50);
    return () => clearInterval(gameInterval);
  }, [updateGame]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">SCORE: {score}</div>
            <div className="text-sm">SPEED: {speed.toFixed(1)}</div>
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
          className="relative bg-gray-800 border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Road */}
          <div 
            className="absolute bg-gray-700 border-x-4 border-yellow-400"
            style={{
              left: (CANVAS_WIDTH - ROAD_WIDTH) / 2,
              top: 0,
              width: ROAD_WIDTH,
              height: CANVAS_HEIGHT
            }}
          >
            {/* Lane dividers */}
            {[1, 2].map(lane => (
              <div
                key={lane}
                className="absolute bg-yellow-400"
                style={{
                  left: lane * LANE_WIDTH - 1,
                  top: 0,
                  width: 2,
                  height: CANVAS_HEIGHT,
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 20px, #facc15 20px, #facc15 40px)'
                }}
              />
            ))}
          </div>

          {/* Player car */}
          <div
            className="absolute bg-cyan-400 rounded transition-all duration-200"
            style={{
              left: player.x,
              top: player.y,
              width: CAR_WIDTH,
              height: CAR_HEIGHT,
              clipPath: 'polygon(30% 0%, 70% 0%, 100% 20%, 100% 100%, 0% 100%, 0% 20%)'
            }}
          />

          {/* Traffic cars */}
          {cars.map((car, index) => (
            <div
              key={index}
              className="absolute rounded"
              style={{
                left: car.x,
                top: car.y,
                width: CAR_WIDTH,
                height: CAR_HEIGHT,
                backgroundColor: car.color,
                clipPath: 'polygon(30% 0%, 70% 0%, 100% 20%, 100% 100%, 0% 100%, 0% 20%)'
              }}
            />
          ))}

          {/* Speed lines effect */}
          {!paused && !gameOver && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 bg-white opacity-30"
                  style={{
                    left: Math.random() * CANVAS_WIDTH,
                    top: -10,
                    height: 30,
                    animation: `fall ${0.5 + Math.random() * 0.5}s linear infinite`
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <div className="grid grid-cols-2 gap-4 mb-2">
            <p><strong>←→</strong> Change Lane</p>
            <p><strong>Space</strong> Brake/Pause</p>
          </div>
          <p className="text-yellow-400">Avoid traffic and survive as long as possible!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">GAME OVER!</div>
            <p className="text-cyan-400 mb-4 retro-font">Distance: {score}m</p>
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

      <style jsx>{`
        @keyframes fall {
          from { transform: translateY(-50px); }
          to { transform: translateY(${CANVAS_HEIGHT + 50}px); }
        }
      `}</style>
    </div>
  );
};

export default RoadRacer;