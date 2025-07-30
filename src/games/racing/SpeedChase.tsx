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
  invulnerable: number; // Invulnerability timer after respawning
}

interface PoliceCar extends Position {
  vx: number;
  vy: number;
  speed: number;
  active: boolean;
  siren: boolean; // For visual effect
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
    nitro: 100,
    invulnerable: 0
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
  const [frameCount, setFrameCount] = useState(0);

  // Lane positions with better spacing for clearer road lanes
  const lanePositions = [150, 225, 300, 375, 450];

  // Create police car with dynamic difficulty based on wanted level
  const createPoliceCar = useCallback(() => {
    // Higher chance to spawn police as wanted level increases
    const spawnChance = 0.005 + (wantedLevel * 0.005);
    
    if (Math.random() < spawnChance) {
      // Choose a spawn position avoiding direct collisions
      const safeLanes = lanePositions.filter(lane => {
        const safeDistance = 80;
        return !policeCars.some(car => 
          Math.abs(car.x - lane) < safeDistance && car.y < 0
        );
      });
      
      // If no safe lane, don't spawn
      if (safeLanes.length === 0) return;
      
      const laneIndex = Math.floor(Math.random() * safeLanes.length);
      const lane = safeLanes[laneIndex];
      
      // Police gets faster based on wanted level
      const policeSpeed = baseSpeed + 1 + (wantedLevel * 0.5) + (Math.random() * 0.5);
      
      setPoliceCars(prev => [...prev, {
        x: lane,
        y: -CAR_HEIGHT - Math.random() * 100, // Randomize spawn height
        vx: 0,
        vy: policeSpeed,
        speed: policeSpeed,
        active: true,
        siren: false
      }]);
    }
  }, [wantedLevel, baseSpeed, lanePositions, policeCars]);

  // Create traffic car with safer spawning logic
  const createTrafficCar = useCallback(() => {
    // Adjust spawn rate based on wanted level
    const spawnChance = 0.015 + (Math.random() * 0.01);
    
    if (Math.random() < spawnChance) {
      // Avoid spawning too close to other cars
      const safeLanes = lanePositions.filter(lane => {
        const safeDistance = 70;
        return !trafficCars.some(car => 
          Math.abs(car.x - lane) < safeDistance && car.y < 0
        );
      });
      
      // If no safe lane, don't spawn
      if (safeLanes.length === 0) return;
      
      const laneIndex = Math.floor(Math.random() * safeLanes.length);
      const lane = safeLanes[laneIndex];
      
      const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      // Traffic cars move at different speeds
      const trafficSpeed = baseSpeed - 1 + (Math.random() * 1.5);
      
      setTrafficCars(prev => [...prev, {
        x: lane,
        y: -CAR_HEIGHT - Math.random() * 50,
        vy: trafficSpeed,
        lane: laneIndex,
        color: randomColor
      }]);
    }
  }, [baseSpeed, lanePositions, trafficCars]);

