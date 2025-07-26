import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 600;
const CAR_WIDTH = 20;
const CAR_HEIGHT = 30;
const TRACK_OUTER_RADIUS = 250;
const TRACK_INNER_RADIUS = 150;

interface Position {
  x: number;
  y: number;
}

interface CircuitRacerProps {
  onScoreUpdate?: (score: number) => void;
}

const CircuitRacer: React.FC<CircuitRacerProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Position>({ 
    x: CANVAS_WIDTH / 2 + TRACK_INNER_RADIUS + 25, 
    y: CANVAS_HEIGHT / 2 
  });
  const [angle, setAngle] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [maxSpeed] = useState(8);
  const [laps, setLaps] = useState(0);
  const [lastCheckpoint, setLastCheckpoint] = useState(0);
  const [gameTime, setGameTime] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());

  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;

  const isOnTrack = (x: number, y: number): boolean => {
    const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    return distFromCenter >= TRACK_INNER_RADIUS && distFromCenter <= TRACK_OUTER_RADIUS;
  };

  const getCheckpoint = (angle: number): number => {
    return Math.floor((angle + Math.PI) / (Math.PI / 2)) % 4;
  };

  const updateGame = useCallback(() => {
    if (gameOver || paused) return;

    setGameTime(prev => prev + 1/60);

    // Handle input
    let newSpeed = speed;
    let newAngle = angle;

    if (keys.has('ArrowUp')) {
      newSpeed = Math.min(maxSpeed, speed + 0.3);
    } else if (keys.has('ArrowDown')) {
      newSpeed = Math.max(-maxSpeed/2, speed - 0.3);
    } else {
      newSpeed = speed * 0.95; // Gradual deceleration
    }

    if (Math.abs(newSpeed) > 0.5) {
      if (keys.has('ArrowLeft')) {
        newAngle -= 0.05 * (newSpeed / maxSpeed);
      }
      if (keys.has('ArrowRight')) {
        newAngle += 0.05 * (newSpeed / maxSpeed);
      }
    }

    if (keys.has(' ')) {
      newSpeed *= 0.9; // Handbrake
    }

    // Calculate new position
    const newX = player.x + Math.cos(newAngle) * newSpeed;
    const newY = player.y + Math.sin(newAngle) * newSpeed;

    // Check if still on track
    if (!isOnTrack(newX, newY)) {
      setGameOver(true);
      if (onScoreUpdate) {
        onScoreUpdate(Math.floor(laps * 1000 + gameTime));
      }
      return;
    }

    setSpeed(newSpeed);
    setAngle(newAngle);
    setPlayer({ x: newX, y: newY });

    // Check for lap completion
    const currentCheckpoint = getCheckpoint(Math.atan2(newY - centerY, newX - centerX));
    
    if (currentCheckpoint !== lastCheckpoint) {
      if (currentCheckpoint === 0 && lastCheckpoint === 3) {
        setLaps(prev => prev + 1);
      }
      setLastCheckpoint(currentCheckpoint);
    }
  }, [
    gameOver, paused, keys, speed, angle, player, maxSpeed, laps, 
    lastCheckpoint, gameTime, centerX, centerY, onScoreUpdate
  ]);

  const resetGame = () => {
    setPlayer({ x: CANVAS_WIDTH / 2 + TRACK_INNER_RADIUS + 25, y: CANVAS_HEIGHT / 2 });
    setAngle(0);
    setSpeed(0);
    setLaps(0);
    setLastCheckpoint(0);
    setGameTime(0);
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
    const gameInterval = setInterval(updateGame, 16); // ~60 FPS
    return () => clearInterval(gameInterval);
  }, [updateGame]);

  // Create checkpoints for visual reference
  const checkpoints = [0, 1, 2, 3].map(i => {
    const checkpointAngle = (i * Math.PI / 2) - Math.PI / 2;
    const checkpointRadius = (TRACK_OUTER_RADIUS + TRACK_INNER_RADIUS) / 2;
    return {
      x: centerX + Math.cos(checkpointAngle) * checkpointRadius,
      y: centerY + Math.sin(checkpointAngle) * checkpointRadius
    };
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font space-y-1">
            <div className="text-lg font-bold">LAPS: {laps}</div>
            <div className="text-sm">TIME: {gameTime.toFixed(1)}s</div>
            <div className="text-sm">SPEED: {Math.abs(speed).toFixed(1)}</div>
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
          className="relative bg-green-800 border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Outer track boundary */}
          <div
            className="absolute border-4 border-white rounded-full"
            style={{
              left: centerX - TRACK_OUTER_RADIUS,
              top: centerY - TRACK_OUTER_RADIUS,
              width: TRACK_OUTER_RADIUS * 2,
              height: TRACK_OUTER_RADIUS * 2
            }}
          />

          {/* Inner track boundary */}
          <div
            className="absolute border-4 border-white rounded-full bg-green-900"
            style={{
              left: centerX - TRACK_INNER_RADIUS,
              top: centerY - TRACK_INNER_RADIUS,
              width: TRACK_INNER_RADIUS * 2,
              height: TRACK_INNER_RADIUS * 2
            }}
          />

          {/* Track surface */}
          <div
            className="absolute rounded-full bg-gray-600"
            style={{
              left: centerX - TRACK_OUTER_RADIUS + 4,
              top: centerY - TRACK_OUTER_RADIUS + 4,
              width: (TRACK_OUTER_RADIUS - 4) * 2,
              height: (TRACK_OUTER_RADIUS - 4) * 2
            }}
          />
          <div
            className="absolute rounded-full bg-green-900"
            style={{
              left: centerX - TRACK_INNER_RADIUS - 4,
              top: centerY - TRACK_INNER_RADIUS - 4,
              width: (TRACK_INNER_RADIUS + 4) * 2,
              height: (TRACK_INNER_RADIUS + 4) * 2
            }}
          />

          {/* Start/Finish line */}
          <div
            className="absolute bg-white"
            style={{
              left: centerX + TRACK_INNER_RADIUS,
              top: centerY - 20,
              width: TRACK_OUTER_RADIUS - TRACK_INNER_RADIUS,
              height: 4
            }}
          />
          <div
            className="absolute bg-black"
            style={{
              left: centerX + TRACK_INNER_RADIUS,
              top: centerY - 16,
              width: TRACK_OUTER_RADIUS - TRACK_INNER_RADIUS,
              height: 4
            }}
          />

          {/* Checkpoints */}
          {checkpoints.map((checkpoint, index) => (
            <div
              key={index}
              className={`absolute w-3 h-3 rounded-full ${
                index === lastCheckpoint ? 'bg-green-400' : 'bg-yellow-400'
              }`}
              style={{
                left: checkpoint.x - 6,
                top: checkpoint.y - 6
              }}
            />
          ))}

          {/* Player car */}
          <div
            className="absolute bg-cyan-400 rounded transition-all duration-100"
            style={{
              left: player.x - CAR_WIDTH / 2,
              top: player.y - CAR_HEIGHT / 2,
              width: CAR_WIDTH,
              height: CAR_HEIGHT,
              transform: `rotate(${angle + Math.PI/2}rad)`,
              clipPath: 'polygon(50% 0%, 100% 70%, 85% 100%, 15% 100%, 0% 70%)'
            }}
          />

          {/* Speed trail effect */}
          {Math.abs(speed) > 3 && !paused && !gameOver && (
            <div
              className="absolute bg-cyan-300 opacity-30 rounded"
              style={{
                left: player.x - CAR_WIDTH / 2 - Math.cos(angle) * 15,
                top: player.y - CAR_HEIGHT / 2 - Math.sin(angle) * 15,
                width: CAR_WIDTH * 0.8,
                height: CAR_HEIGHT * 0.8,
                transform: `rotate(${angle + Math.PI/2}rad)`
              }}
            />
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <p><strong>↑↓</strong> Accelerate/Brake</p>
              <p><strong>←→</strong> Steer</p>
            </div>
            <div>
              <p><strong>Space</strong> Handbrake</p>
              <p><strong>P</strong> Pause</p>
            </div>
          </div>
          <p className="text-yellow-400">Complete laps without leaving the track!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">CRASHED!</div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Laps Completed: {laps}</p>
              <p>Time: {gameTime.toFixed(1)}s</p>
              <p>Score: {Math.floor(laps * 1000 + gameTime)}</p>
            </div>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-bold border-2 border-cyan-400"
            >
              RACE AGAIN
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

export default CircuitRacer;