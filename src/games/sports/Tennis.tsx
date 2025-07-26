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

  const resetBall = (winner: 'player' | 'computer') => {
    setBall({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
    setBallVelocity({ 
      dx: winner === 'player' ? 4 : -4, 
      dy: (Math.random() - 0.5) * 4 
    });
    setRally(0);
  };

  const resetGame = () => {
    setPlayer({ x: 50, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, score: 0 });
    setComputer({ x: CANVAS_WIDTH - 70, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, score: 0 });
    setGameOver(false);
    setPaused(false);
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
      if (keys.has('ArrowUp')) {
        newY = Math.max(0, prev.y - 6);
      }
      if (keys.has('ArrowDown')) {
        newY = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, prev.y + 6);
      }
      return { ...prev, y: newY };
    });

    // Update computer AI
    setComputer(prev => {
      const ballCenterY = ball.y;
      const paddleCenterY = prev.y + PADDLE_HEIGHT / 2;
      const speed = 4;
      
      let newY = prev.y;
      if (ballCenterY < paddleCenterY - 10) {
        newY = Math.max(0, prev.y - speed);
      } else if (ballCenterY > paddleCenterY + 10) {
        newY = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, prev.y + speed);
      }
      
      return { ...prev, y: newY };
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
      }

      // Player paddle collision
      if (checkCollision(newBall, player) && ballVelocity.dx < 0) {
        setBallVelocity(prev => ({ 
          dx: -prev.dx * 1.05,
          dy: prev.dy + (Math.random() - 0.5) * 2
        }));
        setRally(prev => prev + 1);
        newBall.x = player.x + PADDLE_WIDTH + BALL_SIZE / 2;
      }

      // Computer paddle collision
      if (checkCollision(newBall, computer) && ballVelocity.dx > 0) {
        setBallVelocity(prev => ({ 
          dx: -prev.dx * 1.05,
          dy: prev.dy + (Math.random() - 0.5) * 2
        }));
        setRally(prev => prev + 1);
        newBall.x = computer.x - BALL_SIZE / 2;
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
        resetBall('computer');
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
      }

      if (newBall.x > CANVAS_WIDTH) {
        setPlayer(prev => {
          const newScore = prev.score + 1 + rally;
          if (newScore >= 11) {
            setGameOver(true);
            if (onScoreUpdate) onScoreUpdate(newScore * 10);
          }
          return { ...prev, score: newScore };
        });
        resetBall('player');
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
      }

      return newBall;
    });
  }, [keys, ball, ballVelocity, player, computer, gameOver, paused, rally, onScoreUpdate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === ' ') {
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
            <div className="text-sm">Rally: {rally}</div>
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
          className="relative bg-green-600 border-2 border-gray-600"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Court lines */}
          <div
            className="absolute bg-white"
            style={{
              left: CANVAS_WIDTH / 2 - 1,
              top: 0,
              width: 2,
              height: CANVAS_HEIGHT
            }}
          />
          
          {/* Service lines */}
          <div
            className="absolute bg-white"
            style={{
              left: CANVAS_WIDTH / 4,
              top: CANVAS_HEIGHT / 4,
              width: 2,
              height: CANVAS_HEIGHT / 2
            }}
          />
          <div
            className="absolute bg-white"
            style={{
              left: (CANVAS_WIDTH * 3) / 4,
              top: CANVAS_HEIGHT / 4,
              width: 2,
              height: CANVAS_HEIGHT / 2
            }}
          />

          {/* Player paddle */}
          <div
            className="absolute bg-blue-400"
            style={{
              left: player.x,
              top: player.y,
              width: PADDLE_WIDTH,
              height: PADDLE_HEIGHT
            }}
          />

          {/* Computer paddle */}
          <div
            className="absolute bg-red-400"
            style={{
              left: computer.x,
              top: computer.y,
              width: PADDLE_WIDTH,
              height: PADDLE_HEIGHT
            }}
          />

          {/* Ball */}
          <div
            className="absolute bg-yellow-400 rounded-full"
            style={{
              left: ball.x - BALL_SIZE / 2,
              top: ball.y - BALL_SIZE / 2,
              width: BALL_SIZE,
              height: BALL_SIZE
            }}
          />
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>↑↓ - Move Paddle • Space - Pause • First to 11 wins!</p>
        </div>

        {gameOver && winner && (
          <div className="mt-4 text-center">
            <div className={`text-2xl font-bold mb-2 retro-font ${
              winner === 'Player' ? 'text-green-400' : 'text-red-400'
            }`}>
              {winner} Wins!
            </div>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded border border-cyan-400"
            >
              Play Again
            </button>
          </div>
        )}

        {paused && !gameOver && (
          <div className="mt-4 text-center text-yellow-400 text-lg font-bold retro-font">
            PAUSED
          </div>
        )}
      </div>
    </div>
  );
};

export default Tennis;