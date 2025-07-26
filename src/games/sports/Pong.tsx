import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface PongProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 10;
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

const Pong: React.FC<PongProps> = ({ onScoreUpdate }) => {
  const [leftPaddle, setLeftPaddle] = useState<Position>({ 
    x: 20, 
    y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 
  });
  const [rightPaddle, setRightPaddle] = useState<Position>({ 
    x: CANVAS_WIDTH - 30, 
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

  const resetBall = () => {
    setBall({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
    setBallVelocity({ 
      x: (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED, 
      y: (Math.random() - 0.5) * BALL_SPEED 
    });
  };

  const resetGame = () => {
    setLeftPaddle({ x: 20, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 });
    setRightPaddle({ x: CANVAS_WIDTH - 30, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 });
    setLeftScore(0);
    setRightScore(0);
    setGameOver(false);
    setPaused(false);
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
      }

      // Ball collision with left paddle
      if (checkCollision(newBall, leftPaddle) && ballVelocity.x < 0) {
        setBallVelocity(prev => ({ 
          x: -prev.x * 1.05, // Increase speed slightly
          y: prev.y + (Math.random() - 0.5) * 2 // Add some randomness
        }));
        newBall.x = leftPaddle.x + PADDLE_WIDTH;
      }

      // Ball collision with right paddle
      if (checkCollision(newBall, rightPaddle) && ballVelocity.x > 0) {
        setBallVelocity(prev => ({ 
          x: -prev.x * 1.05, // Increase speed slightly
          y: prev.y + (Math.random() - 0.5) * 2 // Add some randomness
        }));
        newBall.x = rightPaddle.x - BALL_SIZE;
      }

      // Ball goes off screen (scoring)
      if (newBall.x < 0) {
        setRightScore(prev => {
          const newScore = prev + 1;
          if (newScore >= 10) {
            setGameOver(true);
            if (onScoreUpdate) {
              onScoreUpdate(newScore * 100);
            }
          }
          return newScore;
        });
        resetBall();
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
      }

      if (newBall.x > CANVAS_WIDTH) {
        setLeftScore(prev => {
          const newScore = prev + 1;
          if (newScore >= 10) {
            setGameOver(true);
            if (onScoreUpdate) {
              onScoreUpdate(newScore * 100);
            }
          }
          return newScore;
        });
        resetBall();
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
      }

      return newBall;
    });
  }, [keys, leftPaddle, rightPaddle, ballVelocity, gameOver, paused]);

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
    const gameInterval = setInterval(updateGame, 16); // ~60 FPS
    return () => clearInterval(gameInterval);
  }, [updateGame]);

  const winner = leftScore >= 10 ? 'Left Player' : rightScore >= 10 ? 'Right Player' : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="bg-gray-800 rounded-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="text-white text-lg font-bold">
            {leftScore} - {rightScore}
          </div>
          <h2 className="text-white text-xl font-bold">Pong</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setPaused(!paused)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded"
              disabled={gameOver}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white p-2 rounded"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className="relative bg-black border-2 border-gray-600"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Center line */}
          <div
            className="absolute bg-gray-600"
            style={{
              left: CANVAS_WIDTH / 2 - 1,
              top: 0,
              width: 2,
              height: CANVAS_HEIGHT,
              backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 10px, #4b5563 10px, #4b5563 20px)'
            }}
          />

          {/* Left paddle */}
          <div
            className="absolute bg-white"
            style={{
              left: leftPaddle.x,
              top: leftPaddle.y,
              width: PADDLE_WIDTH,
              height: PADDLE_HEIGHT
            }}
          />

          {/* Right paddle */}
          <div
            className="absolute bg-white"
            style={{
              left: rightPaddle.x,
              top: rightPaddle.y,
              width: PADDLE_WIDTH,
              height: PADDLE_HEIGHT
            }}
          />

          {/* Ball */}
          <div
            className="absolute bg-white rounded-full"
            style={{
              left: ball.x,
              top: ball.y,
              width: BALL_SIZE,
              height: BALL_SIZE
            }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-8 text-center text-sm text-gray-400">
          <div>
            <h3 className="font-bold text-white mb-2">Left Player</h3>
            <p>W - Move Up</p>
            <p>S - Move Down</p>
          </div>
          <div>
            <h3 className="font-bold text-white mb-2">Right Player</h3>
            <p>↑ - Move Up</p>
            <p>↓ - Move Down</p>
          </div>
        </div>

        {gameOver && winner && (
          <div className="mt-4 text-center">
            <div className="text-green-400 text-xl font-bold mb-2">
              {winner} Wins!
            </div>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              Play Again
            </button>
          </div>
        )}

        {paused && !gameOver && (
          <div className="mt-4 text-center text-yellow-400 text-lg font-bold">
            PAUSED
          </div>
        )}
      </div>
    </div>
  );
};

export default Pong;