  // Improved player movement with better physics
  const updatePlayer = useCallback(() => {
    if (gameOver || paused) return;

    setPlayer(prev => {
      let newVx = prev.vx;
      let newVy = prev.vy;
      let newNitro = prev.nitro;
      const newInvulnerable = Math.max(0, prev.invulnerable - 1);

      // Steering with better response
      const steeringForce = 0.5; // Increased steering responsiveness
      if (keys.has('ArrowLeft')) {
        newVx = Math.max(-7, newVx - steeringForce);
      } else if (keys.has('ArrowRight')) {
        newVx = Math.min(7, newVx + steeringForce);
      } else {
        // Gradual auto-centering
        newVx *= 0.9; // Faster auto-centering
      }

      // Acceleration and braking with better feel
      if (keys.has('ArrowUp')) {
        // Accelerate with a curve that flattens at higher speeds
        const accelerationFactor = Math.max(0.15, 0.5 - Math.abs(newVy) * 0.02);
        newVy = Math.max(-15, newVy - accelerationFactor);
      } else if (keys.has('ArrowDown')) {
        // Strong braking
        newVy = Math.min(2, newVy + 1.0);
      } else {
        // Gradual deceleration
        newVy *= 0.97; // Slower deceleration for smoother gameplay
      }

      // Nitro boost with cooldown mechanics
      if (keys.has(' ') && newNitro > 0) {
        // Powerful but costly boost
        newVy = Math.max(-20, newVy - 1.2);
        newNitro = Math.max(0, newNitro - 1.5); // Reduced nitro consumption rate
      } else if (newNitro < 100) {
        // Nitro regenerates more slowly at higher wanted levels
        const regenRate = 0.3 - (wantedLevel * 0.04);
        newNitro = Math.min(100, newNitro + regenRate);
      }

      // Calculate new position with improved movement
      let newX = prev.x + newVx;
      let newY = prev.y + newVy;

      // Keep on road with bounce effect
      if (newX < 120) {
        newX = 120;
        newVx *= -0.4; // Bounce back
      } else if (newX > 530) {
        newX = 530;
        newVx *= -0.4; // Bounce back
      }

      // Keep in viewport with boundary constraints
      newY = Math.max(40, Math.min(CANVAS_HEIGHT - 60, newY));

      // Calculate speed for score and effects
      const newSpeed = Math.sqrt(newVx * newVx + newVy * newVy);

      return {
        x: newX,
        y: newY,
        vx: newVx,
        vy: newVy,
        speed: newSpeed,
        nitro: newNitro,
        invulnerable: newInvulnerable
      };
    });
  }, [keys, gameOver, paused, wantedLevel]);

  // Improved police AI with better chase mechanics
  const updatePoliceCars = useCallback(() => {
    if (gameOver || paused) return;
    
    setFrameCount(prev => prev + 1);
    
    setPoliceCars(prev => 
      prev.map(car => {
        if (!car.active) return car;

        // Smarter AI for police
        let newVx = car.vx;
        const dx = player.x - car.x;
        
        // Police gets smarter with higher wanted levels, but not too aggressive at low levels
        const aiResponsiveness = 0.005 + (wantedLevel * 0.003);
        
        // Target prediction based on player velocity with look-ahead
        const predictX = player.x + (player.vx * (15 - wantedLevel)); // Better prediction at lower wanted levels
        const targetDx = predictX - car.x;
        
        // AI steering that feels more intelligent
        newVx += targetDx * aiResponsiveness;
        newVx = Math.max(-5, Math.min(5, newVx));
        
        // Add slight randomness to movement for more natural behavior
        if (Math.random() < 0.03) {
          newVx += (Math.random() - 0.5) * 0.4;
        }

        // Adjust y-speed based on distance to player (catch up when far behind)
        let newVy = car.vy;
        const dy = player.y - car.y;
        if (dy > 150) {
          // Speed up to catch the player if far behind
          newVy = Math.min(car.vy + 0.05, baseSpeed + 2 + (wantedLevel * 0.5));
        } else if (dy < -50) {
          // Slow down if getting too close to avoid constant collisions
          newVy = Math.max(car.vy - 0.05, baseSpeed);
        }

        // Update position
        const newX = car.x + newVx;
        const newY = car.y + newVy;
        
        // Keep police on the road
        const constrainedX = Math.max(120, Math.min(530, newX));

        // Toggle siren effect every few frames
        const newSiren = (frameCount % 20 < 10);
        
        return {
          ...car,
          x: constrainedX,
          y: newY,
          vx: newVx,
          vy: newVy,
          speed: Math.sqrt(newVx * newVx + newVy * newVy),
          siren: newSiren,
          active: newY < CANVAS_HEIGHT + CAR_HEIGHT * 2
        };
      }).filter(car => car.active)
    );

    // Create new police cars with proper timing
    createPoliceCar();
  }, [gameOver, paused, player.x, player.y, player.vx, createPoliceCar, wantedLevel, frameCount, baseSpeed]);

