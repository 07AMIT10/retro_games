import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface AirHockeyProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const PADDLE_RADIUS = 30;
const PUCK_RADIUS = 15;

interface Position {
  x: number;
  y: number;
}

interface Velocity {
  dx: number;
  dy: number;
}

interface Paddle extends Position {}

interface Puck extends Position, Velocity {}

const AirHockey: React.FC<AirHockeyProps> = ({ onScoreUpdate }) => {
  const [playerPaddle, setPlayerPaddle] = useState<Paddle>({ 
    x: 100, 
    y: CANVAS_HEIGHT / 2 
  });
  const [computerPaddle, setComputerPaddle] = useState<Paddle>({ 
    x: CANVAS_WIDTH - 100, 
    y: CANVAS_HEIGHT / 2 
  });
  const [puck, setPuck] = useState<Puck>({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT / 2, 
    dx: 3, 
    dy: 2 
  });
  const [playerScore, setPlayerScore] = useState(0);
  const [computerScore, setComputerScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });

  const resetPuck = (winner: 'player' | 'computer') => {
    setPuck({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      dx: winner === 'player' ? -3 : 3,
      dy: (Math.random() - 0.5) * 4
    });
  };

  const resetGame = () => {
    setPlayerPaddle({ x: 100, y: CANVAS_HEIGHT / 2 });
    setComputerPaddle({ x: CANVAS_WIDTH - 100, y: CANVAS_HEIGHT / 2 });
    setPlayerScore(0);
    setComputerScore(0);
    setGameOver(false);
    setPaused(false);
    resetPuck('player');
  };

  const checkPaddleCollision = (puck: Puck, paddle: Paddle): boolean => {
    const dx = puck.x - paddle.x;
    const dy = puck.y - paddle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= PADDLE_RADIUS + PUCK_RADIUS;
  };

  const updateGame = useCallback(() => {
    if (gameOver || paused) return;

    // Update player paddle to follow mouse (with constraints)
    setPlayerPaddle(prev => {
      const maxX = CANVAS_WIDTH / 2 - PADDLE_RADIUS;
      return {
        x: Math.max(PADDLE_RADIUS, Math.min(maxX, mousePos.x)),
        y: Math.max(PADDLE_RADIUS, Math.min(CANVAS_HEIGHT - PADDLE_RADIUS, mousePos.y))
      };
    });

    // Update computer paddle AI
    setComputerPaddle(prev => {
      const minX = CANVAS_WIDTH / 2 + PADDLE_RADIUS;
      const targetY = puck.y;
      const speed = 4;
      
      let newY = prev.y;
      if (targetY < prev.y - 10) {
        newY = Math.max(PADDLE_RADIUS, prev.y - speed);
      } else if (targetY > prev.y + 10) {
        newY = Math.min(CANVAS_HEIGHT - PADDLE_RADIUS, prev.y + speed);
      }
      
      return {
        x: Math.max(minX, Math.min(CANVAS_WIDTH - PADDLE_RADIUS, prev.x)),
        y: newY
      };
    });

    // Update puck
    setPuck(prevPuck => {
      let newX = prevPuck.x + prevPuck.dx;
      let newY = prevPuck.y + prevPuck.dy;
      let newDx = prevPuck.dx;
      let newDy = prevPuck.dy;

      // Wall collisions (top and bottom)
      if (newY <= PUCK_RADIUS || newY >= CANVAS_HEIGHT - PUCK_RADIUS) {
        newDy = -newDy;
        newY = Math.max(PUCK_RADIUS, Math.min(CANVAS_HEIGHT - PUCK_RADIUS, newY));
      }

      // Player paddle collision
      if (checkPaddleCollision({ x: newX, y: newY, dx: newDx, dy: newDy }, playerPaddle)) {
        const dx = newX - playerPaddle.x;
        const dy = newY - playerPaddle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          const speed = Math.sqrt(newDx * newDx + newDy * newDy) * 1.1;
          newDx = (dx / distance) * speed;
          newDy = (dy / distance) * speed;
        }
      }

      // Computer paddle collision
      if (checkPaddleCollision({ x: newX, y: newY, dx: newDx, dy: newDy }, computerPaddle)) {
        const dx = newX - computerPaddle.x;
        const dy = newY - computerPaddle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          const speed = Math.sqrt(newDx * newDx + newDy * newDy) * 1.1;
          newDx = (dx / distance) * speed;
          newDy = (dy / distance) * speed;
        }
      }

      // Scoring
      if (newX < 0) {
        setComputerScore(prev => {
          const newScore = prev + 1;
          if (newScore >= 7) {
            setGameOver(true);
          }
          return newScore;
        });
        resetPuck('computer');
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: -3, dy: 2 };
      }

      if (newX > CANVAS_WIDTH) {
        setPlayerScore(prev => {
          const newScore = prev + 1;
          if (newScore >= 7) {
            setGameOver(true);
            if (onScoreUpdate) onScoreUpdate(newScore * 100);
          }
          return newScore;
        });
        resetPuck('player');
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: 3, dy: 2 };
      }

      // Apply friction
      newDx *= 0.998;
      newDy *= 0.998;

      return { x: newX, y: newY, dx: newDx, dy: newDy };
    });
  }, [mousePos, puck, playerPaddle, computerPaddle, gameOver, paused, onScoreUpdate]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setPaused(prev => !prev);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  useEffect(() => {
    const gameInterval = setInterval(updateGame, 16);
    return () => clearInterval(gameInterval);
  }, [updateGame]);

  const winner = playerScore >= 7 ? 'Player' : computerScore >= 7 ? 'Computer' : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">AIR HOCKEY</div>
          </div>
          <div className="text-white text-xl font-bold retro-font">
            {playerScore} - {computerScore}
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
          className="relative bg-white border-2 border-gray-600"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Center line */}
          <div
            className="absolute bg-red-400"
            style={{
              left: CANVAS_WIDTH / 2 - 1,
              top: 0,
              width: 2,
              height: CANVAS_HEIGHT
            }}
          />

          {/* Goals */}
          <div
            className="absolute bg-blue-600"
            style={{
              left: 0,
              top: CANVAS_HEIGHT / 2 - 50,
              width: 10,
              height: 100
            }}
          />
          <div
            className="absolute bg-red-600"
            style={{
              left: CANVAS_WIDTH - 10,
              top: CANVAS_HEIGHT / 2 - 50,
              width: 10,
              height: 100
            }}
          />

          {/* Player paddle */}
          <div
            className="absolute bg-blue-500 rounded-full border-2 border-blue-400"
            style={{
              left: playerPaddle.x - PADDLE_RADIUS,
              top: playerPaddle.y - PADDLE_RADIUS,
              width: PADDLE_RADIUS * 2,
              height: PADDLE_RADIUS * 2
            }}
          />

          {/* Computer paddle */}
          <div
            className="absolute bg-red-500 rounded-full border-2 border-red-400"
            style={{
              left: computerPaddle.x - PADDLE_RADIUS,
              top: computerPaddle.y - PADDLE_RADIUS,
              width: PADDLE_RADIUS * 2,
              height: PADDLE_RADIUS * 2
            }}
          />

          {/* Puck */}
          <div
            className="absolute bg-black rounded-full border-2 border-gray-600"
            style={{
              left: puck.x - PUCK_RADIUS,
              top: puck.y - PUCK_RADIUS,
              width: PUCK_RADIUS * 2,
              height: PUCK_RADIUS * 2
            }}
          />
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Move mouse to control your paddle • First to 7 goals wins!</p>
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

export default AirHockey;