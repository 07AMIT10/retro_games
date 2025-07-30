import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface F1RacingProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CAR_WIDTH = 25;
const CAR_HEIGHT = 40;
const TRACK_WIDTH = 400;

interface Position {
  x: number;
  y: number;
}

interface Car extends Position {
  angle: number;
  speed: number;
  lap: number;
  lapTime: number;
  totalTime: number;
  fuel: number;
  tire: number;
  lapProgress: number; // Track progress around the lap
}

interface Competitor extends Position {
  angle: number;
  speed: number;
  lap: number;
  lapProgress: number; // Track progress around the lap
  color: string;
  aiSkill: number; // Affects racing line and speed
}

const F1Racing: React.FC<F1RacingProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Car>({
    x: CANVAS_WIDTH / 2 + 150,
    y: CANVAS_HEIGHT / 2,
    angle: 0,
    speed: 0,
    lap: 0,
    lapTime: 0,
    totalTime: 0,
    fuel: 100,
    tire: 100,
    lapProgress: 0
  });
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [raceComplete, setRaceComplete] = useState(false);
  const [position, setPosition] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [boost, setBoost] = useState(false);
  const [boostCooldown, setBoostCooldown] = useState(0);
  const [raceStarted, setRaceStarted] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [lapTimes, setLapTimes] = useState<number[]>([]);
  const [bestLap, setBestLap] = useState<number | null>(null);
  const [pitStop, setPitStop] = useState(false);
  const [lastLapProgress, setLastLapProgress] = useState(0);
  
  // Track the frame count for animations
  const frameCount = useRef(0);
  
  // Race stats
  const totalLaps = 3;
  
  // Track properties
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const trackOuterRadius = 240;
  const trackInnerRadius = 140;
  const trackWidth = trackOuterRadius - trackInnerRadius;
  
  // Racing line - optimal path around track (slightly offset from center)
  const racingLine = {
    radius: trackInnerRadius + trackWidth * 0.6,
    offset: { x: 15, y: -10 }  // Slight offset for more realistic racing line
  };

  // Create competitors with varying skills
  const createCompetitors = useCallback(() => {
    const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff'];
    return colors.map((color, i) => {
      // Each competitor has a different starting position and skill level
      const startingOffset = (i * Math.PI) / 3;
      const aiSkill = 0.7 + Math.random() * 0.5; // AI skill between 0.7 and 1.2
      
      return {
        x: centerX + racingLine.radius * Math.cos(startingOffset),
        y: centerY + racingLine.radius * Math.sin(startingOffset),
        angle: startingOffset,
        speed: 2 + Math.random() * 3 * aiSkill,
        lap: 0,
        lapProgress: 0,
        color,
        aiSkill
      };
    });
  }, [centerX, centerY, racingLine.radius]);

  // Improved track collision detection with margin
  const isOnTrack = (x: number, y: number): boolean => {
    const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    // Give slight margin to make the game more forgiving
    const outerMargin = 15;
    const innerMargin = 5;
    return distFromCenter >= trackInnerRadius - innerMargin && 
           distFromCenter <= trackOuterRadius + outerMargin;
  };

  // Get lap progress for more accurate position calculation
  const getCurrentLapInfo = (x: number, y: number, prevAngle: number, prevProgress: number): 
    { lap: number; progress: number } => {
    const angle = Math.atan2(y - centerY, x - centerX);
    const normalizedAngle = (angle + Math.PI * 2) % (Math.PI * 2);
    const prevNormalizedAngle = (prevAngle + Math.PI * 2) % (Math.PI * 2);
    
    let lapChange = 0;
    let progress = normalizedAngle / (Math.PI * 2);
    
    // Detect lap completion (crossing start/finish line)
    if (prevNormalizedAngle > Math.PI * 1.5 && normalizedAngle < Math.PI * 0.5) {
      lapChange = 1;
      
      // Record lap time when player completes a lap
      if (raceStarted && !pitStop) {
        setLapTimes(prev => {
          const newLapTime = player.lapTime;
          const newLapTimes = [...prev, newLapTime];
          
          // Update best lap
          if (bestLap === null || newLapTime < bestLap) {
            setBestLap(newLapTime);
          }
          
          return newLapTimes;
        });
      }
    }
    
    // Make progress calculation smoother for position tracking
    if (Math.abs(progress - prevProgress) > 0.5) {
      // We're crossing the 0/360 boundary - adjust for continuity
      if (progress < 0.5) {
        progress += 1;
      } else {
        progress = 0;
      }
    }
    
    return {
      lap: lapChange,
      progress: progress
    };
  };
  
  // Pit stop logic
  const handlePitStop = (newX: number, newY: number, currentAngle: number): boolean => {
    // Pit entry is near the start line
    const pitEntryAngle = Math.PI * 1.85;
    const pitExitAngle = Math.PI * 0.1;
    
    const normalizedAngle = (currentAngle + Math.PI * 2) % (Math.PI * 2);
    
    // Distance from inner edge - check if in pit lane
    const distFromCenter = Math.sqrt((newX - centerX) ** 2 + (newY - centerY) ** 2);
    const isInPitLane = distFromCenter < trackInnerRadius + 20;
    
    if (isInPitLane) {
      if (!pitStop && normalizedAngle > pitEntryAngle) {
        // Entering pit
        setPitStop(true);
        return true;
      } else if (pitStop && normalizedAngle < pitExitAngle) {
        // Exiting pit with full fuel and tires
        setPitStop(false);
        return false;
      }
      return pitStop;
    }
    return false;
  };

  // Enhanced update logic with better physics
  const updatePlayer = useCallback(() => {
    // Update frame counter
    frameCount.current = (frameCount.current + 1) % 1000;
    
    if (gameOver || paused) return;
    
    // Handle countdown at start
    if (countdown > 0) return;
    if (!raceStarted && countdown === 0) {
      setRaceStarted(true);
    }
    
    if (raceComplete) return;

    setPlayer(prev => {
      let newSpeed = prev.speed;
      let newAngle = prev.angle;
      let newFuel = prev.fuel;
      let newTire = prev.tire;
      let inPitStop = pitStop;

      // Speed factor for more realistic handling based on tire condition
      const tireGripFactor = Math.max(0.4, prev.tire / 100); // Improved minimum grip
      
      // Acceleration/Deceleration with improved responsiveness
      if (keys.has('ArrowUp')) {
        // Progressive acceleration curve that feels more satisfying
        const accelerationFactor = prev.fuel > 0 ? 
          0.25 * (1 - Math.min(0.6, prev.speed / 10)) : 0.1;
        newSpeed = Math.min(8.5, prev.speed + accelerationFactor * tireGripFactor);
        // More realistic fuel consumption
        newFuel = Math.max(0, prev.fuel - (0.04 + (prev.speed / 18))); 
      } else if (keys.has('ArrowDown')) {
        // Better braking that's more responsive
        const brakingPower = 0.45;
        newSpeed = Math.max(-3, prev.speed - brakingPower);
      } else {
        // Natural deceleration varies by surface
        const decelRate = pitStop ? 0.05 : 0.025; // Smoother deceleration
        newSpeed = prev.speed * (1 - decelRate); 
      }

      // Steering with improved physics - harder to turn at higher speeds but still responsive
      if (Math.abs(newSpeed) > 0.5) {
        // More precise steering control
        const baseSteeringFactor = 0.045 * tireGripFactor;
        // Better curve for steering response at different speeds
        const speedFactor = Math.min(1, 9 / Math.max(1, Math.abs(newSpeed) + 1)); 
        
        if (keys.has('ArrowLeft')) {
          newAngle -= baseSteeringFactor * speedFactor * (newSpeed > 0 ? 1 : -0.5);
        }
        if (keys.has('ArrowRight')) {
          newAngle += baseSteeringFactor * speedFactor * (newSpeed > 0 ? 1 : -0.5);
        }
      }

      // Improved boost with cooldown and fuel cost
      if (keys.has(' ') && !boost && boostCooldown <= 0 && newFuel > 10) {
        setBoost(true);
        setBoostCooldown(150); // 2.5 seconds cooldown (reduced for better gameplay)
        newSpeed = Math.min(12, newSpeed + 4);
        newFuel = Math.max(0, newFuel - 12); // Lower fuel cost for better balance
        // Auto-disable boost after 1 second
        setTimeout(() => setBoost(false), 1000);
      }

      // Calculate new position
      const newX = prev.x + Math.cos(newAngle) * newSpeed;
      const newY = prev.y + Math.sin(newAngle) * newSpeed;

      // Check pit stop status
      if (raceStarted) {
        inPitStop = handlePitStop(newX, newY, newAngle);
        
        // Refuel and change tires in pit with improved rates
        if (inPitStop) {
          if (newSpeed < 2.5) { // More forgiving speed threshold
            newFuel = Math.min(100, newFuel + 1.2); // Faster refueling
            newTire = Math.min(100, newTire + 1); // Faster tire change
            newSpeed = Math.min(2.5, newSpeed); // Higher speed limit in pit
          } else {
            // More gradual slowdown in pit lane
            newSpeed *= 0.92;
          }
        }
      }

      // Check if on track with more forgiving boundaries
      if (!isOnTrack(newX, newY) && !inPitStop) {
        // Off track - reduce speed and increase tire wear
        newSpeed *= 0.7; // Less harsh slowdown
        newTire = Math.max(0, newTire - 0.6); // Reduced tire wear
      } else if (!inPitStop) {
        // Normal tire wear based on speed and steering with better balance
        const steeringWear = keys.has('ArrowLeft') || keys.has('ArrowRight') ? 0.015 : 0;
        const speedWear = Math.min(0.025, prev.speed * 0.003);
        newTire = Math.max(0, newTire - (speedWear + steeringWear));
      }

      // Get lap info and track progress
      const lapInfo = getCurrentLapInfo(newX, newY, prev.angle, prev.lapProgress);
      setLastLapProgress(lapInfo.progress);
      
      const newLap = prev.lap + lapInfo.lap;
      let newLapTime = prev.lapTime + 1/60;
      const newTotalTime = prev.totalTime + 1/60;

      if (lapInfo.lap > 0 && raceStarted) {
        // Reset lap timer on new lap
        newLapTime = 0;
        
        // Check race completion
        if (newLap >= totalLaps) {
          setRaceComplete(true);
          if (onScoreUpdate) {
            // Score based on time, position and best lap with improved scoring
            const positionBonus = (6 - position) * 150;
            const timeBonus = Math.max(0, 2500 - Math.floor(newTotalTime * 4));
            const score = positionBonus + timeBonus;
            onScoreUpdate(score);
          }
        }
      }

      // Performance effects based on car condition - more forgiving
      if (newFuel <= 0) {
        newSpeed *= 0.6; // Less severe reduction when out of fuel
      }
      if (newTire <= 0) {
        newSpeed *= 0.4; // Less severe reduction with worn tires
      }

      return {
        x: newX,
        y: newY,
        angle: newAngle,
        speed: newSpeed,
        lap: newLap,
        lapTime: newLapTime,
        totalTime: raceStarted ? newTotalTime : 0,
        fuel: newFuel,
        tire: newTire,
        lapProgress: lapInfo.progress
      };
    });

    // Update boost cooldown
    if (boostCooldown > 0) {
      setBoostCooldown(prev => prev - 1);
    }
  }, [keys, gameOver, paused, raceComplete, boost, boostCooldown, 
      centerX, centerY, onScoreUpdate, position, totalLaps, 
      countdown, raceStarted, pitStop]);

  // Improved AI competitor behavior
  const updateCompetitors = useCallback(() => {
    if (gameOver || paused || raceComplete || countdown > 0) return;

    setCompetitors(prev => prev.map(competitor => {
      // Racing line calculation for more realistic competitor movement
      const idealRadius = racingLine.radius * (0.95 + Math.random() * 0.1);
      const targetAngle = competitor.angle + (competitor.speed / 80);
      
      // Calculate position on racing line
      const targetX = centerX + racingLine.offset.x + idealRadius * Math.cos(targetAngle);
      const targetY = centerY + racingLine.offset.y + idealRadius * Math.sin(targetAngle);
      
      // Get lap progress for this competitor
      const lapInfo = getCurrentLapInfo(
        targetX, targetY, competitor.angle, competitor.lapProgress
      );
      
      const newLap = competitor.lap + lapInfo.lap;
      
      // Speed adjustments based on AI skill and race conditions
      let newSpeed = competitor.speed;
      
      // Competitors get faster in later laps
      const lapMultiplier = 1 + (newLap * 0.1);
      
      // Random speed variations for more natural racing
      if (Math.random() < 0.05) {
        const variation = (Math.random() - 0.5) * 0.3;
        newSpeed = Math.max(2, Math.min(8, competitor.speed + variation));
      }
      
      // Skill-based speed with randomness
      newSpeed = newSpeed * (0.98 + (Math.random() * 0.04)) * lapMultiplier;
      
      // Limit maximum speed
      newSpeed = Math.min(9, newSpeed);
      
      // Race leader might be slightly faster
      if (newLap >= player.lap && lapInfo.progress > player.lapProgress) {
        newSpeed *= 1.02;
      }

      return {
        ...competitor,
        x: targetX,
        y: targetY,
        angle: targetAngle,
        speed: newSpeed,
        lap: newLap,
        lapProgress: lapInfo.progress
      };
    }));

    // Calculate positions for all cars with improved accuracy
    const allCars = [
      { 
        lap: player.lap, 
        progress: player.lapProgress,
        totalTime: player.totalTime, 
        isPlayer: true 
      },
      ...competitors.map(comp => ({ 
        lap: comp.lap, 
        progress: comp.lapProgress,
        totalTime: 0, 
        isPlayer: false 
      }))
    ];
    
    // Sort by lap, then progress within lap
    allCars.sort((a, b) => {
      if (a.lap !== b.lap) return b.lap - a.lap;
      return b.progress - a.progress;
    });
    
    const playerPosition = allCars.findIndex(car => car.isPlayer) + 1;
    setPosition(playerPosition);
    
  }, [competitors, player, gameOver, paused, raceComplete, 
      centerX, centerY, countdown, racingLine]);

  // Reset the game completely
  const resetGame = () => {
    setPlayer({
      x: CANVAS_WIDTH / 2 + 150,
      y: CANVAS_HEIGHT / 2,
      angle: 0,
      speed: 0,
      lap: 0,
      lapTime: 0,
      totalTime: 0,
      fuel: 100,
      tire: 100,
      lapProgress: 0
    });
    setCompetitors(createCompetitors());
    setRaceComplete(false);
    setRaceStarted(false);
    setCountdown(3);
    setPosition(1);
    setBoost(false);
    setBoostCooldown(0);
    setGameOver(false);
    setPaused(false);
    setLapTimes([]);
    setBestLap(null);
    setPitStop(false);
    setLastLapProgress(0);
    frameCount.current = 0;
  };

  // Initialize competitors
  useEffect(() => {
    if (competitors.length === 0) {
      setCompetitors(createCompetitors());
    }
  }, [competitors.length, createCompetitors]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0 && !paused) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, paused]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only prevent default for game controls to allow F12, etc.
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

  // Improved game loop using requestAnimationFrame
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
        updateCompetitors();
        deltaTime -= frameTime;
      }
      
      frameId = requestAnimationFrame(gameLoop);
    };
    
    frameId = requestAnimationFrame(gameLoop);
    
    return () => cancelAnimationFrame(frameId);
  }, [updatePlayer, updateCompetitors]);

  // Format time display (mm:ss.ms)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">F1 RACING</div>
            <div className="text-sm">Position: {position}/6 | Lap: {player.lap + 1}/{totalLaps}</div>
            <div className="text-sm">
              Time: {formatTime(player.totalTime)}
              {bestLap !== null && ` | Best: ${formatTime(bestLap)}`}
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPaused(!paused)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded border border-cyan-400"
              disabled={gameOver || raceComplete}
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

        {/* Status bars */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-800 border border-cyan-400 rounded p-2">
            <div className="text-cyan-400 text-xs retro-font mb-1">
              FUEL {pitStop && <span className="text-green-300 animate-pulse">REFUELING</span>}
            </div>
            <div className="w-full h-2 bg-gray-600 border border-gray-500 rounded">
              <div
                className={`h-full rounded transition-all duration-200 ${
                  player.fuel > 50 ? 'bg-green-400' : 
                  player.fuel > 20 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${player.fuel}%` }}
              />
            </div>
          </div>
          
          <div className="bg-gray-800 border border-cyan-400 rounded p-2">
            <div className="text-cyan-400 text-xs retro-font mb-1">
              TIRES {pitStop && <span className="text-green-300 animate-pulse">CHANGING</span>}
            </div>
            <div className="w-full h-2 bg-gray-600 border border-gray-500 rounded">
              <div
                className={`h-full rounded transition-all duration-200 ${
                  player.tire > 50 ? 'bg-green-400' : 
                  player.tire > 20 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${player.tire}%` }}
              />
            </div>
          </div>
          
          <div className="bg-gray-800 border border-cyan-400 rounded p-2">
            <div className="text-cyan-400 text-xs retro-font mb-1">
              BOOST {boostCooldown > 0 ? `(${Math.ceil(boostCooldown/60)}s)` : ''}
            </div>
            <div className={`w-full h-2 border border-gray-500 rounded ${
              boostCooldown > 0 ? 'bg-gray-600' : 'bg-purple-400'
            }`} />
          </div>
        </div>

        <div
          className="relative bg-green-600 border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Track outer boundary */}
          <div
            className="absolute border-4 border-white rounded-full"
            style={{
              left: centerX - trackOuterRadius,
              top: centerY - trackOuterRadius,
              width: trackOuterRadius * 2,
              height: trackOuterRadius * 2
            }}
          />

          {/* Track inner boundary */}
          <div
            className="absolute border-4 border-white rounded-full bg-green-800"
            style={{
              left: centerX - trackInnerRadius,
              top: centerY - trackInnerRadius,
              width: trackInnerRadius * 2,
              height: trackInnerRadius * 2
            }}
          />

          {/* Track surface */}
          <div
            className="absolute rounded-full bg-gray-600"
            style={{
              left: centerX - trackOuterRadius + 4,
              top: centerY - trackOuterRadius + 4,
              width: (trackOuterRadius - 4) * 2,
              height: (trackOuterRadius - 4) * 2
            }}
          />
          <div
            className="absolute rounded-full bg-green-800"
            style={{
              left: centerX - trackInnerRadius - 4,
              top: centerY - trackInnerRadius - 4,
              width: (trackInnerRadius + 4) * 2,
              height: (trackInnerRadius + 4) * 2
            }}
          />

          {/* Pit lane */}
          <div
            className="absolute bg-gray-800 border-r border-white"
            style={{
              left: centerX - trackInnerRadius * 0.8,
              top: centerY - trackInnerRadius - 4,
              width: trackInnerRadius * 1.8,
              height: 15,
              transform: 'rotate(0deg)',
              transformOrigin: `${centerX}px ${centerY}px`
            }}
          />

          {/* Start/finish line */}
          <div
            className="absolute bg-white"
            style={{
              left: centerX + trackInnerRadius,
              top: centerY - 20,
              width: trackOuterRadius - trackInnerRadius,
              height: 4
            }}
          />
          
          {/* Track markings */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute bg-white opacity-60"
              style={{
                left: centerX + Math.cos(i * Math.PI / 4) * trackOuterRadius - 1,
                top: centerY + Math.sin(i * Math.PI / 4) * trackOuterRadius - 1,
                width: 2,
                height: 15,
                transform: `rotate(${i * 45}deg)`,
                transformOrigin: '1px 1px'
              }}
            />
          ))}

          {/* Competitors */}
          {competitors.map((competitor, index) => (
            <div
              key={index}
              className="absolute rounded"
              style={{
                left: competitor.x - CAR_WIDTH / 2,
                top: competitor.y - CAR_HEIGHT / 2,
                width: CAR_WIDTH,
                height: CAR_HEIGHT,
                backgroundColor: competitor.color,
                transform: `rotate(${competitor.angle + Math.PI/2}rad)`,
                clipPath: 'polygon(30% 0%, 70% 0%, 100% 20%, 100% 100%, 0% 100%, 0% 20%)'
              }}
            >
              {/* Car number */}
              <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                {index + 2}
              </div>
            </div>
          ))}

          {/* Player car */}
          <div
            className={`absolute rounded transition-all duration-100 ${
              boost ? 'bg-yellow-400' : pitStop ? 'bg-gray-400' : 'bg-cyan-400'
            }`}
            style={{
              left: player.x - CAR_WIDTH / 2,
              top: player.y - CAR_HEIGHT / 2,
              width: CAR_WIDTH,
              height: CAR_HEIGHT,
              transform: `rotate(${player.angle + Math.PI/2}rad)`,
              clipPath: 'polygon(30% 0%, 70% 0%, 100% 20%, 100% 100%, 0% 100%, 0% 20%)'
            }}
          >
            {/* Player number */}
            <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
              1
            </div>
          </div>

          {/* Boost effect */}
          {boost && (
            <div
              className="absolute bg-orange-400 opacity-60 rounded"
              style={{
                left: player.x - CAR_WIDTH / 2 - Math.cos(player.angle) * 20,
                top: player.y - CAR_HEIGHT / 2 - Math.sin(player.angle) * 20,
                width: CAR_WIDTH * 0.8,
                height: CAR_HEIGHT * 0.8,
                transform: `rotate(${player.angle + Math.PI/2}rad)`
              }}
            />
          )}
          
          {/* Countdown overlay */}
          {!raceStarted && countdown >= 0 && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className={`text-6xl font-bold animate-pulse retro-font ${
                countdown === 0 ? 'text-green-500' : 
                countdown === 1 ? 'text-yellow-500' :
                'text-red-500'
              }`}>
                {countdown === 0 ? 'GO!' : countdown}
              </div>
            </div>
          )}
          
          {/* Pit stop indicator */}
          {pitStop && (
            <div className="absolute top-4 left-0 right-0 text-center">
              <span className="bg-blue-800 text-white px-3 py-1 rounded animate-pulse">
                PIT STOP
              </span>
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
              <p><strong>Space</strong> Boost</p>
              <p><strong>P/Esc</strong> Pause</p>
            </div>
          </div>
          <p className="text-yellow-400">Complete {totalLaps} laps as fast as possible!</p>
          <p className="text-xs text-green-300">Use inside track near Start/Finish for Pit Stops</p>
        </div>

        {raceComplete && (
          <div className="mt-4 text-center">
            <div className={`text-2xl font-bold mb-2 retro-font ${
              position <= 3 ? 'text-green-400' : 'text-yellow-400'
            } animate-bounce`}>
              RACE FINISHED!
            </div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Position: {position}/6</p>
              <p>Total Time: {formatTime(player.totalTime)}</p>
              {bestLap !== null && <p>Best Lap: {formatTime(bestLap)}</p>}
              <p>Score: {Math.max(0, (1000 - Math.floor(player.totalTime * 5)) + (6 - position) * 100)}</p>
            </div>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-bold border-2 border-cyan-400"
            >
              RACE AGAIN
            </button>
          </div>
        )}

        {paused && !raceComplete && (
          <div className="mt-4 text-center text-yellow-400 text-xl font-bold retro-font">
            PAUSED
          </div>
        )}
      </div>
    </div>
  );
};

export default F1Racing;