  // Improved traffic car movement
  const updateTrafficCars = useCallback(() => {
    if (gameOver || paused) return;

    setTrafficCars(prev => 
      prev.map(car => {
        // Apply slight lane correction to keep cars aligned
        let newX = car.x;
        const targetX = lanePositions[car.lane];
        const laneOffset = targetX - car.x;
        
        if (Math.abs(laneOffset) > 1) {
          newX += laneOffset * 0.05;
        }
        
        // Occasional random lane change to make traffic more dynamic
        if (Math.random() < 0.002) {
          const direction = Math.random() < 0.5 ? -1 : 1;
          const newLane = Math.min(
            lanePositions.length - 1, 
            Math.max(0, car.lane + direction)
          );
          return {
            ...car,
            x: newX,
            y: car.y + car.vy,
            lane: newLane
          };
        }
        
        return {
          ...car,
          x: newX,
          y: car.y + car.vy
        };
      }).filter(car => car.y < CANVAS_HEIGHT + CAR_HEIGHT * 2)
    );

    // Create new traffic
    createTrafficCar();
  }, [gameOver, paused, createTrafficCar, lanePositions]);

  // Game progression and difficulty scaling
  const updateGame = useCallback(() => {
    if (gameOver || paused) return;

    // Update score based on speed and distance
    const speedFactor = Math.max(0, -player.vy) / 3;
    setScore(prev => prev + Math.floor(speedFactor) + 1);
    
    // Distance increases based on player speed
    const distanceFactor = Math.max(0, -player.vy) * 0.01;
    setDistance(prev => prev + distanceFactor);

    // Wanted level increases with distance but can decrease if player evades police
    const newWantedLevel = Math.min(5, Math.floor(distance / 80) + 1);
    
    // If player is going very fast and no police nearby, wanted level can decrease
    const policeNearby = policeCars.some(car => 
      Math.abs(car.y - player.y) < 200 && Math.abs(car.x - player.x) < 150
    );
    
    if (newWantedLevel < wantedLevel && !policeNearby && Math.random() < 0.01) {
      setWantedLevel(prev => Math.max(1, prev - 1));
    } else if (newWantedLevel > wantedLevel) {
      setWantedLevel(newWantedLevel);
    }

    // Base speed increases gradually with distance/wanted level
    setBaseSpeed(3.5 + wantedLevel * 0.4);
    
  }, [gameOver, paused, player.vy, distance, wantedLevel, policeCars]);

  // Improved collision detection with invulnerability periods
  const checkCollisions = useCallback(() => {
    if (gameOver || paused || player.invulnerable > 0) return;

    // Use smaller hitbox for more forgiving collisions
    const playerHitbox = {
      x: player.x - CAR_WIDTH * 0.3, // Smaller hitbox
      y: player.y - CAR_HEIGHT * 0.3,
      width: CAR_WIDTH * 0.6,
      height: CAR_HEIGHT * 0.6
    };

    // Check collision with police cars - more forgiving
    const policeHit = policeCars.some(car =>
      car.active &&
      playerHitbox.x < car.x + CAR_WIDTH * 0.7 &&
      playerHitbox.x + playerHitbox.width > car.x - CAR_WIDTH * 0.2 &&
      playerHitbox.y < car.y + CAR_HEIGHT * 0.7 &&
      playerHitbox.y + playerHitbox.height > car.y - CAR_HEIGHT * 0.2
    );

    // Check collision with traffic - more forgiving
    const trafficHit = trafficCars.some(car =>
      playerHitbox.x < car.x + CAR_WIDTH * 0.7 &&
      playerHitbox.x + playerHitbox.width > car.x - CAR_WIDTH * 0.2 &&
      playerHitbox.y < car.y + CAR_HEIGHT * 0.7 &&
      playerHitbox.y + playerHitbox.height > car.y - CAR_HEIGHT * 0.2
    );

    if (policeHit || trafficHit) {
      // At high wanted levels, collisions end the game only if player is going very fast
      if ((wantedLevel >= 4 && player.speed > 10) || player.speed > 15) {
        setGameOver(true);
        if (onScoreUpdate) {
          onScoreUpdate(score);
        }
      } else {
        // At lower levels, player gets a second chance with temporary invulnerability
        setPlayer(prev => ({
          ...prev,
          vx: prev.vx * -0.3, // Bounce effect
          vy: prev.vy * -0.3,
          invulnerable: 90 // 1.5 seconds invulnerability (90 frames)
        }));
        
        // Penalty for collision
        setScore(prev => Math.max(0, prev - 30)); // Reduced penalty
      }
    }
  }, [policeCars, trafficCars, player, gameOver, paused, score, onScoreUpdate, wantedLevel]);

