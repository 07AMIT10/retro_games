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

// Extended player type with velocity components for smoother movement
interface PlayerCar extends Position {
  vx: number;
  vy: number;
  angle: number;
}

const CircuitRacer: React.FC<CircuitRacerProps> = ({ onScoreUpdate }) => {
  // Enhanced player state with velocity properties
  const [player, setPlayer] = useState<PlayerCar>({ 
    x: CANVAS_WIDTH / 2 + TRACK_INNER_RADIUS + 25, 
    y: CANVAS_HEIGHT / 2,
    vx: 0,
    vy: 0,
    angle: 0
  });
  
  const [speed, setSpeed] = useState(0);
  const [maxSpeed] = useState(8);
  const [laps, setLaps] = useState(0);
  const [lastCheckpoint, setLastCheckpoint] = useState(0);
  const [passedCheckpoints, setPassedCheckpoints] = useState<Set<number>>(new Set([0]));
  const [gameTime, setGameTime] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [offTrackTimer, setOffTrackTimer] = useState(0);
  
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;

  // Fixed isOnTrack function with proper margins
  const isOnTrack = (x: number, y: number): boolean => {
    const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    // Allow a small margin outside the track before considering it off-track
    const outerMargin = 15; // Increased margin for more forgiveness
    const innerMargin = 10; // Increased inner margin as well
    return distFromCenter >= (TRACK_INNER_RADIUS - innerMargin) && 
           distFromCenter <= (TRACK_OUTER_RADIUS + outerMargin);
  };

  // Enhanced checkpoint detection logic
  const getCheckpoint = (x: number, y: number): number => {
    const dx = x - centerX;
    const dy = y - centerY;
    const angle = Math.atan2(dy, dx);
    // Convert to 0-8 range for 8 checkpoints (more precise tracking)
    // Use modulo to ensure we always get a positive index
    return Math.floor(((angle + Math.PI) / (Math.PI * 2) * 8 + 8) % 8);
  };

  // Improved updateGame function with more responsive controls
  const updateGame = useCallback(() => {
    if (gameOver || paused) return;

    setGameTime(prev => prev + 1/60);

    // Handle input with improved physics
    setPlayer(prev => {
      // Current state
      let newX = prev.x;
      let newY = prev.y;
      let newVx = prev.vx;
      let newVy = prev.vy;
      let newAngle = prev.angle;
      
      // Adjusted constants for better feel
      const ACCELERATION = 0.25;
      const STEERING_SPEED = 0.05;
      const FRICTION = 0.95;
      const GRIP = 0.92;

      // Apply basic friction
      newVx *= FRICTION;
      newVy *= FRICTION;
      
      // Acceleration with better feel
      if (keys.has('ArrowUp')) {
        const acceleration = ACCELERATION;
        newVx += Math.cos(newAngle) * acceleration;
        newVy += Math.sin(newAngle) * acceleration;
      } 
      // Braking/Reversing
      else if (keys.has('ArrowDown')) {
        const currentSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
        // If moving, brake more effectively
        if (currentSpeed > 0.5) {
          newVx *= 0.85;
          newVy *= 0.85;
        } 
        // If almost stopped, allow reverse
        else {
          newVx -= Math.cos(newAngle) * (ACCELERATION * 0.5);
          newVy -= Math.sin(newAngle) * (ACCELERATION * 0.5);
        }
      }

      // Calculate current speed for steering sensitivity
      const currentSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
      const steeringFactor = Math.min(1, currentSpeed / 1.5);

      // Steering with speed-sensitive turning radius - more responsive at low speeds
      if (Math.abs(currentSpeed) > 0.1) {
        if (keys.has('ArrowLeft')) {
          newAngle -= STEERING_SPEED * (steeringFactor + 0.2);
        }
        if (keys.has('ArrowRight')) {
          newAngle += STEERING_SPEED * (steeringFactor + 0.2);
        }
      }

      // Handbrake - allows drifting
      if (keys.has(' ') && currentSpeed > 0.5) {
        // More dramatic drift effect
        const forwardSpeed = Math.cos(newAngle) * newVx + Math.sin(newAngle) * newVy;
        newVx *= 0.8;
        newVy *= 0.8;
        
        // Enhanced steering while handbraking
        if (keys.has('ArrowLeft')) {
          newAngle -= STEERING_SPEED * 2;
        }
        if (keys.has('ArrowRight')) {
          newAngle += STEERING_SPEED * 2;
        }
      }

      // Calculate new position
      newX += newVx;
      newY += newVy;

      // Return updated state
      return {
        x: newX,
        y: newY,
        vx: newVx,
        vy: newVy,
        angle: newAngle
      };
    });

    // Update speed display value
    const currentSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    setSpeed(currentSpeed);

    // Track detection with penalty instead of instant game over
    if (!isOnTrack(player.x, player.y)) {
      setOffTrackTimer(prev => {
        const newTime = prev + 1;
        // Slow the player down when off track
        setPlayer(prevPlayer => ({
          ...prevPlayer,
          vx: prevPlayer.vx * 0.85,
          vy: prevPlayer.vy * 0.85
        }));
        
        // End game if off track too long, but give more time
        if (newTime > 120) { // ~2 seconds at 60fps
          setGameOver(true);
          if (onScoreUpdate) {
            // Penalty for going off track
            onScoreUpdate(Math.floor(laps * 1000 + gameTime - offTrackTimer * 5));
          }
        }
        return newTime;
      });
    } else {
      setOffTrackTimer(0); // Reset timer when back on track
    }

    // Enhanced checkpoint and lap detection
    const currentCheckpoint = getCheckpoint(player.x, player.y);
    
    if (currentCheckpoint !== lastCheckpoint) {
      // Add to passed checkpoints set
      setPassedCheckpoints(prev => {
        const newSet = new Set(prev);
        newSet.add(currentCheckpoint);
        return newSet;
      });

      // Check for lap completion - must pass enough checkpoints in sequence
      if (currentCheckpoint === 0 && passedCheckpoints.size >= 6) {
        setLaps(prev => prev + 1);
        // Reset checkpoints for next lap
        setPassedCheckpoints(new Set([0]));
      }
      
      setLastCheckpoint(currentCheckpoint);
    }
  }, [player, gameOver, paused, keys, maxSpeed, laps, lastCheckpoint, passedCheckpoints, gameTime, centerX, centerY, onScoreUpdate, offTrackTimer]);

  const resetGame = () => {
    setPlayer({ 
      x: CANVAS_WIDTH / 2 + TRACK_INNER_RADIUS + 25, 
      y: CANVAS_HEIGHT / 2,
      vx: 0,
      vy: 0,
      angle: 0
    });
    setSpeed(0);
    setLaps(0);
    setLastCheckpoint(0);
    setPassedCheckpoints(new Set([0]));
    setGameTime(0);
    setOffTrackTimer(0);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only prevent default for game controls
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'p', 'P', 'Escape'].includes(e.key)) {
        e.preventDefault();
      }
      
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        setPaused(prev => !prev);
        return;
      }
      setKeys(prev => new Set(prev).add(e.key));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
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
    // Prevent keys from getting "stuck" when window loses focus
    const handleBlur = () => {
      setKeys(new Set());
    };

    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    // Fixed time step for consistent physics
    const FPS = 60;
    const frameTime = 1000 / FPS;
    
    // Use requestAnimationFrame for smoother rendering
    let frameId: number;
    let lastTime = 0;
    let deltaTime = 0;
    
    const gameLoop = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      deltaTime += timestamp - lastTime;
      lastTime = timestamp;
      
      // Update game state at fixed time step
      while (deltaTime >= frameTime) {
        if (!paused && !gameOver) {
          updateGame();
        }
        deltaTime -= frameTime;
      }
      
      frameId = requestAnimationFrame(gameLoop);
    };
    
    frameId = requestAnimationFrame(gameLoop);
    
    return () => cancelAnimationFrame(frameId);
  }, [updateGame, paused, gameOver]);

  // Create more checkpoints for better lap tracking
  const checkpoints = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
    const checkpointAngle = (i * Math.PI / 4) - Math.PI / 8;
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
                passedCheckpoints.has(index) ? 'bg-green-400' : 'bg-yellow-400'
              }`}
              style={{
                left: checkpoint.x - 6,
                top: checkpoint.y - 6,
                opacity: index === lastCheckpoint ? 1 : 0.5
              }}
            />
          ))}

          {/* Player car */}
          <div
            className={`absolute rounded transition-all duration-100 ${
              offTrackTimer > 0 ? 'bg-orange-400' : 'bg-cyan-400'
            }`}
            style={{
              left: player.x - CAR_WIDTH / 2,
              top: player.y - CAR_HEIGHT / 2,
              width: CAR_WIDTH,
              height: CAR_HEIGHT,
              transform: `rotate(${player.angle + Math.PI/2}rad)`,
              clipPath: 'polygon(50% 0%, 100% 70%, 85% 100%, 15% 100%, 0% 70%)'
            }}
          />

          {/* Speed trail effect */}
          {speed > 3 && !paused && !gameOver && (
            <div
              className="absolute bg-cyan-300 opacity-30 rounded"
              style={{
                left: player.x - CAR_WIDTH / 2 - Math.cos(player.angle) * 15,
                top: player.y - CAR_HEIGHT / 2 - Math.sin(player.angle) * 15,
                width: CAR_WIDTH * 0.8,
                height: CAR_HEIGHT * 0.8,
                transform: `rotate(${player.angle + Math.PI/2}rad)`
              }}
            />
          )}
          
          {/* Off-track warning */}
          {offTrackTimer > 0 && (
            <div 
              className="absolute top-4 left-0 right-0 text-center text-red-500 text-lg font-bold animate-pulse"
            >
              WARNING: Return to track!
            </div>
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
              <p><strong>P/Esc</strong> Pause</p>
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