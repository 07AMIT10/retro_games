import React, { useState, useEffect, useCallback } from 'react';
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
}

interface Competitor extends Position {
  angle: number;
  speed: number;
  lap: number;
  color: string;
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
    tire: 100
  });
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [raceComplete, setRaceComplete] = useState(false);
  const [position, setPosition] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [boost, setBoost] = useState(false);
  const [boostCooldown, setBoostCooldown] = useState(0);

  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const trackOuterRadius = 200;
  const trackInnerRadius = 120;
  const totalLaps = 3;

  const createCompetitors = useCallback(() => {
    const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff'];
    return colors.map((color, i) => ({
      x: centerX + (trackInnerRadius + 40) * Math.cos((i * Math.PI) / 3),
      y: centerY + (trackInnerRadius + 40) * Math.sin((i * Math.PI) / 3),
      angle: (i * Math.PI) / 3,
      speed: 3 + Math.random(),
      lap: 0,
      color
    }));
  }, [centerX, centerY, trackInnerRadius]);

  const isOnTrack = (x: number, y: number): boolean => {
    const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    return distFromCenter >= trackInnerRadius && distFromCenter <= trackOuterRadius;
  };

  const getCurrentLap = (x: number, y: number, prevAngle: number): { lap: number; progress: number } => {
    const angle = Math.atan2(y - centerY, x - centerX);
    const normalizedAngle = (angle + Math.PI * 2) % (Math.PI * 2);
    const prevNormalizedAngle = (prevAngle + Math.PI * 2) % (Math.PI * 2);
    
    let lapChange = 0;
    if (prevNormalizedAngle > Math.PI * 1.5 && normalizedAngle < Math.PI * 0.5) {
      lapChange = 1;
    }
    
    return {
      lap: lapChange,
      progress: normalizedAngle / (Math.PI * 2)
    };
  };

  const updatePlayer = useCallback(() => {
    if (gameOver || paused || raceComplete) return;

    setPlayer(prev => {
      let newSpeed = prev.speed;
      let newAngle = prev.angle;
      let newFuel = prev.fuel;
      let newTire = prev.tire;

      // Acceleration/Deceleration
      if (keys.has('ArrowUp')) {
        newSpeed = Math.min(8, prev.speed + 0.2);
        newFuel = Math.max(0, prev.fuel - 0.05);
      } else if (keys.has('ArrowDown')) {
        newSpeed = Math.max(-3, prev.speed - 0.3);
      } else {
        newSpeed = prev.speed * 0.95; // Natural deceleration
      }

      // Steering (only effective when moving)
      if (Math.abs(newSpeed) > 0.5) {
        if (keys.has('ArrowLeft')) {
          newAngle -= 0.04 * (newSpeed / 8);
        }
        if (keys.has('ArrowRight')) {
          newAngle += 0.04 * (newSpeed / 8);
        }
      }

      // Boost
      if (keys.has(' ') && !boost && boostCooldown <= 0 && newFuel > 10) {
        setBoost(true);
        setBoostCooldown(180); // 3 seconds cooldown
        newSpeed = Math.min(12, newSpeed + 4);
        newFuel = Math.max(0, newFuel - 10);
        setTimeout(() => setBoost(false), 1000);
      }

      // Calculate new position
      const newX = prev.x + Math.cos(newAngle) * newSpeed;
      const newY = prev.y + Math.sin(newAngle) * newSpeed;

      // Check if on track
      if (!isOnTrack(newX, newY)) {
        // Off track - reduce speed and tire wear
        newSpeed *= 0.7;
        newTire = Math.max(0, newTire - 0.5);
      } else {
        // Normal tire wear
        newTire = Math.max(0, newTire - 0.02);
      }

      // Lap detection
      const lapInfo = getCurrentLap(newX, newY, prev.angle);
      let newLap = prev.lap + lapInfo.lap;
      let newLapTime = prev.lapTime + 1/60;
      let newTotalTime = prev.totalTime + 1/60;

      if (lapInfo.lap > 0) {
        newLapTime = 0;
        if (newLap >= totalLaps) {
          setRaceComplete(true);
          if (onScoreUpdate) {
            const score = Math.max(0, 1000 - Math.floor(newTotalTime * 10) + position * 100);
            onScoreUpdate(score);
          }
        }
      }

      // Check fuel/tire condition
      if (newFuel <= 0) {
        newSpeed *= 0.5; // Reduced performance
      }
      if (newTire <= 0) {
        newSpeed *= 0.3; // Very poor grip
      }

      return {
        x: newX,
        y: newY,
        angle: newAngle,
        speed: newSpeed,
        lap: newLap,
        lapTime: newLapTime,
        totalTime: newTotalTime,
        fuel: newFuel,
        tire: newTire
      };
    });

    // Update boost cooldown
    if (boostCooldown > 0) {
      setBoostCooldown(prev => prev - 1);
    }
  }, [keys, gameOver, paused, raceComplete, boost, boostCooldown, centerX, centerY, onScoreUpdate, position, totalLaps]);

  const updateCompetitors = useCallback(() => {
    if (gameOver || paused || raceComplete) return;

    setCompetitors(prev => prev.map(competitor => {
      const newAngle = competitor.angle + (competitor.speed / 100);
      const radius = trackInnerRadius + 40;
      const newX = centerX + radius * Math.cos(newAngle);
      const newY = centerY + radius * Math.sin(newAngle);
      
      const lapInfo = getCurrentLap(newX, newY, competitor.angle);
      const newLap = competitor.lap + lapInfo.lap;
      
      // Slight speed variation for realism
      const speedVariation = 0.95 + Math.random() * 0.1;
      const newSpeed = competitor.speed * speedVariation;

      return {
        ...competitor,
        x: newX,
        y: newY,
        angle: newAngle,
        speed: newSpeed,
        lap: newLap
      };
    }));

    // Calculate position
    const allCars = [
      { lap: player.lap, totalTime: player.totalTime, isPlayer: true },
      ...competitors.map(comp => ({ lap: comp.lap, totalTime: 0, isPlayer: false }))
    ];
    
    allCars.sort((a, b) => {
      if (a.lap !== b.lap) return b.lap - a.lap;
      return a.totalTime - b.totalTime;
    });
    
    const playerPosition = allCars.findIndex(car => car.isPlayer) + 1;
    setPosition(playerPosition);
  }, [competitors, player, gameOver, paused, raceComplete, centerX, centerY, trackInnerRadius]);

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
      tire: 100
    });
    setCompetitors(createCompetitors());
    setRaceComplete(false);
    setPosition(1);
    setBoost(false);
    setBoostCooldown(0);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (competitors.length === 0) {
      setCompetitors(createCompetitors());
    }
  }, [competitors.length, createCompetitors]);

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
      updateCompetitors();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateCompetitors]);

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
            <div className="text-sm">Time: {formatTime(player.totalTime)}</div>
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
            <div className="text-cyan-400 text-xs retro-font mb-1">FUEL</div>
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
            <div className="text-cyan-400 text-xs retro-font mb-1">TIRES</div>
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
          className="relative bg-green-600 border-2 border-gray-600"
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
            />
          ))}

          {/* Player car */}
          <div
            className={`absolute rounded transition-all duration-100 ${
              boost ? 'bg-yellow-400' : 'bg-cyan-400'
            }`}
            style={{
              left: player.x - CAR_WIDTH / 2,
              top: player.y - CAR_HEIGHT / 2,
              width: CAR_WIDTH,
              height: CAR_HEIGHT,
              transform: `rotate(${player.angle + Math.PI/2}rad)`,
              clipPath: 'polygon(30% 0%, 70% 0%, 100% 20%, 100% 100%, 0% 100%, 0% 20%)'
            }}
          />

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
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <p><strong>↑↓</strong> Accelerate/Brake</p>
              <p><strong>←→</strong> Steer</p>
            </div>
            <div>
              <p><strong>Space</strong> Boost</p>
              <p><strong>P</strong> Pause</p>
            </div>
          </div>
          <p className="text-yellow-400">Complete 3 laps as fast as possible!</p>
        </div>

        {raceComplete && (
          <div className="mt-4 text-center">
            <div className={`text-2xl font-bold mb-2 retro-font ${
              position <= 3 ? 'text-green-400' : 'text-yellow-400'
            }`}>
              RACE FINISHED!
            </div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Position: {position}/6</p>
              <p>Total Time: {formatTime(player.totalTime)}</p>
              <p>Score: {Math.max(0, 1000 - Math.floor(player.totalTime * 10) + position * 100)}</p>
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