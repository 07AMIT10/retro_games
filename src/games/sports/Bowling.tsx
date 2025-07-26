import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface BowlingProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 500;
const BALL_RADIUS = 15;
const PIN_RADIUS = 8;

interface Position {
  x: number;
  y: number;
}

interface Ball extends Position {
  vx: number;
  vy: number;
  rolling: boolean;
}

interface Pin extends Position {
  standing: boolean;
  falling: boolean;
}

const Bowling: React.FC<BowlingProps> = ({ onScoreUpdate }) => {
  const [ball, setBall] = useState<Ball>({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT - 50, 
    vx: 0, 
    vy: 0, 
    rolling: false 
  });
  const [pins, setPins] = useState<Pin[]>([]);
  const [aimAngle, setAimAngle] = useState(0);
  const [power, setPower] = useState(0);
  const [score, setScore] = useState(0);
  const [frame, setFrame] = useState(1);
  const [rollInFrame, setRollInFrame] = useState(1);
  const [frameScores, setFrameScores] = useState<number[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [charging, setCharging] = useState(false);

  const createPins = useCallback(() => {
    const newPins: Pin[] = [];
    const startX = CANVAS_WIDTH / 2;
    const startY = 80;
    const spacing = 25;

    // Create 10 pins in triangular formation
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col <= row; col++) {
        newPins.push({
          x: startX + (col - row / 2) * spacing,
          y: startY + row * spacing,
          standing: true,
          falling: false
        });
      }
    }
    
    return newPins;
  }, []);

  const rollBall = useCallback((angle: number, power: number) => {
    if (ball.rolling || gameOver || paused) return;

    const speed = (power / 100) * 12;
    setBall(prev => ({
      ...prev,
      vx: Math.sin(angle) * speed,
      vy: -Math.cos(angle) * speed,
      rolling: true
    }));
  }, [ball.rolling, gameOver, paused]);

  const updateBall = useCallback(() => {
    if (!ball.rolling || gameOver || paused) return;

    setBall(prev => {
      let newX = prev.x + prev.vx;
      let newY = prev.y + prev.vy;
      let newVx = prev.vx * 0.99; // friction
      let newVy = prev.vy * 0.99;

      // Lane boundaries
      if (newX <= BALL_RADIUS + 50 || newX >= CANVAS_WIDTH - BALL_RADIUS - 50) {
        // Gutter ball
        return {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT - 50,
          vx: 0,
          vy: 0,
          rolling: false
        };
      }

      // Stop at end of lane
      if (newY <= 30) {
        return {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT - 50,
          vx: 0,
          vy: 0,
          rolling: false
        };
      }

      // Check pin collisions
      pins.forEach((pin, index) => {
        if (!pin.standing) return;

        const dx = newX - pin.x;
        const dy = newY - pin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= BALL_RADIUS + PIN_RADIUS) {
          setPins(prevPins => {
            const newPins = [...prevPins];
            newPins[index] = { ...pin, standing: false, falling: true };
            return newPins;
          });

          // Ball deflection
          if (distance > 0) {
            const deflectAngle = Math.atan2(dy, dx);
            newVx = Math.cos(deflectAngle) * Math.abs(newVx) * 0.7;
            newVy = Math.sin(deflectAngle) * Math.abs(newVy) * 0.7;
          }
        }
      });

      // Stop ball if too slow
      if (Math.abs(newVx) < 0.1 && Math.abs(newVy) < 0.1) {
        setTimeout(() => {
          // Calculate score and next roll
          const pinsDown = pins.filter(pin => !pin.standing).length;
          
          if (rollInFrame === 1) {
            if (pinsDown === 10) {
              // Strike
              setScore(prev => prev + 10);
              setRollInFrame(1);
              setFrame(prev => prev + 1);
              setPins(createPins());
            } else {
              setRollInFrame(2);
            }
          } else {
            // Second roll
            const totalPinsDown = pins.filter(pin => !pin.standing).length;
            if (totalPinsDown === 10) {
              // Spare
              setScore(prev => prev + 10);
            } else {
              setScore(prev => prev + totalPinsDown);
            }
            
            setRollInFrame(1);
            setFrame(prev => prev + 1);
            setPins(createPins());
          }

          if (frame >= 10) {
            setGameOver(true);
            if (onScoreUpdate) onScoreUpdate(score);
          }
        }, 1000);

        return {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT - 50,
          vx: 0,
          vy: 0,
          rolling: false
        };
      }

      return { x: newX, y: newY, vx: newVx, vy: newVy, rolling: true };
    });
  }, [ball.rolling, gameOver, paused, pins, rollInFrame, frame, score, createPins, onScoreUpdate]);

  const resetGame = () => {
    setBall({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50, vx: 0, vy: 0, rolling: false });
    setPins(createPins());
    setAimAngle(0);
    setPower(0);
    setScore(0);
    setFrame(1);
    setRollInFrame(1);
    setFrameScores([]);
    setCharging(false);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    setPins(createPins());
  }, [createPins]);

  useEffect(() => {
    const interval = setInterval(updateBall, 16);
    return () => clearInterval(interval);
  }, [updateBall]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setAimAngle(prev => Math.max(-0.5, prev - 0.05));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setAimAngle(prev => Math.min(0.5, prev + 0.05));
          break;
        case ' ':
          e.preventDefault();
          if (!ball.rolling && !gameOver && !paused) {
            if (charging) {
              rollBall(aimAngle, power);
              setCharging(false);
              setPower(0);
            } else {
              setCharging(true);
            }
          } else if (!ball.rolling) {
            setPaused(prev => !prev);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && charging) {
        rollBall(aimAngle, power);
        setCharging(false);
        setPower(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [aimAngle, power, charging, ball.rolling, gameOver, paused, rollBall]);

  useEffect(() => {
    if (charging) {
      const interval = setInterval(() => {
        setPower(prev => Math.min(100, prev + 2));
      }, 50);
      return () => clearInterval(interval);
    }
  }, [charging]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">BOWLING</div>
            <div className="text-sm">Frame {frame}/10 | Roll {rollInFrame}</div>
          </div>
          <div className="text-white text-xl font-bold retro-font">
            SCORE: {score}
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
          className="relative bg-yellow-900 border-2 border-gray-600"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Lane */}
          <div
            className="absolute bg-yellow-800 border-x-2 border-yellow-600"
            style={{
              left: 50,
              top: 0,
              width: CANVAS_WIDTH - 100,
              height: CANVAS_HEIGHT
            }}
          />

          {/* Pins */}
          {pins.map((pin, index) => (
            <div
              key={index}
              className={`absolute rounded-full transition-all duration-500 ${
                pin.standing ? 'bg-white border-2 border-gray-300' : 'bg-gray-500 border-2 border-gray-400'
              }`}
              style={{
                left: pin.x - PIN_RADIUS,
                top: pin.y - PIN_RADIUS,
                width: PIN_RADIUS * 2,
                height: PIN_RADIUS * 2,
                transform: pin.falling ? 'rotate(90deg)' : 'none'
              }}
            />
          ))}

          {/* Ball */}
          <div
            className="absolute bg-red-600 rounded-full border-2 border-red-500"
            style={{
              left: ball.x - BALL_RADIUS,
              top: ball.y - BALL_RADIUS,
              width: BALL_RADIUS * 2,
              height: BALL_RADIUS * 2
            }}
          />

          {/* Aiming line */}
          {!ball.rolling && !gameOver && (
            <svg className="absolute inset-0 pointer-events-none">
              <line
                x1={ball.x}
                y1={ball.y}
                x2={ball.x + Math.sin(aimAngle) * 200}
                y2={ball.y - Math.cos(aimAngle) * 200}
                stroke="#22d3ee"
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.7"
              />
            </svg>
          )}

          {/* Power meter */}
          {charging && (
            <div className="absolute bottom-4 left-4 bg-gray-800 border border-cyan-400 p-2 rounded">
              <div className="text-cyan-400 text-xs retro-font mb-1">POWER</div>
              <div className="w-32 h-4 bg-gray-600 border border-gray-500">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-red-400"
                  style={{ width: `${power}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>←→ Aim • Hold Space to charge power, release to roll!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-green-400 text-2xl font-bold mb-2 retro-font">GAME COMPLETE!</div>
            <p className="text-cyan-400 mb-4 retro-font">Final Score: {score}</p>
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

export default Bowling;