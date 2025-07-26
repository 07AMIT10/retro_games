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

interface Position {
  x: number;
  y: number;
}

interface Ball extends Position {
  vx: number;
  vy: number;
  shooting: boolean;
}

const Basketball: React.FC<BasketballProps> = ({ onScoreUpdate }) => {
  const [ball, setBall] = useState<Ball>({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT - 50, 
    vx: 0, 
    vy: 0, 
    shooting: false 
  });
  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);

  const hoopPos = { x: CANVAS_WIDTH / 2 - HOOP_WIDTH / 2, y: 80 };

  const shoot = useCallback((targetX: number, targetY: number) => {
    if (ball.shooting || gameOver || paused) return;

    const dx = targetX - ball.x;
    const dy = targetY - ball.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const speed = Math.min(15, distance / 30);
    setBall(prev => ({
      ...prev,
      vx: (dx / distance) * speed,
      vy: (dy / distance) * speed,
      shooting: true
    }));

    setShots(prev => prev + 1);
  }, [ball, gameOver, paused]);

  const updateBall = useCallback(() => {
    if (!ball.shooting || gameOver || paused) return;

    setBall(prev => {
      let newX = prev.x + prev.vx;
      let newY = prev.y + prev.vy;
      let newVx = prev.vx;
      let newVy = prev.vy + 0.5; // gravity

      // Wall bounces
      if (newX <= BALL_SIZE/2 || newX >= CANVAS_WIDTH - BALL_SIZE/2) {
        newVx *= -0.7;
        newX = Math.max(BALL_SIZE/2, Math.min(CANVAS_WIDTH - BALL_SIZE/2, newX));
      }

      // Check hoop collision
      if (
        newX > hoopPos.x && 
        newX < hoopPos.x + HOOP_WIDTH &&
        newY > hoopPos.y && 
        newY < hoopPos.y + HOOP_HEIGHT &&
        prev.vy > 0
      ) {
        setScore(prevScore => {
          const newScore = prevScore + 2;
          if (onScoreUpdate) onScoreUpdate(newScore);
          return newScore;
        });
        
        // Reset ball
        return {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT - 50,
          vx: 0,
          vy: 0,
          shooting: false
        };
      }

      // Reset if ball goes off screen
      if (newY > CANVAS_HEIGHT + 50) {
        return {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT - 50,
          vx: 0,
          vy: 0,
          shooting: false
        };
      }

      return { x: newX, y: newY, vx: newVx, vy: newVy, shooting: true };
    });
  }, [ball.shooting, gameOver, paused, hoopPos, onScoreUpdate]);

  const resetGame = () => {
    setBall({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50, vx: 0, vy: 0, shooting: false });
    setScore(0);
    setShots(0);
    setTimeLeft(60);
    setGameOver(false);
    setPaused(false);
    setPower(0);
    setCharging(false);
  };

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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    };

    const handleMouseDown = () => {
      if (!ball.shooting && !gameOver && !paused) {
        setCharging(true);
        setPower(0);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (charging && !ball.shooting && !gameOver && !paused) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        shoot(e.clientX - rect.left, e.clientY - rect.top);
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
  }, [ball.shooting, charging, gameOver, paused, shoot]);

  useEffect(() => {
    if (charging) {
      const interval = setInterval(() => {
        setPower(prev => Math.min(100, prev + 2));
      }, 50);
      return () => clearInterval(interval);
    }
  }, [charging]);

  const accuracy = shots > 0 ? Math.round((score / 2 / shots) * 100) : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">SCORE: {score}</div>
            <div className="text-sm">TIME: {timeLeft}s | SHOTS: {shots}</div>
            <div className="text-sm">ACCURACY: {accuracy}%</div>
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
          className="relative bg-blue-900 border-2 border-gray-600 overflow-hidden cursor-crosshair"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Basketball Court */}
          <div className="absolute inset-0 bg-gradient-to-b from-orange-200 to-orange-300" />
          
          {/* Hoop */}
          <div
            className="absolute bg-red-600 border-2 border-red-500"
            style={{
              left: hoopPos.x,
              top: hoopPos.y,
              width: HOOP_WIDTH,
              height: HOOP_HEIGHT
            }}
          />
          
          {/* Backboard */}
          <div
            className="absolute bg-white border-2 border-gray-400"
            style={{
              left: hoopPos.x + HOOP_WIDTH / 2 - 5,
              top: hoopPos.y - 40,
              width: 10,
              height: 50
            }}
          />

          {/* Ball */}
          <div
            className="absolute bg-orange-600 border-2 border-orange-500 rounded-full"
            style={{
              left: ball.x - BALL_SIZE / 2,
              top: ball.y - BALL_SIZE / 2,
              width: BALL_SIZE,
              height: BALL_SIZE
            }}
          />

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
            </svg>
          )}

          {/* Power meter */}
          {charging && (
            <div className="absolute top-4 left-4 bg-gray-800 border border-cyan-400 p-2 rounded">
              <div className="text-cyan-400 text-xs retro-font mb-1">POWER</div>
              <div className="w-20 h-3 bg-gray-600 border border-gray-500">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-red-400"
                  style={{ width: `${power}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Click and hold to aim, release to shoot! Score as many baskets as possible!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">TIME'S UP!</div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Final Score: {score}</p>
              <p>Shots Taken: {shots}</p>
              <p>Accuracy: {accuracy}%</p>
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