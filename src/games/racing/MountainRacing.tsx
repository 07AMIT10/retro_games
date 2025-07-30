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

      // Enhanced steering physics
      if (keys.has('ArrowLeft')) {
        // Steering more responsive at speed, less at low speeds
        const steerFactor = 0.3 * (1 + Math.abs(prev.vy) * 0.05);
        newVx = Math.max(-6.5, prev.vx - steerFactor);
        // Car turns more when steering at speed
        newAngle -= 0.1 * (1 + Math.abs(prev.vy) * 0.03);
      }
      if (keys.has('ArrowRight')) {
        const steerFactor = 0.3 * (1 + Math.abs(prev.vy) * 0.05);
        newVx = Math.min(6.5, prev.vx + steerFactor);
        newAngle += 0.1 * (1 + Math.abs(prev.vy) * 0.03);
      }

      // Improved acceleration/braking physics
      if (keys.has('ArrowUp')) {
        // Progressive acceleration that gets harder at higher speeds
        const accelerationFactor = 0.4 * (1 - Math.min(0.7, Math.abs(prev.vy) / 10));
        newVy = Math.max(-9, prev.vy - accelerationFactor);
      } else if (keys.has('ArrowDown')) {
        // More responsive braking
        const brakingFactor = prev.vy < 0 ? 0.8 : 0.4; // Stronger braking when moving forward
        newVy = Math.min(2.5, prev.vy + brakingFactor);
      } else {
        // Variable natural deceleration based on terrain
        const decelRate = 0.95 - (altitude / 1000) * 0.05; // Slightly less friction at higher altitudes
        newVy = prev.vy * decelRate;
      }

      // Apply variable friction based on terrain and speed
      // Less friction at higher speeds to simulate momentum
      const frictionFactor = 0.9 + (Math.abs(prev.speed) * 0.005);
      newVx *= Math.min(0.97, frictionFactor);

      // More realistic movement calculation
      let newX = prev.x + newVx;
      let newY = prev.y + newVy;

      // Enhanced boundary physics
      // Add slight bounce effect when hitting the edge
      if (newX < CAR_WIDTH / 2) {
        newX = CAR_WIDTH / 2;
        newVx *= -0.3; // Bounce effect
      } else if (newX > CANVAS_WIDTH - CAR_WIDTH / 2) {
        newX = CANVAS_WIDTH - CAR_WIDTH / 2;
        newVx *= -0.3; // Bounce effect
      }

      // Smooth vertical wrapping with speed penalty
      if (newY < -CAR_HEIGHT) {
        newY = CANVAS_HEIGHT;
        // Small speed penalty for wrapping (going over the mountain)
        newVy *= 0.8;
        // Add to altitude when wrapping
        setAltitude(a => a + 5);
      } else if (newY > CANVAS_HEIGHT) {
        newY = -CAR_HEIGHT;
        // Small speed penalty for wrapping (going down the mountain)
        newVy *= 0.8;
        // Decrease altitude when wrapping downward
        setAltitude(a => Math.max(0, a - 5));
      }

      // Calculate speed more accurately
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
  }, [keys, gameOver, paused, altitude]);

  const updateObstacles = useCallback(() => {
    if (gameOver || paused) return;

    setObstacles(prev => {
      // Dynamic obstacle movement based on player speed and game state
      const obstacleSpeed = speed * (1 + Math.abs(player.vy) * 0.1);
      
      let newObstacles = prev.map(obstacle => {
        // Add slight horizontal movement based on type for more dynamic obstacles
        let dx = 0;
        if (obstacle.type === 'tree') {
          // Trees sway slightly
          dx = Math.sin(Date.now() / 1000 + obstacle.y) * 0.3;
        }
        
        return {
          ...obstacle,
          x: obstacle.x + dx,
          y: obstacle.y + obstacleSpeed
        };
      }).filter(obstacle => obstacle.y < CANVAS_HEIGHT + 100);

      // Add new obstacles at the top with more variety
      while (newObstacles.length < 8) {
        const types: Obstacle['type'][] = ['rock', 'tree', 'cliff'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        // Make obstacle placement smarter - avoid putting them too close together
        const existingPositions = newObstacles
          .filter(o => o.y < 0)
          .map(o => o.x);
        
        let x: number;
        let attempts = 0;
        do {
          x = Math.random() * (CANVAS_WIDTH - 80);
          attempts++;
        } while (
          attempts < 5 &&
          existingPositions.some(pos => Math.abs(pos - x) < 100)
        );
        
        // Vary size based on type and add slight randomness
        const widthVariation = 0.9 + Math.random() * 0.2;
        const heightVariation = 0.9 + Math.random() * 0.2;
        
        newObstacles.push({
          x,
          y: -100 - Math.random() * 50, // Randomize vertical start position
          width: (type === 'cliff' ? 80 : type === 'tree' ? 30 : 40) * widthVariation,
          height: (type === 'cliff' ? 60 : type === 'tree' ? 50 : 30) * heightVariation,
          type
        });
      }

      return newObstacles;
    });

    // Update score and speed with more nuanced progression
    setScore(prev => prev + 1 + Math.floor(speed));
    setAltitude(prev => prev + 0.1 * speed);
    setSpeed(prev => {
      // Speed increases more at lower speeds, less at higher speeds
      const speedIncrease = Math.max(0.0005, 0.002 - prev * 0.0002);
      return Math.min(7, prev + speedIncrease);
    });
  }, [gameOver, paused, speed, player.vy]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Enhanced collision detection with variable hitboxes
    // Make collisions more forgiving at low speeds, stricter at high speeds
    const collisionMargin = Math.max(5, 10 - player.speed * 0.5);
    
    const collision = obstacles.some(obstacle => {
      // Adjust hitbox based on obstacle type
      const obstacleMargin = obstacle.type === 'cliff' ? 0.1 : 0.2;
      
      const carLeft = player.x - (CAR_WIDTH / 2) + collisionMargin;
      const carRight = player.x + (CAR_WIDTH / 2) - collisionMargin;
      const carTop = player.y - (CAR_HEIGHT / 2) + collisionMargin;
      const carBottom = player.y + (CAR_HEIGHT / 2) - collisionMargin;
      
      const obsLeft = obstacle.x + obstacle.width * obstacleMargin;
      const obsRight = obstacle.x + obstacle.width * (1 - obstacleMargin);
      const obsTop = obstacle.y + obstacle.height * obstacleMargin;
      const obsBottom = obstacle.y + obstacle.height * (1 - obstacleMargin);
      
      return !(
        carRight < obsLeft ||
        carLeft > obsRight ||
        carBottom < obsTop ||
        carTop > obsBottom
      );
    });

    if (collision) {
      setGameOver(true);
      if (onScoreUpdate) {
        // More rewarding scoring system
        const altitudeBonus = Math.floor(altitude * 15);
        const speedBonus = Math.floor(speed * 20);
        const finalScore = Math.floor(score + altitudeBonus + speedBonus);
        onScoreUpdate(finalScore);
      }
    }
  }, [obstacles, player, gameOver, paused, score, altitude, speed, onScoreUpdate]);

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

  // Prevent keys from getting "stuck" when window loses focus
  useEffect(() => {
    const handleBlur = () => {
      setKeys(new Set());
    };
    
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Replace interval-based game loop with requestAnimationFrame for better performance
  useEffect(() => {
    let frameId: number;
    let lastTime = 0;
    const FPS = 60;
    const frameTime = 1000 / FPS;
    let deltaTime = 0;
    
    const gameLoop = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      deltaTime += timestamp - lastTime;
      lastTime = timestamp;
      
      // Update with fixed time step for consistent physics
      while (deltaTime >= frameTime) {
        updatePlayer();
        updateObstacles();
        checkCollisions();
        deltaTime -= frameTime;
      }
      
      frameId = requestAnimationFrame(gameLoop);
    };
    
    frameId = requestAnimationFrame(gameLoop);
    
    return () => cancelAnimationFrame(frameId);
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