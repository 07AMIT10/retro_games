import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface BasketballProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 500;
const BALL_SIZE = 20;
const HOOP_WIDTH = 80;
const HOOP_HEIGHT = 20;
const GRAVITY = 0.4;
const FRICTION = 0.98;
const BOUNCE_DAMPING = 0.7;

interface Position {
  x: number;
  y: number;
}

interface Ball extends Position {
  vx: number;
  vy: number;
  shooting: boolean;
  trail: Position[];
  rotation: number;
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

interface PowerUp {
  x: number;
  y: number;
  type: 'double' | 'triple' | 'slow';
  active: boolean;
  duration: number;
}

const Basketball: React.FC<BasketballProps> = ({ onScoreUpdate }) => {
  const [ball, setBall] = useState<Ball>({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT - 50, 
    vx: 0, 
    vy: 0, 
    shooting: false,
    trail: [],
    rotation: 0
  });
  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [difficulty, setDifficulty] = useState(1);
  const [wind, setWind] = useState({ x: 0, y: 0 });
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [activePowerUp, setActivePowerUp] = useState<PowerUp | null>(null);
  const [multiplier, setMultiplier] = useState(1);

  const hoopPos = { x: CANVAS_WIDTH / 2 - HOOP_WIDTH / 2, y: 80 + Math.sin(Date.now() / 2000) * 20 };

  const createParticles = (x: number, y: number, color: string, count: number = 10) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
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

  const spawnPowerUp = () => {
    if (Math.random() < 0.3) {
      const types: PowerUp['type'][] = ['double', 'triple', 'slow'];
      const type = types[Math.floor(Math.random() * types.length)];
      setPowerUps(prev => [...prev, {
        x: Math.random() * (CANVAS_WIDTH - 40) + 20,
        y: Math.random() * (CANVAS_HEIGHT - 200) + 100,
        type,
        active: true,
        duration: 10
      }]);
    }
  };

  const shoot = useCallback((targetX: number, targetY: number, powerLevel: number) => {
    if (ball.shooting || gameOver || paused) return;

    const dx = targetX - ball.x;
    const dy = targetY - ball.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Enhanced shooting physics with power and wind effects
    const basePower = 0.8 + (powerLevel / 100) * 0.6;
    const speed = Math.min(20, (distance / 25) * basePower);
    
    setBall(prev => ({
      ...prev,
      vx: (dx / distance) * speed + wind.x,
      vy: (dy / distance) * speed + wind.y,
      shooting: true,
      trail: []
    }));

    setShots(prev => prev + 1);
  }, [ball, gameOver, paused, wind]);

  const updateBall = useCallback(() => {
    if (!ball.shooting || gameOver || paused) return;

    setBall(prev => {
      let newX = prev.x + prev.vx;
      let newY = prev.y + prev.vy;
      let newVx = prev.vx * FRICTION;
      let newVy = prev.vy + GRAVITY;
      let newTrail = [...prev.trail, { x: prev.x, y: prev.y }];
      
      // Apply wind effect
      newVx += wind.x * 0.1;
      newVy += wind.y * 0.1;
      
      // Limit trail length
      if (newTrail.length > 15) {
        newTrail = newTrail.slice(-15);
      }

      // Wall bounces with better physics
      if (newX <= BALL_SIZE/2 || newX >= CANVAS_WIDTH - BALL_SIZE/2) {
        newVx *= -BOUNCE_DAMPING;
        newX = Math.max(BALL_SIZE/2, Math.min(CANVAS_WIDTH - BALL_SIZE/2, newX));
        createParticles(newX, newY, '#FFA500', 6);
      }

      // Floor bounce
      if (newY >= CANVAS_HEIGHT - BALL_SIZE/2) {
        newVy *= -BOUNCE_DAMPING;
        newY = CANVAS_HEIGHT - BALL_SIZE/2;
        createParticles(newX, newY, '#8B4513', 8);
      }

      // Enhanced hoop collision detection
      const hoopCenterX = hoopPos.x + HOOP_WIDTH / 2;
      const hoopTop = hoopPos.y;
      const hoopBottom = hoopPos.y + HOOP_HEIGHT;
      
      // Check if ball is going through hoop from above
      if (
        newX > hoopPos.x + 5 && 
        newX < hoopPos.x + HOOP_WIDTH - 5 &&
        newY > hoopTop && 
        newY < hoopBottom &&
        prev.vy > 0 &&
        prev.y <= hoopTop
      ) {
        // Successful shot!
        const basePoints = 2;
        const streakBonus = Math.min(streak, 10);
        const points = (basePoints + streakBonus) * multiplier;
        
        setScore(prevScore => {
          const newScore = prevScore + points;
          if (onScoreUpdate) onScoreUpdate(newScore);
          return newScore;
        });
        
        setStreak(prev => {
          const newStreak = prev + 1;
          setMaxStreak(current => Math.max(current, newStreak));
          return newStreak;
        });
        
        // Increase difficulty gradually
        setDifficulty(prev => Math.min(3, prev + 0.1));
        
        createParticles(hoopCenterX, hoopTop, '#FFD700', 20);
        spawnPowerUp();
        
        // Reset ball
        return {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT - 50,
          vx: 0,
          vy: 0,
          shooting: false,
          trail: [],
          rotation: 0
        };
      }

      // Rim collision detection
      if (
        newX > hoopPos.x - BALL_SIZE/2 && 
        newX < hoopPos.x + HOOP_WIDTH + BALL_SIZE/2 &&
        newY > hoopTop - BALL_SIZE/2 && 
        newY < hoopBottom + BALL_SIZE/2
      ) {
        // Hit the rim
        if (newX < hoopPos.x + 10 || newX > hoopPos.x + HOOP_WIDTH - 10) {
          newVx *= -0.5;
          setStreak(0); // Break streak on rim hit
          createParticles(newX, newY, '#FF4444', 8);
        }
      }

      // Reset if ball goes off screen
      if (newY > CANVAS_HEIGHT + 100 || newX < -100 || newX > CANVAS_WIDTH + 100) {
        setStreak(0); // Break streak on miss
        return {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT - 50,
          vx: 0,
          vy: 0,
          shooting: false,
          trail: [],
          rotation: 0
        };
      }

      return { 
        x: newX, 
        y: newY, 
        vx: newVx, 
        vy: newVy, 
        shooting: true, 
        trail: newTrail,
        rotation: prev.rotation + Math.abs(newVx) + Math.abs(newVy)
      };
    });
  }, [ball.shooting, gameOver, paused, hoopPos, onScoreUpdate, wind, streak, multiplier]);

  const resetGame = () => {
    setBall({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50, vx: 0, vy: 0, shooting: false, trail: [], rotation: 0 });
    setScore(0);
    setShots(0);
    setTimeLeft(60);
    setGameOver(false);
    setPaused(false);
    setPower(0);
    setCharging(false);
    setParticles([]);
    setStreak(0);
    setMaxStreak(0);
    setDifficulty(1);
    setWind({ x: 0, y: 0 });
    setPowerUps([]);
    setActivePowerUp(null);
    setMultiplier(1);
  };

  // Update wind effect periodically
  useEffect(() => {
    const windInterval = setInterval(() => {
      setWind({
        x: (Math.random() - 0.5) * difficulty * 0.2,
        y: (Math.random() - 0.5) * difficulty * 0.1
      });
    }, 3000);

    return () => clearInterval(windInterval);
  }, [difficulty]);

  // Update power-ups
  useEffect(() => {
    const powerUpInterval = setInterval(() => {
      setPowerUps(prev => prev.map(powerUp => ({
        ...powerUp,
        duration: powerUp.duration - 1
      })).filter(powerUp => powerUp.duration > 0));

      if (activePowerUp) {
        setActivePowerUp(prev => {
          if (prev && prev.duration > 1) {
            return { ...prev, duration: prev.duration - 1 };
          }
          setMultiplier(1);
          return null;
        });
      }
    }, 1000);

    return () => clearInterval(powerUpInterval);
  }, [activePowerUp]);

  // Check power-up collisions
  useEffect(() => {
    powerUps.forEach((powerUp, index) => {
      const distance = Math.sqrt((ball.x - powerUp.x) ** 2 + (ball.y - powerUp.y) ** 2);
      if (distance < 30 && powerUp.active) {
        setActivePowerUp(powerUp);
        setPowerUps(prev => prev.filter((_, i) => i !== index));
        
        switch (powerUp.type) {
          case 'double':
            setMultiplier(2);
            break;
          case 'triple':
            setMultiplier(3);
            break;
          case 'slow':
            // Slow motion effect would be implemented here
            break;
        }
        
        createParticles(powerUp.x, powerUp.y, '#00FF00', 15);
      }
    });
  }, [ball.x, ball.y, powerUps]);

  useEffect(() => {
    if (timeLeft > 0 && !gameOver && !paused) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      setGameOver(true);
      if (onScoreUpdate) onScoreUpdate(score);
    }
  }, [timeLeft, gameOver, paused, score, onScoreUpdate]);

