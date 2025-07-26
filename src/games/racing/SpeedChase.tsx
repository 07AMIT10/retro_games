import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface SpeedChaseProps {
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
  speed: number;
  nitro: number;
}

interface PoliceCar extends Position {
  vx: number;
  vy: number;
  speed: number;
  active: boolean;
}

interface TrafficCar extends Position {
  vy: number;
  lane: number;
  color: string;
}

const SpeedChase: React.FC<SpeedChaseProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Car>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 80,
    vx: 0,
    vy: 0,
    speed: 0,
    nitro: 100
  });
  const [policeCars, setPoliceCars] = useState<PoliceCar[]>([]);
  const [trafficCars, setTrafficCars] = useState<TrafficCar[]>([]);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [wantedLevel, setWantedLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [baseSpeed, setBaseSpeed] = useState(4);

  const lanePositions = [150, 225, 300, 375, 450];

  const createPoliceCar = useCallback(() => {
    if (Math.random() < 0.01 * wantedLevel) {
      setPoliceCars(prev => [...prev, {
        x: lanePositions[Math.floor(Math.random() * lanePositions.length)],
        y: -CAR_HEIGHT,
        vx: 0,
        vy: baseSpeed + 2,
        speed: baseSpeed + 2,
        active: true
      }]);
    }
  }, [wantedLevel, baseSpeed, lanePositions]);

  const createTrafficCar = useCallback(() => {
    if (Math.random() < 0.02) {
      const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'];
      setTrafficCars(prev => [...prev, {
        x: lanePositions[Math.floor(Math.random() * lanePositions.length)],
        y: -CAR_HEIGHT,
        vy: baseSpeed - 1 + Math.random() * 2,
        lane: Math.floor(Math.random() * lanePositions.length),
        color: colors[Math.floor(Math.random() * colors.length)]
      }]);
    }
  }, [baseSpeed, lanePositions]);

  const updatePlayer = useCallback(() => {
    if (gameOver || paused) return;

    setPlayer(prev => {
      let newVx = prev.vx;
      let newVy = prev.vy;

      // Steering
      if (keys.has('ArrowLeft')) {
        newVx = Math.max(-8, prev.vx - 0.5);
      } else if (keys.has('ArrowRight')) {
        newVx = Math.min(8, prev.vx + 0.5);
      } else {
        newVx = prev.vx * 0.9; // Auto-center
      }

      // Acceleration
      if (keys.has('ArrowUp')) {
        newVy = Math.max(-10, prev.vy - 0.4);
      } else if (keys.has('ArrowDown')) {
        newVy = Math.min(2, prev.vy + 0.6); // Brake
      } else {
        newVy = prev.vy * 0.95;
      }

      // Nitro boost
      if (keys.has(' ') && prev.nitro > 0) {
        newVy = Math.max(-15, newVy - 1);
        setPlayer(prevPlayer => ({ 
          ...prevPlayer, 
          nitro: Math.max(0, prevPlayer.nitro - 3) 
        }));
      } else if (prev.nitro < 100) {
        setPlayer(prevPlayer => ({ 
          ...prevPlayer, 
          nitro: Math.min(100, prevPlayer.nitro + 0.5) 
        }));
      }

      let newX = prev.x + newVx;
      let newY = prev.y + newVy;

      // Keep on road
      newX = Math.max(100, Math.min(550, newX));

      // Keep in viewport
      newY = Math.max(50, Math.min(CANVAS_HEIGHT - 50, newY));

      const newSpeed = Math.sqrt(newVx ** 2 + newVy ** 2);

      return {
        x: newX,
        y: newY,
        vx: newVx,
        vy: newVy,
        speed: newSpeed,
        nitro: prev.nitro
      };
    });
  }, [keys, gameOver, paused]);

  const updatePoliceCars = useCallback(() => {
    if (gameOver || paused) return;

    setPoliceCars(prev => 
      prev.map(car => {
        if (!car.active) return car;

        // AI chase behavior
        const dx = player.x - car.x;
        let newVx = car.vx + dx * 0.01;
        newVx = Math.max(-6, Math.min(6, newVx));

        const newX = car.x + newVx;
        const newY = car.y + car.vy;

        return {
          ...car,
          x: Math.max(100, Math.min(550, newX)),
          y: newY,
          vx: newVx,
          active: newY < CANVAS_HEIGHT + CAR_HEIGHT
        };
      }).filter(car => car.active)
    );

    createPoliceCar();
  }, [gameOver, paused, player.x, createPoliceCar]);

  const updateTrafficCars = useCallback(() => {
    if (gameOver || paused) return;

    setTrafficCars(prev => 
      prev.map(car => ({
        ...car,
        y: car.y + car.vy
      })).filter(car => car.y < CANVAS_HEIGHT + CAR_HEIGHT)
    );

    createTrafficCar();
  }, [gameOver, paused, createTrafficCar]);

  const updateGame = useCallback(() => {
    if (gameOver || paused) return;

    // Update score and distance
    setScore(prev => prev + Math.floor(player.speed));
    setDistance(prev => prev + player.speed * 0.01);

    // Increase wanted level and difficulty
    const newWantedLevel = Math.min(5, Math.floor(distance / 100) + 1);
    setWantedLevel(newWantedLevel);
    setBaseSpeed(4 + newWantedLevel * 0.5);
  }, [gameOver, paused, player.speed, distance]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Check collision with police cars
    const policeHit = policeCars.some(car =>
      car.active &&
      player.x < car.x + CAR_WIDTH &&
      player.x + CAR_WIDTH > car.x &&
      player.y < car.y + CAR_HEIGHT &&
      player.y + CAR_HEIGHT > car.y
    );

    // Check collision with traffic
    const trafficHit = trafficCars.some(car =>
      player.x < car.x + CAR_WIDTH &&
      player.x + CAR_WIDTH > car.x &&
      player.y < car.y + CAR_HEIGHT &&
      player.y + CAR_HEIGHT > car.y
    );

    if (policeHit || trafficHit) {
      setGameOver(true);
      if (onScoreUpdate) {
        onScoreUpdate(score);
      }
    }
  }, [policeCars, trafficCars, player, gameOver, paused, score, onScoreUpdate]);

  const resetGame = () => {
    setPlayer({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 80,
      vx: 0,
      vy: 0,
      speed: 0,
      nitro: 100
    });
    setPoliceCars([]);
    setTrafficCars([]);
    setScore(0);
    setDistance(0);
    setWantedLevel(1);
    setBaseSpeed(4);
    setGameOver(false);
    setPaused(false);
  };

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
      updatePoliceCars();
      updateTrafficCars();
      updateGame();
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updatePoliceCars, updateTrafficCars, updateGame, checkCollisions]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">SPEED CHASE</div>
            <div className="text-sm">Score: {score} | Distance: {Math.floor(distance)}km</div>
            <div className="text-sm">Wanted Level: {'★'.repeat(wantedLevel)}</div>
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

        {/* Nitro meter */}
        <div className="mb-4 bg-gray-800 border border-cyan-400 rounded p-2">
          <div className="text-cyan-400 text-xs retro-font mb-1">NITRO</div>
          <div className="w-full h-3 bg-gray-600 border border-gray-500 rounded">
            <div
              className={`h-full rounded transition-all duration-200 ${
                player.nitro > 60 ? 'bg-blue-400' : 
                player.nitro > 30 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${player.nitro}%` }}
            />
          </div>
        </div>

        <div
          className="relative bg-gray-600 border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Road */}
          <div
            className="absolute bg-gray-700"
            style={{
              left: 100,
              top: 0,
              width: 450,
              height: CANVAS_HEIGHT
            }}
          />

          {/* Lane markings */}
          {lanePositions.slice(1, -1).map((lane, index) => (
            <div
              key={index}
              className="absolute bg-yellow-400"
              style={{
                left: lane - 1,
                top: 0,
                width: 2,
                height: CANVAS_HEIGHT,
                backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 20px, #facc15 20px, #facc15 40px)'
              }}
            />
          ))}

          {/* Traffic cars */}
          {trafficCars.map((car, index) => (
            <div
              key={`traffic-${index}`}
              className="absolute rounded"
              style={{
                left: car.x - CAR_WIDTH / 2,
                top: car.y - CAR_HEIGHT / 2,
                width: CAR_WIDTH,
                height: CAR_HEIGHT,
                backgroundColor: car.color,
                clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 100%, 0% 100%, 0% 30%)'
              }}
            />
          ))}

          {/* Police cars */}
          {policeCars.map((car, index) => (
            <div
              key={`police-${index}`}
              className="absolute bg-blue-600 rounded animate-pulse"
              style={{
                left: car.x - CAR_WIDTH / 2,
                top: car.y - CAR_HEIGHT / 2,
                width: CAR_WIDTH,
                height: CAR_HEIGHT,
                clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 100%, 0% 100%, 0% 30%)'
              }}
            />
          ))}

          {/* Player car */}
          <div
            className={`absolute rounded transition-all duration-100 ${
              keys.has(' ') && player.nitro > 0 ? 'bg-orange-400' : 'bg-red-500'
            }`}
            style={{
              left: player.x - CAR_WIDTH / 2,
              top: player.y - CAR_HEIGHT / 2,
              width: CAR_WIDTH,
              height: CAR_HEIGHT,
              clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 100%, 0% 100%, 0% 30%)'
            }}
          />

          {/* Nitro trail effect */}
          {keys.has(' ') && player.nitro > 0 && (
            <div
              className="absolute bg-blue-400 opacity-60 rounded"
              style={{
                left: player.x - CAR_WIDTH / 2,
                top: player.y + CAR_HEIGHT / 2,
                width: CAR_WIDTH,
                height: 20
              }}
            />
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Outrun the police! Avoid traffic and use nitro wisely.</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">BUSTED!</div>
            <p className="text-cyan-400 mb-4 retro-font">
              Score: {score} | Distance: {Math.floor(distance)}km
            </p>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-bold border-2 border-cyan-400"
            >
              ESCAPE AGAIN
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

export default SpeedChase;