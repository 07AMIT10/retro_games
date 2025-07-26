import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface DragRacingProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const CAR_WIDTH = 40;
const CAR_HEIGHT = 60;
const FINISH_LINE = 700;

interface Car {
  x: number;
  y: number;
  speed: number;
  gear: number;
  rpm: number;
  finished: boolean;
  finishTime: number;
}

const DragRacing: React.FC<DragRacingProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Car>({
    x: 50,
    y: CANVAS_HEIGHT / 2 + 50,
    speed: 0,
    gear: 1,
    rpm: 0,
    finished: false,
    finishTime: 0
  });
  const [opponent, setOpponent] = useState<Car>({
    x: 50,
    y: CANVAS_HEIGHT / 2 - 50,
    speed: 0,
    gear: 1,
    rpm: 0,
    finished: false,
    finishTime: 0
  });
  const [raceStarted, setRaceStarted] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [raceTime, setRaceTime] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [perfectStart, setPerfectStart] = useState(false);
  const [reactionTime, setReactionTime] = useState<number | null>(null);

  const maxGear = 5;
  const gearRatios = [0, 3.5, 2.8, 2.1, 1.5, 1.0];
  const redlineRPM = 7000;

  const startRace = useCallback(() => {
    if (countdown === 0) {
      setRaceStarted(true);
      const startTime = Date.now();
      
      // Check reaction time
      const checkReaction = () => {
        if (keys.has(' ')) {
          const reaction = Date.now() - startTime;
          setReactionTime(reaction);
          if (reaction < 200) {
            setPerfectStart(true);
          }
        }
      };
      
      setTimeout(checkReaction, 100);
    }
  }, [countdown, keys]);

  const shiftGear = useCallback((direction: 'up' | 'down') => {
    if (!raceStarted || gameOver || paused) return;

    setPlayer(prev => {
      let newGear = prev.gear;
      
      if (direction === 'up' && prev.gear < maxGear) {
        newGear = prev.gear + 1;
      } else if (direction === 'down' && prev.gear > 1) {
        newGear = prev.gear - 1;
      }
      
      return { ...prev, gear: newGear, rpm: prev.rpm * 0.7 };
    });
  }, [raceStarted, gameOver, paused]);

  const updatePlayer = useCallback(() => {
    if (!raceStarted || gameOver || paused || player.finished) return;

    setPlayer(prev => {
      let newRPM = prev.rpm;
      let newSpeed = prev.speed;

      // Acceleration based on throttle
      if (keys.has(' ')) {
        newRPM = Math.min(redlineRPM + 500, prev.rpm + 100);
        
        // Perfect shift zone
        const optimalRPM = redlineRPM * 0.9;
        const efficiency = newRPM > redlineRPM ? 0.3 : 
                          Math.abs(newRPM - optimalRPM) < 500 ? 1.0 : 0.7;
        
        const acceleration = (newRPM / redlineRPM) * gearRatios[prev.gear] * efficiency;
        newSpeed = Math.min(200, prev.speed + acceleration * 0.1);
      } else {
        // No throttle - engine braking
        newRPM = Math.max(1000, prev.rpm - 50);
        newSpeed = Math.max(0, prev.speed - 0.1);
      }

      // Engine damage if over redline too long
      if (newRPM > redlineRPM) {
        newSpeed *= 0.95; // Power loss
      }

      const newX = prev.x + newSpeed * 0.1;
      
      // Check finish
      if (newX >= FINISH_LINE && !prev.finished) {
        const finishTime = raceTime;
        if (onScoreUpdate) {
          const score = Math.max(0, 1000 - Math.floor(finishTime * 10));
          onScoreUpdate(score);
        }
        return { ...prev, x: FINISH_LINE, finished: true, finishTime };
      }

      return { ...prev, x: newX, speed: newSpeed, rpm: newRPM };
    });
  }, [raceStarted, gameOver, paused, player.finished, keys, raceTime, onScoreUpdate]);

  const updateOpponent = useCallback(() => {
    if (!raceStarted || gameOver || paused || opponent.finished) return;

    setOpponent(prev => {
      // AI opponent logic
      let newRPM = prev.rpm + 80 + Math.random() * 40;
      let newGear = prev.gear;
      
      // AI gear shifting
      if (newRPM > redlineRPM * 0.85 && prev.gear < maxGear) {
        newGear = prev.gear + 1;
        newRPM *= 0.7;
      }
      
      const acceleration = (newRPM / redlineRPM) * gearRatios[newGear] * 0.9;
      const newSpeed = Math.min(180, prev.speed + acceleration * 0.1);
      const newX = prev.x + newSpeed * 0.1;
      
      // Check finish
      if (newX >= FINISH_LINE && !prev.finished) {
        return { ...prev, x: FINISH_LINE, finished: true, finishTime: raceTime };
      }

      return { ...prev, x: newX, speed: newSpeed, rpm: newRPM, gear: newGear };
    });
  }, [raceStarted, gameOver, paused, opponent.finished, raceTime]);

  const resetGame = () => {
    setPlayer({
      x: 50, y: CANVAS_HEIGHT / 2 + 50, speed: 0, gear: 1, rpm: 0, 
      finished: false, finishTime: 0
    });
    setOpponent({
      x: 50, y: CANVAS_HEIGHT / 2 - 50, speed: 0, gear: 1, rpm: 0, 
      finished: false, finishTime: 0
    });
    setRaceStarted(false);
    setCountdown(3);
    setRaceTime(0);
    setPerfectStart(false);
    setReactionTime(null);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (countdown > 0 && !raceStarted && !paused) {
      const timer = setTimeout(() => {
        if (countdown === 1) {
          startRace();
        }
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, raceStarted, paused, startRace]);

  useEffect(() => {
    if (raceStarted && !gameOver && !paused) {
      const timer = setInterval(() => {
        setRaceTime(prev => prev + 0.016);
      }, 16);
      return () => clearInterval(timer);
    }
  }, [raceStarted, gameOver, paused]);

  useEffect(() => {
    if (player.finished && opponent.finished) {
      setGameOver(true);
    }
  }, [player.finished, opponent.finished]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      
      switch (e.key) {
        case 'ArrowUp':
        case 'Shift':
          shiftGear('up');
          break;
        case 'ArrowDown':
          shiftGear('down');
          break;
        case 'p':
        case 'P':
          setPaused(prev => !prev);
          break;
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
  }, [shiftGear]);

  useEffect(() => {
    const gameInterval = setInterval(() => {
      updatePlayer();
      updateOpponent();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateOpponent]);

  const formatTime = (seconds: number): string => {
    return seconds.toFixed(3) + 's';
  };

  const getRPMColor = (rpm: number): string => {
    if (rpm > redlineRPM) return 'bg-red-500';
    if (rpm > redlineRPM * 0.8) return 'bg-yellow-400';
    return 'bg-green-400';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">DRAG RACING</div>
            <div className="text-sm">Time: {formatTime(raceTime)}</div>
            {reactionTime && (
              <div className="text-sm">
                Reaction: {reactionTime}ms {perfectStart && '(PERFECT!)'}
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPaused(!paused)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded border border-cyan-400"
              disabled={gameOver || !raceStarted}
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

        {/* Player stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-800 border border-cyan-400 rounded p-2">
            <div className="text-cyan-400 text-xs retro-font mb-1">GEAR</div>
            <div className="text-white text-xl font-bold text-center">{player.gear}</div>
          </div>
          
          <div className="bg-gray-800 border border-cyan-400 rounded p-2">
            <div className="text-cyan-400 text-xs retro-font mb-1">RPM</div>
            <div className="w-full h-2 bg-gray-600 border border-gray-500 rounded">
              <div
                className={`h-full rounded transition-all duration-100 ${getRPMColor(player.rpm)}`}
                style={{ width: `${Math.min(100, (player.rpm / (redlineRPM + 500)) * 100)}%` }}
              />
            </div>
            <div className="text-white text-xs text-center mt-1">
              {Math.round(player.rpm)}
            </div>
          </div>
          
          <div className="bg-gray-800 border border-cyan-400 rounded p-2">
            <div className="text-cyan-400 text-xs retro-font mb-1">SPEED</div>
            <div className="text-white text-lg font-bold text-center">
              {Math.round(player.speed)} mph
            </div>
          </div>
        </div>

        <div
          className="relative bg-gray-700 border-2 border-gray-600"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Track lanes */}
          <div
            className="absolute bg-gray-600 border-y-4 border-yellow-400"
            style={{
              left: 0,
              top: CANVAS_HEIGHT / 2 - 75,
              width: CANVAS_WIDTH,
              height: 150
            }}
          />
          
          {/* Lane divider */}
          <div
            className="absolute bg-yellow-400"
            style={{
              left: 0,
              top: CANVAS_HEIGHT / 2 - 1,
              width: CANVAS_WIDTH,
              height: 2,
              backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 20px, #facc15 20px, #facc15 40px)'
            }}
          />

          {/* Distance markers */}
          {[200, 400, 600].map(distance => (
            <div
              key={distance}
              className="absolute bg-white"
              style={{
                left: distance,
                top: CANVAS_HEIGHT / 2 - 75,
                width: 2,
                height: 150
              }}
            />
          ))}

          {/* Finish line */}
          <div
            className="absolute bg-white"
            style={{
              left: FINISH_LINE,
              top: CANVAS_HEIGHT / 2 - 75,
              width: 4,
              height: 150,
              backgroundImage: 'repeating-linear-gradient(0deg, black 0px, black 10px, white 10px, white 20px)'
            }}
          />

          {/* Player car */}
          <div
            className="absolute bg-cyan-400 rounded"
            style={{
              left: player.x,
              top: player.y - CAR_HEIGHT / 2,
              width: CAR_WIDTH,
              height: CAR_HEIGHT,
              clipPath: 'polygon(20% 0%, 80% 0%, 100% 30%, 100% 100%, 0% 100%, 0% 30%)'
            }}
          />

          {/* Opponent car */}
          <div
            className="absolute bg-red-400 rounded"
            style={{
              left: opponent.x,
              top: opponent.y - CAR_HEIGHT / 2,
              width: CAR_WIDTH,
              height: CAR_HEIGHT,
              clipPath: 'polygon(20% 0%, 80% 0%, 100% 30%, 100% 100%, 0% 100%, 0% 30%)'
            }}
          />

          {/* Countdown */}
          {countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
              <div className={`text-6xl font-bold retro-font ${
                countdown === 3 ? 'text-red-400' :
                countdown === 2 ? 'text-yellow-400' :
                'text-green-400'
              }`}>
                {countdown}
              </div>
            </div>
          )}

          {/* Perfect start indicator */}
          {perfectStart && raceTime < 2 && (
            <div className="absolute top-4 left-4 text-green-400 text-xl font-bold retro-font animate-pulse">
              PERFECT START!
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <p><strong>Space</strong> - Accelerate</p>
              <p><strong>↑/Shift</strong> - Shift Up</p>
            </div>
            <div>
              <p><strong>↓</strong> - Shift Down</p>
              <p><strong>P</strong> - Pause</p>
            </div>
          </div>
          <p className="text-yellow-400">Perfect timing on shifts for maximum speed!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className={`text-2xl font-bold mb-2 retro-font ${
              player.finishTime < opponent.finishTime ? 'text-green-400' : 'text-red-400'
            }`}>
              {player.finishTime < opponent.finishTime ? 'YOU WIN!' : 'YOU LOSE!'}
            </div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Your Time: {formatTime(player.finishTime)}</p>
              <p>Opponent: {formatTime(opponent.finishTime)}</p>
              {reactionTime && <p>Reaction: {reactionTime}ms</p>}
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

export default DragRacing;