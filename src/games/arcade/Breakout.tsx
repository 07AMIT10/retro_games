import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PADDLE_WIDTH = 80;
const PADDLE_HEIGHT = 15;
const BALL_SIZE = 12;
const BRICK_WIDTH = 50;
const BRICK_HEIGHT = 20;
const BRICK_ROWS = 8;
const BRICK_COLS = 12;

interface Position {
  x: number;
  y: number;
}

interface Velocity {
  dx: number;
  dy: number;
}

interface Ball extends Position, Velocity {}

interface Brick extends Position {
  active: boolean;
  color: string;
  points: number;
}

interface BreakoutProps {
  onScoreUpdate?: (score: number) => void;
}

const Breakout: React.FC<BreakoutProps> = ({ onScoreUpdate }) => {
  const [paddle, setPaddle] = useState<Position>({ 
    x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2, 
    y: CANVAS_HEIGHT - 30 
  });
  const [ball, setBall] = useState<Ball>({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT / 2, 
    dx: 4, 
    dy: -4 
  });
  const [bricks, setBricks] = useState<Brick[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ballLaunched, setBallLaunched] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());

  const brickColors = [
    { color: '#ff4444', points: 70 },
    { color: '#ff8844', points: 60 },
    { color: '#ffff44', points: 50 },
    { color: '#88ff44', points: 40 },
    { color: '#44ff88', points: 30 },
    { color: '#44ffff', points: 20 },
    { color: '#4488ff', points: 10 },
    { color: '#8844ff', points: 10 }
  ];

  const createBricks = useCallback(() => {
    const newBricks: Brick[] = [];
    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        const colorInfo = brickColors[row % brickColors.length];
        newBricks.push({
          x: col * BRICK_WIDTH,
          y: row * BRICK_HEIGHT + 50,
          active: true,
          color: colorInfo.color,
          points: colorInfo.points
        });
      }
    }
    return newBricks;
  }, []);

  const launchBall = () => {
    if (!ballLaunched) {
      setBallLaunched(true);
      setBall(prev => ({
        ...prev,
        dx: (Math.random() - 0.5) * 8,
        dy: -Math.abs(prev.dy)
      }));
    }
  };

  const updatePaddle = useCallback(() => {
    if (gameOver || paused) return;

    setPaddle(prev => {
      let newX = prev.x;

      if (keys.has('ArrowLeft')) {
        newX = Math.max(0, prev.x - 8);
      }
      if (keys.has('ArrowRight')) {
        newX = Math.min(CANVAS_WIDTH - PADDLE_WIDTH, prev.x + 8);
      }

      return { ...prev, x: newX };
    });
  }, [keys, gameOver, paused]);

  const updateBall = useCallback(() => {
    if (gameOver || paused || !ballLaunched) return;

    setBall(prev => {
      let newX = prev.x + prev.dx;
      let newY = prev.y + prev.dy;
      let newDx = prev.dx;
      let newDy = prev.dy;

      // Wall collisions
      if (newX <= BALL_SIZE / 2 || newX >= CANVAS_WIDTH - BALL_SIZE / 2) {
        newDx = -newDx;
        newX = Math.max(BALL_SIZE / 2, Math.min(CANVAS_WIDTH - BALL_SIZE / 2, newX));
      }

      if (newY <= BALL_SIZE / 2) {
        newDy = -newDy;
        newY = BALL_SIZE / 2;
      }

      // Paddle collision
      if (
        newY + BALL_SIZE / 2 >= paddle.y &&
        newY - BALL_SIZE / 2 <= paddle.y + PADDLE_HEIGHT &&
        newX >= paddle.x &&
        newX <= paddle.x + PADDLE_WIDTH &&
        newDy > 0
      ) {
        newDy = -Math.abs(newDy);
        
        // Add angle based on where ball hits paddle
        const hitPos = (newX - paddle.x) / PADDLE_WIDTH - 0.5;
        newDx += hitPos * 3;
        
        // Limit ball speed
        const speed = Math.sqrt(newDx ** 2 + newDy ** 2);
        if (speed > 8) {
          newDx = (newDx / speed) * 8;
          newDy = (newDy / speed) * 8;
        }
      }

      // Ball falls below paddle
      if (newY > CANVAS_HEIGHT) {
        setLives(prevLives => {
          const newLives = prevLives - 1;
          if (newLives <= 0) {
            setGameOver(true);
            if (onScoreUpdate) onScoreUpdate(score);
          }
          return newLives;
        });
        
        setBallLaunched(false);
        return {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT / 2,
          dx: 4,
          dy: -4
        };
      }

      return { x: newX, y: newY, dx: newDx, dy: newDy };
    });
  }, [gameOver, paused, ballLaunched, paddle, score, onScoreUpdate]);

  const checkBrickCollisions = useCallback(() => {
    if (gameOver || paused || !ballLaunched) return;

    setBricks(prevBricks => {
      let newBricks = [...prevBricks];
      let pointsEarned = 0;
      let ballBounced = false;

      const ballRect = {
        left: ball.x - BALL_SIZE / 2,
        right: ball.x + BALL_SIZE / 2,
        top: ball.y - BALL_SIZE / 2,
        bottom: ball.y + BALL_SIZE / 2
      };

      newBricks.forEach((brick, index) => {
        if (!brick.active || ballBounced) return;

        const brickRect = {
          left: brick.x,
          right: brick.x + BRICK_WIDTH,
          top: brick.y,
          bottom: brick.y + BRICK_HEIGHT
        };

        if (
          ballRect.right >= brickRect.left &&
          ballRect.left <= brickRect.right &&
          ballRect.bottom >= brickRect.top &&
          ballRect.top <= brickRect.bottom
        ) {
          newBricks[index] = { ...brick, active: false };
          pointsEarned += brick.points;
          ballBounced = true;

          // Determine bounce direction
          const overlapLeft = ballRect.right - brickRect.left;
          const overlapRight = brickRect.right - ballRect.left;
          const overlapTop = ballRect.bottom - brickRect.top;
          const overlapBottom = brickRect.bottom - ballRect.top;

          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

          setBall(prevBall => {
            if (minOverlap === overlapLeft || minOverlap === overlapRight) {
              return { ...prevBall, dx: -prevBall.dx };
            } else {
              return { ...prevBall, dy: -prevBall.dy };
            }
          });
        }
      });

      if (pointsEarned > 0) {
        setScore(prev => prev + pointsEarned);
      }

      // Check if all bricks destroyed
      const activeBricks = newBricks.filter(brick => brick.active);
      if (activeBricks.length === 0) {
        setLevel(prev => prev + 1);
        setBallLaunched(false);
        setBall({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: 4 + level, dy: -4 - level });
        return createBricks();
      }

      return newBricks;
    });
  }, [ball, gameOver, paused, ballLaunched, level, createBricks, score]);

  const resetGame = () => {
    setPaddle({ x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2, y: CANVAS_HEIGHT - 30 });
    setBall({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: 4, dy: -4 });
    setBricks(createBricks());
    setScore(0);
    setLives(3);
    setLevel(1);
    setBallLaunched(false);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (bricks.length === 0) {
      setBricks(createBricks());
    }
  }, [bricks.length, createBricks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === ' ') {
        if (paused) {
          setPaused(false);
        } else if (!ballLaunched) {
          launchBall();
        } else {
          setPaused(true);
        }
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
  }, [ballLaunched, paused]);

  useEffect(() => {
    const gameInterval = setInterval(() => {
      updatePaddle();
      updateBall();
      checkBrickCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePaddle, updateBall, checkBrickCollisions]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">SCORE: {score}</div>
            <div className="text-sm">LIVES: {lives} | LEVEL: {level}</div>
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
          className="relative bg-black border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Bricks */}
          {bricks.filter(brick => brick.active).map((brick, index) => (
            <div
              key={index}
              className="absolute border border-gray-400"
              style={{
                left: brick.x,
                top: brick.y,
                width: BRICK_WIDTH,
                height: BRICK_HEIGHT,
                backgroundColor: brick.color
              }}
            />
          ))}

          {/* Paddle */}
          <div
            className="absolute bg-cyan-400 rounded-t"
            style={{
              left: paddle.x,
              top: paddle.y,
              width: PADDLE_WIDTH,
              height: PADDLE_HEIGHT
            }}
          />

          {/* Ball */}
          <div
            className="absolute bg-white rounded-full"
            style={{
              left: ball.x - BALL_SIZE / 2,
              top: ball.y - BALL_SIZE / 2,
              width: BALL_SIZE,
              height: BALL_SIZE
            }}
          />

          {/* Launch instruction */}
          {!ballLaunched && !gameOver && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-yellow-400 text-lg font-bold retro-font bg-black bg-opacity-75 px-4 py-2 rounded">
                PRESS SPACE TO LAUNCH
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Break all bricks to advance! Use paddle angle for ball control.</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">GAME OVER!</div>
            <p className="text-cyan-400 mb-4 retro-font">Score: {score}</p>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-bold border-2 border-cyan-400"
            >
              PLAY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Breakout;