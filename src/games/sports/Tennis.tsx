import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface TennisProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const PADDLE_WIDTH = 15;
const PADDLE_HEIGHT = 60;
const BALL_SIZE = 10;

interface Position {
  x: number;
  y: number;
}

interface Velocity {
  dx: number;
  dy: number;
}

interface Player extends Position {
  score: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const Tennis: React.FC<TennisProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Player>({ 
    x: 50, 
    y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    score: 0
  });
  const [computer, setComputer] = useState<Player>({ 
    x: CANVAS_WIDTH - 70, 
    y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    score: 0
  });
  const [ball, setBall] = useState<Position>({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT / 2 
  });
  const [ballVelocity, setBallVelocity] = useState<Velocity>({ dx: 4, dy: 2 });
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [rally, setRally] = useState(0);
  const [maxRally, setMaxRally] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [ballTrail, setBallTrail] = useState<Position[]>([]);
  const [difficulty, setDifficulty] = useState(1);

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

  const resetBall = (winner: 'player' | 'computer') => {
    setBall({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
    setBallVelocity({ 
      dx: winner === 'player' ? 4 : -4, 
      dy: (Math.random() - 0.5) * 4 
    });
    setMaxRally(prev => Math.max(prev, rally));
    setRally(0);
    setBallTrail([]);
  };

  const resetGame = () => {
    setPlayer({ x: 50, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, score: 0 });
    setComputer({ x: CANVAS_WIDTH - 70, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, score: 0 });
    setGameOver(false);
    setPaused(false);
    setMaxRally(0);
    setParticles([]);
    setDifficulty(1);
    resetBall('player');
  };

  const checkCollision = (ballPos: Position, paddlePos: Position): boolean => {
    return (
      ballPos.x - BALL_SIZE / 2 < paddlePos.x + PADDLE_WIDTH &&
      ballPos.x + BALL_SIZE / 2 > paddlePos.x &&
      ballPos.y - BALL_SIZE / 2 < paddlePos.y + PADDLE_HEIGHT &&
      ballPos.y + BALL_SIZE / 2 > paddlePos.y
    );
  };

  const updateGame = useCallback(() => {
    if (gameOver || paused) return;

    // Update player position
    setPlayer(prev => {
      let newY = prev.y;
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) {
        newY = Math.max(0, prev.y - 6);
      }
      if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) {
        newY = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, prev.y + 6);
      }
      return { ...prev, y: newY };
    });

    // Update computer AI with adaptive difficulty
    setComputer(prev => {
      const ballCenterY = ball.y;
      const paddleCenterY = prev.y + PADDLE_HEIGHT / 2;
      const baseSpeed = 3 + difficulty * 0.5;
      const prediction = ballCenterY + ballVelocity.dy * 10; // Predict ball movement
      
      let newY = prev.y;
      if (prediction < paddleCenterY - 15) {
        newY = Math.max(0, prev.y - baseSpeed);
      } else if (prediction > paddleCenterY + 15) {
        newY = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, prev.y + baseSpeed);
      }
      
      return { ...prev, y: newY };
    });

    // Update ball trail
    setBallTrail(prev => {
      const newTrail = [...prev, { x: ball.x, y: ball.y }];
      return newTrail.slice(-10); // Keep last 10 positions
    });

