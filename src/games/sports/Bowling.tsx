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
  rotation: number;
  spin: number;
  curve: number;
}

interface Pin extends Position {
  standing: boolean;
  falling: boolean;
  angle: number;
  vx: number;
  vy: number;
  spinning: boolean;
  id: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface FrameScore {
  rolls: number[];
  total: number;
  isStrike: boolean;
  isSpare: boolean;
}

const Bowling: React.FC<BowlingProps> = ({ onScoreUpdate }) => {
  const [ball, setBall] = useState<Ball>({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT - 50, 
    vx: 0, 
    vy: 0, 
    rolling: false,
    rotation: 0,
    spin: 0,
    curve: 0
  });
  const [pins, setPins] = useState<Pin[]>([]);
  const [aimAngle, setAimAngle] = useState(0);
  const [power, setPower] = useState(0);
  const [spin, setSpin] = useState(0);
  const [score, setScore] = useState(0);
  const [frame, setFrame] = useState(1);
  const [rollInFrame, setRollInFrame] = useState(1);
  const [frameScores, setFrameScores] = useState<FrameScore[]>([]);
  const [rollHistory, setRollHistory] = useState<number[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [charging, setCharging] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [strikes, setStrikes] = useState(0);
  const [spares, setSpares] = useState(0);
  const [oilPattern, setOilPattern] = useState<number[][]>([]);
  const [ballPath, setBallPath] = useState<Position[]>([]);
  const [pinsSoundPlaying, setPinsSoundPlaying] = useState(false);

  const createPins = useCallback(() => {
    const newPins: Pin[] = [];
    const startX = CANVAS_WIDTH / 2;
    const startY = 80;
    const spacing = 25;

    // Create 10 pins in triangular formation
    let pinId = 1;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col <= row; col++) {
        newPins.push({
          x: startX + (col - row / 2) * spacing,
          y: startY + row * spacing,
          standing: true,
          falling: false,
          angle: 0,
          vx: 0,
          vy: 0,
          spinning: false,
          id: pinId++
        });
      }
    }
    
    return newPins;
  }, []);

  const createOilPattern = useCallback(() => {
    const pattern: number[][] = [];
    for (let y = 0; y < CANVAS_HEIGHT; y++) {
      const row: number[] = [];
      for (let x = 0; x < CANVAS_WIDTH; x++) {
        // Create house oil pattern - more oil in the middle, less on edges
        const centerDistance = Math.abs(x - CANVAS_WIDTH / 2);
        const lengthFactor = Math.max(0, 1 - (y / (CANVAS_HEIGHT * 0.6)));
        const widthFactor = Math.max(0, 1 - (centerDistance / 150));
        const oilLevel = lengthFactor * widthFactor * 0.7;
        row.push(oilLevel);
      }
      pattern.push(row);
    }
    return pattern;
  }, []);

  const createParticles = (x: number, y: number, color: string, count: number = 8) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      newParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
        size: 2 + Math.random() * 3
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  const rollBall = useCallback((angle: number, power: number, spinValue: number) => {
    if (ball.rolling || gameOver || paused) return;

    const speed = (power / 100) * 15;
    const spinEffect = spinValue * 0.1;
    
    setBall(prev => ({
      ...prev,
      vx: Math.sin(angle) * speed,
      vy: -Math.cos(angle) * speed,
      rolling: true,
      spin: spinValue,
      curve: spinEffect,
      rotation: 0
    }));

    setBallPath([{ x: prev.x, y: prev.y }]);
  }, [ball.rolling, gameOver, paused]);

