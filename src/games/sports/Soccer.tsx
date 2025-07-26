import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface SoccerProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const BALL_RADIUS = 12;
const GOAL_WIDTH = 120;
const GOAL_HEIGHT = 60;

interface Position {
  x: number;
  y: number;
}

interface Ball extends Position {
  vx: number;
  vy: number;
  moving: boolean;
}

const Soccer: React.FC<SoccerProps> = ({ onScoreUpdate }) => {
  const [ball, setBall] = useState<Ball>({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT - 100, 
    vx: 0, 
    vy: 0, 
    moving: false 
  });
  const [goals, setGoals] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [gameTime, setGameTime] = useState(30);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const [goalkeeper, setGoalkeeper] = useState<Position>({ 
    x: CANVAS_WIDTH / 2, 
    y: 40 
  });

  const goalPos = { 
    x: CANVAS_WIDTH / 2 - GOAL_WIDTH / 2, 
    y: 20 
  };

  const kickBall = useCallback((targetX: number, targetY: number, power: number) => {
    if (ball.moving || gameOver || paused) return;

    const dx = targetX - ball.x;
    const dy = targetY - ball.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const speed = (power / 100) * 12;
    setBall(prev => ({
      ...prev,
      vx: (dx / distance) * speed,
      vy: (dy / distance) * speed,
      moving: true
    }));

    setAttempts(prev => prev + 1);
  }, [ball, gameOver, paused]);

  const updateBall = useCallback(() => {
    if (!ball.moving || gameOver || paused) return;

    setBall(prev => {
      let newX = prev.x + prev.vx;
      let newY = prev.y + prev.vy;
      let newVx = prev.vx * 0.98; // friction
      let newVy = prev.vy * 0.98;

      // Boundary collisions
      if (newX <= BALL_RADIUS || newX >= CANVAS_WIDTH - BALL_RADIUS) {
        newVx = -newVx * 0.7;
        newX = Math.max(BALL_RADIUS, Math.min(CANVAS_WIDTH - BALL_RADIUS, newX));
      }

      if (newY >= CANVAS_HEIGHT - BALL_RADIUS) {
        newVy = -newVy * 0.7;
        newY = CANVAS_HEIGHT - BALL_RADIUS;
      }

      // Goalkeeper collision
      const goalkeeperRadius = 20;
      const distToGoalkeeper = Math.sqrt(
        (newX - goalkeeper.x) ** 2 + (newY - goalkeeper.y) ** 2
      );

      if (distToGoalkeeper <= BALL_RADIUS + goalkeeperRadius) {
        // Ball hits goalkeeper
        const angle = Math.atan2(newY - goalkeeper.y, newX - goalkeeper.x);
        newVx = Math.cos(angle) * 8;
        newVy = Math.sin(angle) * 8;
      }

      // Goal collision
      if (
        newX >= goalPos.x && 
        newX <= goalPos.x + GOAL_WIDTH &&
        newY >= goalPos.y && 
        newY <= goalPos.y + GOAL_HEIGHT
      ) {
        // GOAL!
        setGoals(prev => prev + 1);
        
        // Reset ball
        setTimeout(() => {
          setBall({
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT - 100,
            vx: 0,
            vy: 0,
            moving: false
          });
        }, 1000);

        return { x: newX, y: newY, vx: 0, vy: 0, moving: false };
      }

      // Top wall collision (missed goal)
      if (newY <= BALL_RADIUS) {
        newVy = -newVy * 0.7;
        newY = BALL_RADIUS;
      }

      // Stop ball if moving too slowly
      if (Math.abs(newVx) < 0.2 && Math.abs(newVy) < 0.2) {
        setTimeout(() => {
          setBall({
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT - 100,
            vx: 0,
            vy: 0,
            moving: false
          });
        }, 1000);

        return { x: newX, y: newY, vx: 0, vy: 0, moving: false };
      }

      return { x: newX, y: newY, vx: newVx, vy: newVy, moving: true };
    });
  }, [ball.moving, gameOver, paused, goalkeeper, goalPos]);

  const updateGoalkeeper = useCallback(() => {
    if (gameOver || paused) return;

    setGoalkeeper(prev => {
      const ballDirection = ball.moving ? ball.x : CANVAS_WIDTH / 2;
      const speed = 3;
      const leftBound = goalPos.x + 20;
      const rightBound = goalPos.x + GOAL_WIDTH - 20;
      
      let newX = prev.x;
      
      if (ballDirection < prev.x - 10 && newX > leftBound) {
        newX = Math.max(leftBound, prev.x - speed);
      } else if (ballDirection > prev.x + 10 && newX < rightBound) {
        newX = Math.min(rightBound, prev.x + speed);
      }
      
      return { ...prev, x: newX };
    });
  }, [ball, gameOver, paused, goalPos]);

  const resetGame = () => {
    setBall({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100, vx: 0, vy: 0, moving: false });
    setGoals(0);
    setAttempts(0);
    setGameTime(30);
    setPower(0);
    setCharging(false);
    setGoalkeeper({ x: CANVAS_WIDTH / 2, y: 40 });
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (gameTime > 0 && !gameOver && !paused) {
      const timer = setTimeout(() => setGameTime(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (gameTime === 0) {
      setGameOver(true);
      if (onScoreUpdate) onScoreUpdate(goals * 100);
    }
  }, [gameTime, gameOver, paused, goals, onScoreUpdate]);

  useEffect(() => {
    const interval = setInterval(() => {
      updateBall();
      updateGoalkeeper();
    }, 16);
    return () => clearInterval(interval);
  }, [updateBall, updateGoalkeeper]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    };

    const handleMouseDown = () => {
      if (!ball.moving && !gameOver && !paused) {
        setCharging(true);
        setPower(0);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (charging && !ball.moving && !gameOver && !paused) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        kickBall(e.clientX - rect.left, e.clientY - rect.top, power);
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
  }, [ball.moving, charging, power, gameOver, paused, kickBall]);

  useEffect(() => {
    if (charging) {
      const interval = setInterval(() => {
        setPower(prev => Math.min(100, prev + 3));
      }, 50);
      return () => clearInterval(interval);
    }
  }, [charging]);

  const accuracy = attempts > 0 ? Math.round((goals / attempts) * 100) : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">SOCCER</div>
            <div className="text-sm">Goals: {goals} | Attempts: {attempts}</div>
            <div className="text-sm">Time: {gameTime}s | Accuracy: {accuracy}%</div>
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
          className="relative bg-green-500 border-2 border-gray-600 cursor-crosshair"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Field markings */}
          <div
            className="absolute border-2 border-white"
            style={{
              left: 50,
              top: 50,
              width: CANVAS_WIDTH - 100,
              height: CANVAS_HEIGHT - 100
            }}
          />
          
          {/* Goal */}
          <div
            className="absolute bg-gray-800 border-2 border-white"
            style={{
              left: goalPos.x,
              top: goalPos.y,
              width: GOAL_WIDTH,
              height: GOAL_HEIGHT
            }}
          />

          {/* Goal posts */}
          <div
            className="absolute bg-white"
            style={{
              left: goalPos.x - 2,
              top: goalPos.y,
              width: 4,
              height: GOAL_HEIGHT
            }}
          />
          <div
            className="absolute bg-white"
            style={{
              left: goalPos.x + GOAL_WIDTH - 2,
              top: goalPos.y,
              width: 4,
              height: GOAL_HEIGHT
            }}
          />

          {/* Goalkeeper */}
          <div
            className="absolute bg-yellow-400 rounded-full border-2 border-yellow-300"
            style={{
              left: goalkeeper.x - 15,
              top: goalkeeper.y - 15,
              width: 30,
              height: 30
            }}
          />

          {/* Ball */}
          <div
            className="absolute bg-white rounded-full border-2 border-gray-300"
            style={{
              left: ball.x - BALL_RADIUS,
              top: ball.y - BALL_RADIUS,
              width: BALL_RADIUS * 2,
              height: BALL_RADIUS * 2
            }}
          />

          {/* Aiming line */}
          {!ball.moving && !gameOver && (
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
            <div className="absolute bottom-4 left-4 bg-gray-800 border border-cyan-400 p-2 rounded">
              <div className="text-cyan-400 text-xs retro-font mb-1">POWER</div>
              <div className="w-24 h-3 bg-gray-600 border border-gray-500">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-red-400"
                  style={{ width: `${power}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Aim with mouse, click and hold to set power, release to kick!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-green-400 text-2xl font-bold mb-2 retro-font">TIME'S UP!</div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Goals Scored: {goals}</p>
              <p>Total Attempts: {attempts}</p>
              <p>Accuracy: {accuracy}%</p>
              <p>Score: {goals * 100}</p>
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

export default Soccer;