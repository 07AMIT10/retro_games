import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  width: number;
  height: number;
}

interface RoadRacerProps {
  onScoreUpdate?: (score: number) => void;
}

const RoadRacer: React.FC<RoadRacerProps> = ({ onScoreUpdate }) => {
  // Keep track of the actual lane position as a float for smooth animation
  const [playerLanePosition, setPlayerLanePosition] = useState<number>(1);
  const [player, setPlayer] = useState<Position>({ 
    x: CANVAS_WIDTH / 2 - CAR_WIDTH / 2, 
    y: CANVAS_HEIGHT - 100 
  });
  const [targetLane, setTargetLane] = useState<number>(1); // 0, 1, 2
  const [cars, setCars] = useState<Car[]>([]);
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [laneSwitchCooldown, setLaneSwitchCooldown] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [carSpawnTimer, setCarSpawnTimer] = useState(0);
  const [difficulty, setDifficulty] = useState(1);
  const [invulnerable, setInvulnerable] = useState(0); // Invulnerability after respawn
  
  // Track occupied lanes to avoid spawning cars too close together
  const occupiedLanes = useRef<{ [key: number]: boolean }>({});

  // Enhanced color palette for more distinct cars
  const carColors = [
    '#ff4444', '#44ff44', '#4444ff', '#ffff44', 
    '#ff44ff', '#44ffff', '#f97316', '#8b5cf6'
  ];

  // Improved car spawning with lane blocking logic
  const spawnCar = useCallback(() => {
    // Increase spawn rate with difficulty but keep it manageable
    const baseSpawnChance = 0.015 + (difficulty * 0.005);
    const speedFactor = Math.min(0.01, speed * 0.001);
    
    if (Math.random() < baseSpawnChance + speedFactor) {
      // Find available lanes (not occupied recently)
      const availableLanes = [0, 1, 2].filter(lane => !occupiedLanes.current[lane]);
      
      // If all lanes occupied, choose random
      const lane = availableLanes.length > 0 
        ? availableLanes[Math.floor(Math.random() * availableLanes.length)] 
        : Math.floor(Math.random() * 3);
      
      const roadStart = (CANVAS_WIDTH - ROAD_WIDTH) / 2;
      
      // Randomize car sizes slightly for variety
      const carWidthVariation = CAR_WIDTH * (0.9 + Math.random() * 0.2);
      const carHeightVariation = CAR_HEIGHT * (0.9 + Math.random() * 0.2);
      
      // Car speed varies with game difficulty
      const carSpeed = 2 + Math.random() * difficulty;
      
      const newCar: Car = {
        x: roadStart + lane * LANE_WIDTH + (LANE_WIDTH - carWidthVariation) / 2,
        y: -carHeightVariation - Math.random() * 50, // Randomize spawn position
        lane,
        color: carColors[Math.floor(Math.random() * carColors.length)],
        speed: carSpeed,
        width: carWidthVariation,
        height: carHeightVariation
      };
      
      setCars(prev => [...prev, newCar]);
      
      // Mark lane as occupied temporarily
      occupiedLanes.current[lane] = true;
      setTimeout(() => {
        occupiedLanes.current[lane] = false;
      }, 800 / speed); // Clear occupation after time based on speed
    }
  }, [speed, difficulty]);

  // Smooth lane transition logic
  const updatePlayerPosition = useCallback(() => {
    if (gameOver) return;
    
    const roadStart = (CANVAS_WIDTH - ROAD_WIDTH) / 2;
    
    // Move towards target lane smoothly
    if (Math.abs(playerLanePosition - targetLane) > 0.05) {
      const moveDirection = playerLanePosition < targetLane ? 1 : -1;
      // Speed of lane change increases with game speed
      const transitionSpeed = 0.15 * (1 + speed * 0.05);
      setPlayerLanePosition(prev => prev + moveDirection * transitionSpeed);
    } else {
      setPlayerLanePosition(targetLane);
    }
    
    // Calculate actual x position based on lane position
    const targetX = roadStart + playerLanePosition * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2;
    
    setPlayer(prev => ({
      ...prev,
      x: targetX
    }));
    
    // Reduce lane switch cooldown
    if (laneSwitchCooldown > 0) {
      setLaneSwitchCooldown(prev => prev - 1);
    }
    
    // Reduce invulnerability timer
    if (invulnerable > 0) {
      setInvulnerable(prev => prev - 1);
    }
  }, [gameOver, playerLanePosition, targetLane, speed, laneSwitchCooldown, invulnerable]);

  const updateGame = useCallback(() => {
    if (gameOver || paused) return;

    setFrameCount(prev => prev + 1);
    updatePlayerPosition();
    
    // Spawn car management with timing
    setCarSpawnTimer(prev => {
      if (prev <= 0) {
        spawnCar();
        return Math.floor(30 / difficulty); // Adjust timer based on difficulty
      }
      return prev - 1;
    });

    // Move cars down with varying speeds
    setCars(prevCars => {
      const newCars = prevCars
        .map(car => ({ 
          ...car, 
          // Cars move faster as they get closer to bottom for perspective effect
          // Add slight horizontal variation for more dynamic movement
          x: car.x + (Math.sin(car.y / 100) * 0.3),
          y: car.y + car.speed + speed + (car.y / CANVAS_HEIGHT) * 2
        }))
        .filter(car => car.y < CANVAS_HEIGHT + car.height);

      // Improved collision detection with proper hitboxes
      if (invulnerable <= 0) {
        const collision = newCars.some(car => {
          // More accurate hitbox calculation with variable hitbox size
          // Hitbox size adjusts with difficulty - easier at low levels, harder at high
          const hitboxReduction = Math.max(0.1, 0.3 - (difficulty * 0.05));
          
          const carLeft = car.x + car.width * hitboxReduction;
          const carRight = car.x + car.width * (1 - hitboxReduction);
          const carTop = car.y + car.height * hitboxReduction;
          const carBottom = car.y + car.height * (1 - hitboxReduction);
          
          const playerLeft = player.x + CAR_WIDTH * hitboxReduction;
          const playerRight = player.x + CAR_WIDTH * (1 - hitboxReduction);
          const playerTop = player.y + CAR_HEIGHT * hitboxReduction;
          const playerBottom = player.y + CAR_HEIGHT * (1 - hitboxReduction);
          
          return !(
            playerRight < carLeft ||
            playerLeft > carRight ||
            playerBottom < carTop ||
            playerTop > carBottom
          );
        });

        if (collision) {
          // At higher difficulty levels, crash ends the game
          if (difficulty > 2) {
            setGameOver(true);
            if (onScoreUpdate) {
              // More dynamic score calculation based on distance and difficulty
              const difficultyBonus = difficulty * 50;
              onScoreUpdate(score + difficultyBonus);
            }
          } else {
            // At lower difficulties, give player brief invulnerability
            setInvulnerable(90); // 1.5 seconds
            // Penalty for collision
            setSpeed(prev => Math.max(1, prev * 0.6));
            setScore(prev => Math.max(0, prev - 50 - Math.floor(difficulty * 25)));
          }
        }
      }

      return newCars;
    });

    // Increase score and speed with difficulty scaling
    setScore(prev => {
      const baseIncrease = 1;
      // Bonus points for higher speeds
      const speedBonus = Math.floor(speed * 0.5);
      const newScore = prev + baseIncrease + speedBonus;
      
      // Update difficulty based on score milestones with smoother progression
      if (newScore > 1800 && difficulty < 2) {
        setDifficulty(2);
      } else if (newScore > 4500 && difficulty < 3) {
        setDifficulty(3);
      } else if (newScore > 9000 && difficulty < 4) {
        setDifficulty(4);
      } else if (newScore > 15000 && difficulty < 5) {
        setDifficulty(5);
      }
      
      // Speed increases gradually but caps at reasonable level
      // More nuanced speed progression curve
      setSpeed(prev => {
        const targetSpeed = Math.min(9, 2 + Math.floor(newScore / 500) * 0.5);
        // Smooth speed transitions
        return prev + (targetSpeed - prev) * 0.03;
      });
      
      return newScore;
    });
  }, [gameOver, paused, updatePlayerPosition, spawnCar, difficulty, player, invulnerable, speed, score, onScoreUpdate]);

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

  // Improved keyboard handling with cooldown for lane switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only prevent default for game controls
      if (['ArrowLeft', 'ArrowRight', ' ', 'p', 'P', 'Escape'].includes(e.key)) {
        e.preventDefault();
      }
      
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        setPaused(prev => !prev);
        return;
      }
      
      setKeys(prev => new Set(prev).add(e.key));
      
      if (gameOver || paused || laneSwitchCooldown > 0) return;

      // Lane switching with cooldown
      switch (e.key) {
        case 'ArrowLeft':
          if (targetLane > 0) {
            setTargetLane(prev => prev - 1);
            setLaneSwitchCooldown(8); // Prevent rapid lane changes
          }
          break;
        case 'ArrowRight':
          if (targetLane < 2) {
            setTargetLane(prev => prev + 1);
            setLaneSwitchCooldown(8); // Prevent rapid lane changes
          }
          break;
        case ' ':
          // Space now acts as brake instead of pause
          setSpeed(prev => Math.max(1, prev * 0.5));
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
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
  }, [gameOver, paused, targetLane, laneSwitchCooldown]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">SCORE: {score}</div>
            <div className="text-sm">SPEED: {speed.toFixed(1)} | LEVEL: {difficulty}</div>
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
          {/* Road with animated stripes */}
          <div 
            className="absolute bg-gray-700 border-x-4 border-yellow-400"
            style={{
              left: (CANVAS_WIDTH - ROAD_WIDTH) / 2,
              top: 0,
              width: ROAD_WIDTH,
              height: CANVAS_HEIGHT
            }}
          >
            {/* Lane dividers with animated movement */}
            {[1, 2].map(lane => (
              <div
                key={lane}
                className="absolute bg-yellow-400"
                style={{
                  left: lane * LANE_WIDTH - 1,
                  top: 0,
                  width: 2,
                  height: CANVAS_HEIGHT,
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 20px, #facc15 20px, #facc15 40px)',
                  backgroundPosition: `0px ${(frameCount * speed * 0.8) % 40}px`
                }}
              />
            ))}
          </div>

          {/* Player car with visual indicators for state */}
          <div
            className={`absolute rounded transition-transform duration-150 ${
              invulnerable > 0 ? 'animate-pulse opacity-70' : 'opacity-100'
            }`}
            style={{
              left: player.x,
              top: player.y,
              width: CAR_WIDTH,
              height: CAR_HEIGHT,
              backgroundColor: invulnerable > 0 ? '#f87171' : '#22d3ee',
              clipPath: 'polygon(30% 0%, 70% 0%, 100% 20%, 100% 100%, 0% 100%, 0% 20%)',
              transform: `rotate(${(playerLanePosition - targetLane) * -5}deg)` // Tilt car during lane changes
            }}
          >
            {/* Headlights */}
            <div className="absolute left-2 bottom-0 w-2 h-2 bg-yellow-200 rounded-full"></div>
            <div className="absolute right-2 bottom-0 w-2 h-2 bg-yellow-200 rounded-full"></div>
            
            {/* Brake lights (show when braking) */}
            {keys.has(' ') && (
              <>
                <div className="absolute left-2 top-2 w-2 h-2 bg-red-500 rounded-full"></div>
                <div className="absolute right-2 top-2 w-2 h-2 bg-red-500 rounded-full"></div>
              </>
            )}
          </div>

          {/* Traffic cars with improved visuals */}
          {cars.map((car, index) => (
            <div
              key={index}
              className="absolute rounded"
              style={{
                left: car.x,
                top: car.y,
                width: car.width,
                height: car.height,
                backgroundColor: car.color,
                clipPath: 'polygon(30% 0%, 70% 0%, 100% 20%, 100% 100%, 0% 100%, 0% 20%)'
              }}
            >
              {/* Add simple details to traffic cars */}
              <div className="absolute left-1/4 top-1/2 w-1/2 h-1 bg-gray-800"></div>
              <div className="absolute left-1/3 top-1/4 w-1/3 h-1 bg-gray-800"></div>
            </div>
          ))}

          {/* Speed lines effect - more visible at higher speeds */}
          {!paused && !gameOver && (
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 5 + Math.floor(speed) }).map((_, i) => (
                <div
                  key={i}
                  className="absolute bg-white opacity-30"
                  style={{
                    left: Math.random() * CANVAS_WIDTH,
                    top: (i * CANVAS_HEIGHT / (5 + Math.floor(speed))) % CANVAS_HEIGHT,
                    width: 1 + Math.random() * 2,
                    height: 20 + speed * 3,
                    animation: `fall ${0.8 / speed}s linear infinite`
                  }}
                />
              ))}
            </div>
          )}
          
          {/* Invulnerability indicator */}
          {invulnerable > 0 && (
            <div className="absolute top-4 left-0 right-0 text-center text-yellow-300 font-bold">
              INVULNERABLE
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <div className="grid grid-cols-2 gap-4 mb-2">
            <p><strong>←→</strong> Change Lane</p>
            <p><strong>Space</strong> Brake</p>
          </div>
          <p className="text-yellow-400 mb-1">Avoid traffic and survive as long as possible!</p>
          <p className="text-xs text-green-300">Press P/Esc to pause</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font animate-pulse">GAME OVER!</div>
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