  useEffect(() => {
    const interval = setInterval(updateBall, 16);
    return () => clearInterval(interval);
  }, [updateBall]);

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
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = document.querySelector('[data-basketball-canvas]') as HTMLElement;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      const canvas = document.querySelector('[data-basketball-canvas]') as HTMLElement;
      if (!canvas || !canvas.contains(e.target as Node)) return;
      
      if (!ball.shooting && !gameOver && !paused) {
        setCharging(true);
        setPower(0);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const canvas = document.querySelector('[data-basketball-canvas]') as HTMLElement;
      if (!canvas) return;
      
      if (charging && !ball.shooting && !gameOver && !paused) {
        const rect = canvas.getBoundingClientRect();
        shoot(e.clientX - rect.left, e.clientY - rect.top, power);
        setCharging(false);
        setPower(0);
      }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setPaused(prev => !prev);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [ball.shooting, charging, gameOver, paused, shoot, power]);

  useEffect(() => {
    if (charging) {
      const interval = setInterval(() => {
        setPower(prev => Math.min(100, prev + 3));
      }, 50);
      return () => clearInterval(interval);
    }
  }, [charging]);

  const accuracy = shots > 0 ? Math.round((score / (2 * multiplier) / shots) * 100) : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">BASKETBALL</div>
            <div className="text-sm">SCORE: {score} | TIME: {timeLeft}s</div>
            <div className="text-sm">SHOTS: {shots} | STREAK: {streak}</div>
            <div className="text-sm">ACCURACY: {accuracy}%</div>
            {multiplier > 1 && <div className="text-yellow-400 text-sm">MULTIPLIER: {multiplier}x</div>}
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
          data-basketball-canvas
          className="relative bg-gradient-to-b from-orange-200 to-orange-400 border-4 border-gray-800 rounded-lg overflow-hidden cursor-crosshair"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Court markings */}
          <div className="absolute inset-0">
            <div className="absolute w-full h-1 bg-white top-1/4 opacity-50" />
            <div className="absolute w-full h-1 bg-white top-1/2 opacity-50" />
            <div className="absolute w-full h-1 bg-white top-3/4 opacity-50" />
          </div>
          
          {/* Backboard */}
          <div
            className="absolute bg-white border-2 border-gray-600 shadow-lg"
            style={{
              left: hoopPos.x + HOOP_WIDTH / 2 - 8,
              top: hoopPos.y - 60,
              width: 16,
              height: 70,
              borderRadius: '4px'
            }}
          />
          
          {/* Hoop */}
          <div
            className="absolute bg-gradient-to-b from-red-500 to-red-700 border-2 border-red-800 shadow-lg"
            style={{
              left: hoopPos.x,
              top: hoopPos.y,
              width: HOOP_WIDTH,
              height: HOOP_HEIGHT,
              borderRadius: '10px'
            }}
          />
          
          {/* Net effect */}
          <div
            className="absolute"
            style={{
              left: hoopPos.x + 10,
              top: hoopPos.y + HOOP_HEIGHT,
              width: HOOP_WIDTH - 20,
              height: 15
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute bg-white opacity-60"
                style={{
                  left: i * 8,
                  top: 0,
                  width: 1,
                  height: 15,
                  transform: `rotate(${Math.sin(Date.now() / 1000 + i) * 5}deg)`
                }}
              />
            ))}
          </div>

          {/* Ball trail */}
          {ball.trail.map((pos, index) => (
            <div
              key={index}
              className="absolute bg-orange-400 rounded-full opacity-30"
              style={{
                left: pos.x - (BALL_SIZE * 0.3),
                top: pos.y - (BALL_SIZE * 0.3),
                width: BALL_SIZE * 0.6,
                height: BALL_SIZE * 0.6,
                opacity: (index / ball.trail.length) * 0.4
              }}
            />
          ))}

          {/* Ball */}
          <div
            className="absolute bg-gradient-to-br from-orange-400 to-orange-600 border-2 border-orange-800 rounded-full shadow-lg"
            style={{
              left: ball.x - BALL_SIZE / 2,
              top: ball.y - BALL_SIZE / 2,
              width: BALL_SIZE,
              height: BALL_SIZE,
              transform: `rotate(${ball.rotation}deg)`,
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
            }}
          >
            {/* Basketball lines */}
            <div className="absolute inset-0 rounded-full border border-orange-800 opacity-50" />
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-orange-800 opacity-50" />
            <div className="absolute left-1/2 top-0 w-0.5 h-full bg-orange-800 opacity-50" />
          </div>

          {/* Power-ups */}
          {powerUps.map((powerUp, index) => (
            <div
              key={index}
              className={`absolute w-8 h-8 rounded-full border-2 animate-pulse ${
                powerUp.type === 'double' ? 'bg-blue-500 border-blue-300' :
                powerUp.type === 'triple' ? 'bg-purple-500 border-purple-300' :
                'bg-green-500 border-green-300'
              }`}
              style={{
                left: powerUp.x - 16,
                top: powerUp.y - 16,
                transform: `scale(${1 + Math.sin(Date.now() / 500) * 0.2})`
              }}
            >
              <div className="text-white text-xs font-bold text-center leading-8">
                {powerUp.type === 'double' ? '2x' :
                 powerUp.type === 'triple' ? '3x' : 'S'}
              </div>
            </div>
          ))}

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
          {!ball.shooting && !gameOver && (
            <svg className="absolute inset-0 pointer-events-none">
              <line
                x1={ball.x}
                y1={ball.y}
                x2={mousePos.x}
                y2={mousePos.y}
                stroke="#22d3ee"
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.7"
              />
              <circle
                cx={mousePos.x}
                cy={mousePos.y}
                r="8"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
                opacity="0.5"
              />
            </svg>
          )}

          {/* Wind indicator */}
          {(wind.x !== 0 || wind.y !== 0) && (
            <div className="absolute top-4 right-4 text-white text-sm bg-black bg-opacity-50 p-2 rounded">
              Wind: {wind.x > 0 ? '→' : wind.x < 0 ? '←' : ''} {wind.y > 0 ? '↓' : wind.y < 0 ? '↑' : ''}
            </div>
          )}

          {/* Power meter */}
          {charging && (
            <div className="absolute top-4 left-4 bg-gray-800 border border-cyan-400 p-2 rounded">
              <div className="text-cyan-400 text-xs retro-font mb-1">POWER</div>
              <div className="w-24 h-4 bg-gray-600 border border-gray-500 rounded">
                <div
                  className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded"
                  style={{ width: `${power}%` }}
                />
              </div>
              <div className="text-xs text-cyan-400 mt-1">{power}%</div>
            </div>
          )}

          {/* Active power-up indicator */}
          {activePowerUp && (
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 p-2 rounded border border-yellow-400">
              <div className="text-yellow-400 text-xs font-bold">
                {activePowerUp.type.toUpperCase()} ACTIVE
              </div>
              <div className="text-white text-xs">
                {activePowerUp.duration}s left
              </div>
            </div>
          )}

          {/* Streak indicator */}
          {streak > 3 && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="text-yellow-400 font-bold text-xl animate-pulse retro-font">
                {streak} STREAK!
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Click and hold to charge power, release to shoot! • Space - Pause</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">TIME'S UP!</div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Final Score: {score}</p>
              <p>Shots Taken: {shots}</p>
              <p>Best Streak: {maxStreak}</p>
              <p>Accuracy: {accuracy}%</p>
              {maxStreak > 5 && <p className="text-yellow-400">Excellent Streak!</p>}
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

export default Basketball;