    // Update ball
    setBall(prevBall => {
      const newBall = {
        x: prevBall.x + ballVelocity.dx,
        y: prevBall.y + ballVelocity.dy
      };

      // Top and bottom wall collision
      if (newBall.y <= BALL_SIZE / 2 || newBall.y >= CANVAS_HEIGHT - BALL_SIZE / 2) {
        setBallVelocity(prev => ({ ...prev, dy: -prev.dy }));
        newBall.y = Math.max(BALL_SIZE / 2, Math.min(CANVAS_HEIGHT - BALL_SIZE / 2, newBall.y));
        createParticles(newBall.x, newBall.y, '#22d3ee', 5);
      }

      // Player paddle collision
      if (checkCollision(newBall, player) && ballVelocity.dx < 0) {
        const hitPosition = (newBall.y - (player.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
        setBallVelocity(prev => ({ 
          dx: -prev.dx * 1.05,
          dy: prev.dy + hitPosition * 3
        }));
        setRally(prev => prev + 1);
        setDifficulty(prev => Math.min(3, prev + 0.05));
        newBall.x = player.x + PADDLE_WIDTH + BALL_SIZE / 2;
        createParticles(newBall.x, newBall.y, '#60a5fa', 8);
      }

      // Computer paddle collision
      if (checkCollision(newBall, computer) && ballVelocity.dx > 0) {
        const hitPosition = (newBall.y - (computer.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
        setBallVelocity(prev => ({ 
          dx: -prev.dx * 1.05,
          dy: prev.dy + hitPosition * 3
        }));
        setRally(prev => prev + 1);
        newBall.x = computer.x - BALL_SIZE / 2;
        createParticles(newBall.x, newBall.y, '#f87171', 8);
      }

      // Scoring
      if (newBall.x < 0) {
        setComputer(prev => {
          const newScore = prev.score + 1;
          if (newScore >= 11) {
            setGameOver(true);
          }
          return { ...prev, score: newScore };
        });
        createParticles(0, newBall.y, '#f87171', 15);
        resetBall('computer');
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
      }

      if (newBall.x > CANVAS_WIDTH) {
        setPlayer(prev => {
          const rallyBonus = Math.floor(rally / 5);
          const newScore = prev.score + 1 + rallyBonus;
          if (newScore >= 11) {
            setGameOver(true);
            if (onScoreUpdate) onScoreUpdate(newScore * 10 + maxRally * 5);
          }
          return { ...prev, score: newScore };
        });
        createParticles(CANVAS_WIDTH, newBall.y, '#60a5fa', 15);
        resetBall('player');
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
      }

      return newBall;
    });
  }, [keys, ball, ballVelocity, player, computer, gameOver, paused, rally, maxRally, difficulty, onScoreUpdate]);

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

  const winner = player.score >= 11 ? 'Player' : computer.score >= 11 ? 'Computer' : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">TENNIS</div>
            <div className="text-sm">Rally: {rally} | Best: {maxRally}</div>
            <div className="text-sm">Difficulty: {difficulty.toFixed(1)}</div>
          </div>
          <div className="text-white text-xl font-bold retro-font">
            {player.score} - {computer.score}
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
          className="relative bg-gradient-to-b from-green-400 to-green-600 border-4 border-gray-800 rounded-lg overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Court lines */}
          <div
            className="absolute bg-white shadow-sm"
            style={{
              left: CANVAS_WIDTH / 2 - 1,
              top: 0,
              width: 2,
              height: CANVAS_HEIGHT
            }}
          />
          
          {/* Service lines */}
          <div
            className="absolute bg-white opacity-80"
            style={{
              left: CANVAS_WIDTH / 4 - 1,
              top: CANVAS_HEIGHT / 4,
              width: 2,
              height: CANVAS_HEIGHT / 2
            }}
          />
          <div
            className="absolute bg-white opacity-80"
            style={{
              left: (CANVAS_WIDTH * 3) / 4 - 1,
              top: CANVAS_HEIGHT / 4,
              width: 2,
              height: CANVAS_HEIGHT / 2
            }}
          />

          {/* Court boundaries */}
          <div className="absolute inset-0 border-2 border-white opacity-60 rounded-lg" />

          {/* Ball trail */}
          {ballTrail.map((pos, index) => (
            <div
              key={index}
              className="absolute bg-yellow-300 rounded-full"
              style={{
                left: pos.x - 3,
                top: pos.y - 3,
                width: 6,
                height: 6,
                opacity: (index / ballTrail.length) * 0.5
              }}
            />
          ))}

          {/* Player paddle */}
          <div
            className="absolute bg-gradient-to-r from-blue-400 to-blue-600 border-2 border-blue-800 rounded shadow-lg"
            style={{
              left: player.x,
              top: player.y,
              width: PADDLE_WIDTH,
              height: PADDLE_HEIGHT
            }}
          />

          {/* Computer paddle */}
          <div
            className="absolute bg-gradient-to-r from-red-400 to-red-600 border-2 border-red-800 rounded shadow-lg"
            style={{
              left: computer.x,
              top: computer.y,
              width: PADDLE_WIDTH,
              height: PADDLE_HEIGHT
            }}
          />

          {/* Ball */}
          <div
            className="absolute bg-gradient-to-br from-yellow-300 to-yellow-500 border-2 border-yellow-600 rounded-full shadow-lg"
            style={{
              left: ball.x - BALL_SIZE / 2,
              top: ball.y - BALL_SIZE / 2,
              width: BALL_SIZE,
              height: BALL_SIZE,
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
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
          {rally > 5 && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
              <div className="bg-black bg-opacity-75 px-3 py-1 rounded border border-yellow-400">
                <div className="text-yellow-400 font-bold text-sm retro-font">
                  {rally} HIT RALLY!
                </div>
              </div>
            </div>
          )}

          {/* Speed indicator */}
          <div className="absolute top-4 right-4 bg-black bg-opacity-75 p-2 rounded border border-cyan-400">
            <div className="text-cyan-400 text-xs retro-font">
              Speed: {Math.abs(ballVelocity.dx).toFixed(1)}
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>↑↓ or WASD - Move Paddle • Space - Pause • First to 11 wins!</p>
        </div>

        {gameOver && winner && (
          <div className="mt-4 text-center">
            <div className={`text-2xl font-bold mb-2 retro-font ${
              winner === 'Player' ? 'text-green-400' : 'text-red-400'
            }`}>
              {winner} Wins!
            </div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Final Score: {player.score} - {computer.score}</p>
              <p>Best Rally: {maxRally} hits</p>
              {winner === 'Player' && maxRally > 10 && <p className="text-yellow-400">Amazing rallies!</p>}
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

export default Tennis;