  // Reset the game to initial state
  const resetGame = () => {
    setPlayer({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 80,
      vx: 0,
      vy: 0,
      speed: 0,
      nitro: 100,
      invulnerable: 0
    });
    setPoliceCars([]);
    setTrafficCars([]);
    setScore(0);
    setDistance(0);
    setWantedLevel(1);
    setBaseSpeed(4);
    setGameOver(false);
    setPaused(false);
    setFrameCount(0);
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
    // Use requestAnimationFrame for smoother game loop
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
          updatePlayer();
          updatePoliceCars();
          updateTrafficCars();
          updateGame();
          checkCollisions();
        }
        deltaTime -= frameTime;
      }
      
      frameId = requestAnimationFrame(gameLoop);
    };
    
    frameId = requestAnimationFrame(gameLoop);
    
    return () => cancelAnimationFrame(frameId);
  }, [updatePlayer, updatePoliceCars, updateTrafficCars, updateGame, checkCollisions, paused, gameOver]);

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
          {/* Road with perspective effect */}
          <div
            className="absolute bg-gray-700"
            style={{
              left: 100,
              top: 0,
              width: 450,
              height: CANVAS_HEIGHT
            }}
          />

          {/* Lane markings with animated scroll effect */}
          {lanePositions.slice(1, -1).map((lane, index) => (
            <div
              key={index}
              className="absolute bg-yellow-400"
              style={{
                left: lane - 1,
                top: 0,
                width: 2,
                height: CANVAS_HEIGHT,
                backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 20px, #facc15 20px, #facc15 40px)',
                backgroundPosition: `0px ${(frameCount * player.speed * 0.5) % 40}px`
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

          {/* Police cars with siren effect */}
          {policeCars.map((car, index) => (
            <div
              key={`police-${index}`}
              className="absolute rounded"
              style={{
                left: car.x - CAR_WIDTH / 2,
                top: car.y - CAR_HEIGHT / 2,
                width: CAR_WIDTH,
                height: CAR_HEIGHT,
                backgroundColor: 'rgb(30, 64, 175)',
                boxShadow: car.siren ? '0 0 10px rgba(255, 0, 0, 0.7)' : '0 0 10px rgba(0, 0, 255, 0.7)',
                clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 100%, 0% 100%, 0% 30%)'
              }}
            >
              {/* Police light bar */}
              <div 
                className="absolute top-1 left-1/4 right-1/4 h-1 rounded-sm"
                style={{ 
                  backgroundColor: car.siren ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)'
                }}
              ></div>
            </div>
          ))}

          {/* Player car with invulnerability effect */}
          <div
            className={`absolute rounded transition-all duration-100 ${
              player.invulnerable > 0 ? 'animate-pulse opacity-70' :
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
              className="absolute bg-blue-400 opacity-60 rounded animate-pulse"
              style={{
                left: player.x - CAR_WIDTH / 2,
                top: player.y + CAR_HEIGHT / 2,
                width: CAR_WIDTH,
                height: 20 + Math.random() * 5
              }}
            />
          )}
          
          {/* Speed lines effect */}
          {Math.abs(player.vy) > 5 && (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={`speedline-${i}`}
                  className="absolute bg-white opacity-40"
                  style={{
                    left: 100 + Math.random() * 450,
                    top: (player.y + i * 100) % CANVAS_HEIGHT,
                    width: 2,
                    height: 20 + Math.abs(player.vy) * 2
                  }}
                />
              ))}
            </>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Outrun the police! Avoid traffic and use nitro wisely.</p>
          <p className="text-yellow-200 text-xs mt-1">
            Arrow keys to drive, Space for nitro, P/Esc to pause
          </p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font animate-pulse">BUSTED!</div>
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