  const calculatePinCollisions = (pins: Pin[], hitPinIndex: number, force: number) => {
    const newPins = [...pins];
    const hitPin = newPins[hitPinIndex];
    
    if (!hitPin.standing) return newPins;

    // Knock down the hit pin
    newPins[hitPinIndex] = {
      ...hitPin,
      standing: false,
      falling: true,
      spinning: true,
      vx: (Math.random() - 0.5) * force * 0.3,
      vy: (Math.random() - 0.5) * force * 0.3,
      angle: Math.random() * Math.PI
    };

    // Chain reaction - check nearby pins
    pins.forEach((pin, index) => {
      if (index === hitPinIndex || !pin.standing) return;
      
      const dx = pin.x - hitPin.x;
      const dy = pin.y - hitPin.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < PIN_RADIUS * 3 && force > 3) {
        const chainForce = Math.max(0, force - distance * 0.1);
        if (chainForce > 2) {
          newPins[index] = {
            ...pin,
            standing: false,
            falling: true,
            spinning: true,
            vx: (dx / distance) * chainForce * 0.2,
            vy: (dy / distance) * chainForce * 0.2,
            angle: Math.atan2(dy, dx)
          };
        }
      }
    });

    return newPins;
  };

  const updateBall = useCallback(() => {
    if (!ball.rolling || gameOver || paused) return;

    setBall(prev => {
      const newX = prev.x + prev.vx;
      const newY = prev.y + prev.vy;
      let newVx = prev.vx;
      let newVy = prev.vy;

      // Add ball path for visualization
      setBallPath(path => [...path, { x: newX, y: newY }].slice(-20));

      // Apply oil pattern effects
      const oilLevel = oilPattern[Math.floor(newY)]?.[Math.floor(newX)] || 0;
      const friction = 0.995 - (oilLevel * 0.01);
      newVx *= friction;
      newVy *= friction;

      // Apply curve from spin
      newVx += prev.curve * 0.02;
      
      // Lane boundaries
      if (newX <= BALL_RADIUS + 50 || newX >= CANVAS_WIDTH - BALL_RADIUS - 50) {
        // Gutter ball
        createParticles(newX, newY, '#8B4513', 12);
        setTimeout(() => finishRoll(0), 1000);
        return {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT - 50,
          vx: 0,
          vy: 0,
          rolling: false,
          rotation: 0,
          spin: 0,
          curve: 0
        };
      }

      // Stop at end of lane
      if (newY <= 30) {
        setTimeout(() => {
          const pinsDown = pins.filter(pin => !pin.standing).length;
          finishRoll(pinsDown);
        }, 1000);
        
        return {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT - 50,
          vx: 0,
          vy: 0,
          rolling: false,
          rotation: 0,
          spin: 0,
          curve: 0
        };
      }

      // Check pin collisions
      let ballHitPin = false;
      pins.forEach((pin, index) => {
        if (!pin.standing || ballHitPin) return;

        const dx = newX - pin.x;
        const dy = newY - pin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= BALL_RADIUS + PIN_RADIUS) {
          ballHitPin = true;
          const force = Math.sqrt(newVx * newVx + newVy * newVy);
          
          // Update pins with collision physics
          setPins(prevPins => calculatePinCollisions(prevPins, index, force));
          
          createParticles(pin.x, pin.y, '#FFFFFF', 15);
          
          // Ball deflection
          if (distance > 0) {
            const deflectAngle = Math.atan2(dy, dx);
            newVx = Math.cos(deflectAngle) * Math.abs(newVx) * 0.6;
            newVy = Math.sin(deflectAngle) * Math.abs(newVy) * 0.6;
          }
        }
      });

      // Stop ball if too slow
      if (Math.abs(newVx) < 0.2 && Math.abs(newVy) < 0.2 && newY > CANVAS_HEIGHT / 2) {
        setTimeout(() => {
          const pinsDown = pins.filter(pin => !pin.standing).length;
          finishRoll(pinsDown);
        }, 1500);

        return {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT - 50,
          vx: 0,
          vy: 0,
          rolling: false,
          rotation: 0,
          spin: 0,
          curve: 0
        };
      }

      return { 
        x: newX, 
        y: newY, 
        vx: newVx, 
        vy: newVy, 
        rolling: true,
        rotation: prev.rotation + Math.abs(newVx) + Math.abs(newVy),
        spin: prev.spin,
        curve: prev.curve
      };
    });
  }, [ball.rolling, gameOver, paused, pins, oilPattern]);

  const finishRoll = (pinsDown: number) => {
    setRollHistory(prev => [...prev, pinsDown]);
    
    if (rollInFrame === 1) {
      if (pinsDown === 10) {
        // Strike
        setStrikes(prev => prev + 1);
        setScore(prev => prev + 10);
        setFrameScores(prev => [...prev, { 
          rolls: [10], 
          total: 10, 
          isStrike: true, 
          isSpare: false 
        }]);
        
        if (frame < 10) {
          setRollInFrame(1);
          setFrame(prev => prev + 1);
          setPins(createPins());
          createParticles(CANVAS_WIDTH / 2, 100, '#FFD700', 25);
        }
      } else {
        setRollInFrame(2);
      }
    } else {
      // Second roll
      const firstRollPins = rollHistory[rollHistory.length - 1] || 0;
      const totalPinsDown = firstRollPins + pinsDown;
      
      if (totalPinsDown === 10) {
        // Spare
        setSpares(prev => prev + 1);
        setScore(prev => prev + 10);
        setFrameScores(prev => [...prev, { 
          rolls: [firstRollPins, pinsDown], 
          total: 10, 
          isStrike: false, 
          isSpare: true 
        }]);
        createParticles(CANVAS_WIDTH / 2, 100, '#00FF00', 20);
      } else {
        setScore(prev => prev + totalPinsDown);
        setFrameScores(prev => [...prev, { 
          rolls: [firstRollPins, pinsDown], 
          total: totalPinsDown, 
          isStrike: false, 
          isSpare: false 
        }]);
      }
      
      if (frame < 10) {
        setRollInFrame(1);
        setFrame(prev => prev + 1);
        setPins(createPins());
      }
    }

    if (frame >= 10) {
      setGameOver(true);
      if (onScoreUpdate) onScoreUpdate(score);
    }
  };

  const updatePins = useCallback(() => {
    setPins(prevPins => prevPins.map(pin => {
      if (!pin.spinning) return pin;
      
      return {
        ...pin,
        x: pin.x + pin.vx,
        y: pin.y + pin.vy,
        vx: pin.vx * 0.95,
        vy: pin.vy * 0.95,
        angle: pin.angle + 0.1,
        spinning: Math.abs(pin.vx) > 0.1 || Math.abs(pin.vy) > 0.1
      };
    }));
  }, []);

  const resetGame = () => {
    setBall({ 
      x: CANVAS_WIDTH / 2, 
      y: CANVAS_HEIGHT - 50, 
      vx: 0, 
      vy: 0, 
      rolling: false,
      rotation: 0,
      spin: 0,
      curve: 0
    });
    setPins(createPins());
    setAimAngle(0);
    setPower(0);
    setSpin(0);
    setScore(0);
    setFrame(1);
    setRollInFrame(1);
    setFrameScores([]);
    setRollHistory([]);
    setCharging(false);
    setGameOver(false);
    setPaused(false);
    setParticles([]);
    setStrikes(0);
    setSpares(0);
    setBallPath([]);
  };

  useEffect(() => {
    setPins(createPins());
    setOilPattern(createOilPattern());
  }, [createPins, createOilPattern]);

  useEffect(() => {
    const interval = setInterval(updateBall, 16);
    return () => clearInterval(interval);
  }, [updateBall]);

  useEffect(() => {
    const interval = setInterval(updatePins, 16);
    return () => clearInterval(interval);
  }, [updatePins]);

  // Update particles
  useEffect(() => {
    const particleInterval = setInterval(() => {
      setParticles(prev => prev.map(particle => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        vx: particle.vx * 0.98,
        vy: particle.vy * 0.98 + 0.1,
        life: particle.life - 0.02
      })).filter(particle => particle.life > 0));
    }, 16);

    return () => clearInterval(particleInterval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setAimAngle(prev => Math.max(-0.8, prev - 0.05));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setAimAngle(prev => Math.min(0.8, prev + 0.05));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSpin(prev => Math.min(10, prev + 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSpin(prev => Math.max(-10, prev - 1));
          break;
        case ' ':
          e.preventDefault();
          if (!ball.rolling && !gameOver && !paused) {
            if (charging) {
              rollBall(aimAngle, power, spin);
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
        rollBall(aimAngle, power, spin);
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
  }, [aimAngle, power, spin, charging, ball.rolling, gameOver, paused, rollBall]);

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
            <div className="text-lg font-bold">BOWLING CHAMPIONSHIP</div>
            <div className="text-sm">Frame {frame}/10 | Roll {rollInFrame}</div>
            <div className="text-sm">Strikes: {strikes} | Spares: {spares}</div>
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
          className="relative bg-gradient-to-b from-yellow-900 to-yellow-800 border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Oil pattern visualization */}
          <div className="absolute inset-0 opacity-20">
            {oilPattern.map((row, y) => 
              row.map((oil, x) => (
                <div
                  key={`${x}-${y}`}
                  className="absolute bg-blue-400"
                  style={{
                    left: x,
                    top: y,
                    width: 1,
                    height: 1,
                    opacity: oil
                  }}
                />
              ))
            )}
          </div>

          {/* Lane */}
          <div
            className="absolute bg-yellow-800 border-x-4 border-yellow-600"
            style={{
              left: 50,
              top: 0,
              width: CANVAS_WIDTH - 100,
              height: CANVAS_HEIGHT
            }}
          />

          {/* Lane markings */}
          <div className="absolute w-full">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-gray-600 rounded-full"
                style={{
                  left: CANVAS_WIDTH / 2 - 1,
                  top: 60 + i * 50
                }}
              />
            ))}
          </div>

          {/* Ball path trail */}
          {ballPath.map((pos, index) => (
            <div
              key={index}
              className="absolute bg-red-400 rounded-full"
              style={{
                left: pos.x - 2,
                top: pos.y - 2,
                width: 4,
                height: 4,
                opacity: (index / ballPath.length) * 0.5
              }}
            />
          ))}

          {/* Pins */}
          {pins.map((pin, index) => (
            <div
              key={index}
              className={`absolute transition-all duration-300 ${
                pin.standing ? 'bg-white border-2 border-gray-300' : 'bg-gray-500 border-2 border-gray-400'
              }`}
              style={{
                left: pin.x - PIN_RADIUS,
                top: pin.y - PIN_RADIUS,
                width: PIN_RADIUS * 2,
                height: PIN_RADIUS * 2,
                borderRadius: pin.standing ? '50% 50% 50% 50% / 60% 60% 40% 40%' : '50%',
                transform: `rotate(${pin.angle}rad) translate(${pin.vx}px, ${pin.vy}px)`,
                boxShadow: pin.standing ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
              }}
            >
              {pin.standing && (
                <div className="absolute inset-1 bg-red-500 rounded-full opacity-30" />
              )}
            </div>
          ))}

          {/* Ball */}
          <div
            className="absolute bg-gradient-to-br from-red-500 to-red-700 rounded-full border-2 border-red-400 shadow-lg"
            style={{
              left: ball.x - BALL_RADIUS,
              top: ball.y - BALL_RADIUS,
              width: BALL_RADIUS * 2,
              height: BALL_RADIUS * 2,
              transform: `rotate(${ball.rotation}deg)`,
              boxShadow: '0 4px 8px rgba(0,0,0,0.4)'
            }}
          >
            {/* Ball finger holes */}
            <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
              <div className="w-1 h-1 bg-black rounded-full" />
            </div>
            <div className="absolute top-3 left-1/3">
              <div className="w-1 h-1 bg-black rounded-full" />
            </div>
            <div className="absolute top-3 right-1/3">
              <div className="w-1 h-1 bg-black rounded-full" />
            </div>
          </div>

          {/* Particles */}
          {particles.map((particle, index) => (
            <div
              key={index}
              className="absolute rounded-full"
              style={{
                left: particle.x - particle.size/2,
                top: particle.y - particle.size/2,
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
                opacity: particle.life
              }}
            />
          ))}

          {/* Aiming line */}
          {!ball.rolling && !gameOver && (
            <svg className="absolute inset-0 pointer-events-none">
              <line
                x1={ball.x}
                y1={ball.y}
                x2={ball.x + Math.sin(aimAngle) * 300}
                y2={ball.y - Math.cos(aimAngle) * 300}
                stroke="#22d3ee"
                strokeWidth="3"
                strokeDasharray="8,4"
                opacity="0.8"
              />
              {/* Spin indicator */}
              <circle
                cx={ball.x + Math.sin(aimAngle) * 100}
                cy={ball.y - Math.cos(aimAngle) * 100}
                r="15"
                fill="none"
                stroke={spin > 0 ? "#00ff00" : spin < 0 ? "#ff0000" : "#22d3ee"}
                strokeWidth="2"
                opacity="0.6"
              />
            </svg>
          )}

          {/* Power meter */}
          {charging && (
            <div className="absolute bottom-4 left-4 bg-gray-800 border border-cyan-400 p-3 rounded">
              <div className="text-cyan-400 text-xs retro-font mb-1">POWER</div>
              <div className="w-32 h-4 bg-gray-600 border border-gray-500 rounded">
                <div
                  className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded"
                  style={{ width: `${power}%` }}
                />
              </div>
              <div className="text-xs text-cyan-400 mt-1">{power}%</div>
            </div>
          )}

          {/* Spin meter */}
          <div className="absolute bottom-4 right-4 bg-gray-800 border border-cyan-400 p-3 rounded">
            <div className="text-cyan-400 text-xs retro-font mb-1">SPIN</div>
            <div className="w-24 h-4 bg-gray-600 border border-gray-500 rounded relative">
              <div className="absolute top-1/2 left-1/2 w-0.5 h-full bg-white transform -translate-x-1/2 -translate-y-1/2" />
              <div
                className={`h-full rounded ${spin > 0 ? 'bg-green-400' : 'bg-red-400'}`}
                style={{ 
                  width: `${Math.abs(spin) * 5}%`,
                  marginLeft: spin < 0 ? `${50 - Math.abs(spin) * 5}%` : '50%'
                }}
              />
            </div>
            <div className="text-xs text-cyan-400 mt-1">{spin > 0 ? 'R' : spin < 0 ? 'L' : 'C'}</div>
          </div>

          {/* Frame scores display */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-75 p-2 rounded border border-cyan-400">
            <div className="text-cyan-400 text-xs retro-font mb-1">FRAMES</div>
            <div className="flex space-x-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className={`w-8 h-8 border border-gray-500 text-xs text-center ${
                  i < frameScores.length ? 'bg-gray-700' : 'bg-gray-800'
                }`}>
                  {frameScores[i] && (
                    <div className="text-white">
                      {frameScores[i].isStrike ? 'X' : 
                       frameScores[i].isSpare ? '/' : 
                       frameScores[i].total}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>←→ Aim • ↑↓ Spin • Hold Space to charge power, release to roll!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-green-400 text-2xl font-bold mb-2 retro-font">GAME COMPLETE!</div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Final Score: {score}</p>
              <p>Strikes: {strikes} | Spares: {spares}</p>
              <p>Average: {frameScores.length > 0 ? Math.round(score / frameScores.length) : 0}</p>
              {strikes >= 5 && <p className="text-yellow-400">Excellent Strike Rate!</p>}
            </div>
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