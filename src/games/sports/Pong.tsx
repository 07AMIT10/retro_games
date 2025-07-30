import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface PongProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 12;
const PADDLE_SPEED = 6;
const BALL_SPEED = 4;

interface Position {
  x: number;
  y: number;
}

interface Velocity {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const Pong: React.FC<PongProps> = ({ onScoreUpdate }) => {
  const [leftPaddle, setLeftPaddle] = useState<Position>({ 
    x: 20, 
    y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 
  });
  const [rightPaddle, setRightPaddle] = useState<Position>({ 
    x: CANVAS_WIDTH - 32, 
    y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 
  });
  const [ball, setBall] = useState<Position>({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT / 2 
  });
  const [ballVelocity, setBallVelocity] = useState<Velocity>({ x: BALL_SPEED, y: BALL_SPEED });
  const [leftScore, setLeftScore] = useState(0);
  const [rightScore, setRightScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [particles, setParticles] = useState<Particle[]>([]);
  const [ballTrail, setBallTrail] = useState<Position[]>([]);
  const [rally, setRally] = useState(0);
  const [maxRally, setMaxRally] = useState(0);
  const [ballSpeed, setBallSpeed] = useState(BALL_SPEED);

  const createParticles = (x: number, y: number, color: string, count: number = 8) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      newParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  const resetBall = () => {
    setBall({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
    setBallVelocity({ 
      x: (Math.random() > 0.5 ? 1 : -1) * ballSpeed, 
      y: (Math.random() - 0.5) * ballSpeed 
    });
    setMaxRally(prev => Math.max(prev, rally));
    setRally(0);
    setBallTrail([]);
  };

  const resetGame = () => {
    setLeftPaddle({ x: 20, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 });
    setRightPaddle({ x: CANVAS_WIDTH - 32, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 });
    setLeftScore(0);
    setRightScore(0);
    setGameOver(false);
    setPaused(false);
    setMaxRally(0);
    setRally(0);
    setBallSpeed(BALL_SPEED);
    setParticles([]);
    resetBall();
  };

  const checkCollision = (ballPos: Position, paddlePos: Position): boolean => {
    return (
      ballPos.x < paddlePos.x + PADDLE_WIDTH &&
      ballPos.x + BALL_SIZE > paddlePos.x &&
      ballPos.y < paddlePos.y + PADDLE_HEIGHT &&
      ballPos.y + BALL_SIZE > paddlePos.y
    );
  };

  const updateGame = useCallback(() => {
    if (gameOver || paused) return;

    // Update paddle positions based on keys
    setLeftPaddle(prev => {
      let newY = prev.y;
      if (keys.has('w') || keys.has('W')) {
        newY = Math.max(0, prev.y - PADDLE_SPEED);
      }
      if (keys.has('s') || keys.has('S')) {
        newY = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, prev.y + PADDLE_SPEED);
      }
      return { ...prev, y: newY };
    });

    setRightPaddle(prev => {
      let newY = prev.y;
      if (keys.has('ArrowUp')) {
        newY = Math.max(0, prev.y - PADDLE_SPEED);
      }
      if (keys.has('ArrowDown')) {
        newY = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, prev.y + PADDLE_SPEED);
      }
      return { ...prev, y: newY };
    });

    // Update ball trail
    setBallTrail(prev => {
      const newTrail = [...prev, { x: ball.x, y: ball.y }];
      return newTrail.slice(-12); // Keep last 12 positions
    });

    // Update ball position
    setBall(prevBall => {
      const newBall = {
        x: prevBall.x + ballVelocity.x,
        y: prevBall.y + ballVelocity.y
      };

      // Ball collision with top and bottom walls
      if (newBall.y <= 0 || newBall.y >= CANVAS_HEIGHT - BALL_SIZE) {
        setBallVelocity(prev => ({ ...prev, y: -prev.y }));
        newBall.y = Math.max(0, Math.min(CANVAS_HEIGHT - BALL_SIZE, newBall.y));
        createParticles(newBall.x, newBall.y, '#22d3ee', 6);
      }

      // Ball collision with left paddle
      if (checkCollision(newBall, leftPaddle) && ballVelocity.x < 0) {
        const hitPosition = (newBall.y - (leftPaddle.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
        const speedIncrease = 1 + rally * 0.02; // Increase speed with rally
        setBallVelocity(prev => ({ 
          x: Math.abs(prev.x) * speedIncrease,
          y: prev.y + hitPosition * 2
        }));
        setBallSpeed(prev => prev * 1.02);
        setRally(prev => prev + 1);
        newBall.x = leftPaddle.x + PADDLE_WIDTH;
        createParticles(newBall.x, newBall.y, '#60a5fa', 10);
      }

      // Ball collision with right paddle
      if (checkCollision(newBall, rightPaddle) && ballVelocity.x > 0) {
        const hitPosition = (newBall.y - (rightPaddle.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
        const speedIncrease = 1 + rally * 0.02;
        setBallVelocity(prev => ({ 
          x: -Math.abs(prev.x) * speedIncrease,
          y: prev.y + hitPosition * 2
        }));
        setBallSpeed(prev => prev * 1.02);
        setRally(prev => prev + 1);
        newBall.x = rightPaddle.x - BALL_SIZE;
        createParticles(newBall.x, newBall.y, '#f87171', 10);
      }

      // Ball goes off screen (scoring)
      if (newBall.x < 0) {
        setRightScore(prev => {
          const newScore = prev + 1;
          if (newScore >= 11) {
            setGameOver(true);
            if (onScoreUpdate) {
              onScoreUpdate(newScore * 100 + maxRally * 10);
            }
          }
          return newScore;
        });
        createParticles(0, newBall.y, '#f87171', 20);
        resetBall();
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
      }

      if (newBall.x > CANVAS_WIDTH) {
        setLeftScore(prev => {
          const newScore = prev + 1;
          if (newScore >= 11) {
            setGameOver(true);
            if (onScoreUpdate) {
              onScoreUpdate(newScore * 100 + maxRally * 10);
            }
          }
          return newScore;
        });
        createParticles(CANVAS_WIDTH, newBall.y, '#60a5fa', 20);
        resetBall();
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
      }

      return newBall;
    });
  }, [keys, leftPaddle, rightPaddle, ballVelocity, gameOver, paused, ball, rally, maxRally, ballSpeed, onScoreUpdate]);

  // Update particles
  useEffect(() => {
    const particleInterval = setInterval(() => {
      setParticles(prev => prev.map(particle => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        vx: particle.vx * 0.98,
        vy: particle.vy * 0.98,
        life: particle.life - 0.02
      })).filter(particle => particle.life > 0));
    }, 16);

    return () => clearInterval(particleInterval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setPaused(prev => !prev);
        return;
      }
      setKeys(prev => new Set(prev).add(e.key));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
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
    const gameInterval = setInterval(updateGame, 16);
    return () => clearInterval(gameInterval);
  }, [updateGame]);

  const winner = leftScore >= 11 ? 'Left Player' : rightScore >= 11 ? 'Right Player' : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">PONG</div>
            <div className="text-sm">Rally: {rally} | Best: {maxRally}</div>
            <div className="text-sm">Speed: {ballSpeed.toFixed(1)}</div>
          </div>
          <div className="text-white text-2xl font-bold retro-font">
            {leftScore} - {rightScore}
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
          className="relative bg-black border-4 border-gray-800 rounded-lg overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Center line */}
          <div
            className="absolute bg-cyan-400 opacity-60"
            style={{
              left: CANVAS_WIDTH / 2 - 1,
              top: 0,
              width: 2,
              height: CANVAS_HEIGHT,
              backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 10px, #22d3ee 10px, #22d3ee 20px)'
            }}
          />

          {/* Ball trail */}
          {ballTrail.map((pos, index) => (
            <div
              key={index}
              className="absolute bg-yellow-300 rounded-full"
              style={{
                left: pos.x + BALL_SIZE / 2 - 2,
                top: pos.y + BALL_SIZE / 2 - 2,
                width: 4,
                height: 4,
                opacity: (index / ballTrail.length) * 0.6
              }}
            />
          ))}

          {/* Left paddle */}
          <div
            className="absolute bg-gradient-to-r from-blue-400 to-blue-600 border-2 border-blue-800 rounded shadow-lg"
            style={{
              left: leftPaddle.x,
              top: leftPaddle.y,
              width: PADDLE_WIDTH,
              height: PADDLE_HEIGHT,
              boxShadow: '0 0 15px rgba(96, 165, 250, 0.5)'
            }}
          />

          {/* Right paddle */}
          <div
            className="absolute bg-gradient-to-r from-red-400 to-red-600 border-2 border-red-800 rounded shadow-lg"
            style={{
              left: rightPaddle.x,
              top: rightPaddle.y,
              width: PADDLE_WIDTH,
              height: PADDLE_HEIGHT,
              boxShadow: '0 0 15px rgba(248, 113, 113, 0.5)'
            }}
          />

          {/* Ball */}
          <div
            className="absolute bg-gradient-to-br from-yellow-300 to-yellow-500 border-2 border-yellow-600 rounded-full shadow-lg"
            style={{
              left: ball.x,
              top: ball.y,
              width: BALL_SIZE,
              height: BALL_SIZE,
              boxShadow: '0 0 20px rgba(253, 224, 71, 0.7)'
            }}
          />

          {/* Particles */}
          {particles.map((particle, index) => (
            <div
              key={index}
              className="absolute rounded-full"
              style={{
                left: particle.x - 2,
                top: particle.y - 2,
                width: 4,
                height: 4,
                backgroundColor: particle.color,
                opacity: particle.life
              }}
            />
          ))}

          {/* Rally streak indicator */}
          {rally > 3 && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
              <div className="bg-black bg-opacity-75 px-3 py-1 rounded border border-yellow-400">
                <div className="text-yellow-400 font-bold text-sm retro-font">
                  {rally} HIT RALLY!
                </div>
              </div>
            </div>
          )}

          {/* Speed indicator */}
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-75 p-2 rounded border border-cyan-400">
            <div className="text-cyan-400 text-xs retro-font">
              Ball Speed: {Math.abs(ballVelocity.x).toFixed(1)}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-8 text-center text-sm text-cyan-400 retro-font">
          <div>
            <h3 className="font-bold text-blue-400 mb-2">Left Player</h3>
            <p>W - Move Up</p>
            <p>S - Move Down</p>
          </div>
          <div>
            <h3 className="font-bold text-red-400 mb-2">Right Player</h3>
            <p>↑ - Move Up</p>
            <p>↓ - Move Down</p>
          </div>
        </div>

        <div className="mt-2 text-center text-xs text-cyan-400 retro-font">
          Space - Pause • First to 11 wins!
        </div>

        {gameOver && winner && (
          <div className="mt-4 text-center">
            <div className={`text-2xl font-bold mb-2 retro-font ${
              winner === 'Left Player' ? 'text-blue-400' : 'text-red-400'
            }`}>
              {winner} Wins!
            </div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Final Score: {leftScore} - {rightScore}</p>
              <p>Best Rally: {maxRally} hits</p>
              {maxRally > 15 && <p className="text-yellow-400">Epic rally battle!</p>}
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

export default Pong;