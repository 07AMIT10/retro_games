import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface GolfProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 500;
const BALL_RADIUS = 8;
const HOLE_RADIUS = 15;

interface Position {
  x: number;
  y: number;
}

interface Ball extends Position {
  vx: number;
  vy: number;
  moving: boolean;
}

interface Obstacle extends Position {
  width: number;
  height: number;
  type: 'sand' | 'water' | 'tree';
}

const Golf: React.FC<GolfProps> = ({ onScoreUpdate }) => {
  const [ball, setBall] = useState<Ball>({ 
    x: 100, 
    y: CANVAS_HEIGHT - 100, 
    vx: 0, 
    vy: 0, 
    moving: false 
  });
  const [hole, setHole] = useState<Position>({ x: 500, y: 80 });
  const [obstacles, setObstacles] = useState<Obstacle[]>([
    { x: 200, y: 200, width: 80, height: 40, type: 'sand' },
    { x: 350, y: 300, width: 60, height: 60, type: 'water' },
    { x: 300, y: 150, width: 20, height: 20, type: 'tree' }
  ]);
  const [strokes, setStrokes] = useState(0);
  const [currentHole, setCurrentHole] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [aimAngle, setAimAngle] = useState(0);
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });

  const par = 3;
  const maxHoles = 9;

  const hitBall = useCallback((angle: number, power: number) => {
    if (ball.moving || gameOver || paused) return;

    const speed = (power / 100) * 15;
    setBall(prev => ({
      ...prev,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      moving: true
    }));

    setStrokes(prev => prev + 1);
  }, [ball.moving, gameOver, paused]);

  const updateBall = useCallback(() => {
    if (!ball.moving || gameOver || paused) return;

    setBall(prev => {
      let newX = prev.x + prev.vx;
      let newY = prev.y + prev.vy;
      let newVx = prev.vx * 0.95; // friction
      let newVy = prev.vy * 0.95;

      // Boundary collisions
      if (newX <= BALL_RADIUS || newX >= CANVAS_WIDTH - BALL_RADIUS) {
        newVx = -newVx * 0.7;
        newX = Math.max(BALL_RADIUS, Math.min(CANVAS_WIDTH - BALL_RADIUS, newX));
      }

      if (newY <= BALL_RADIUS || newY >= CANVAS_HEIGHT - BALL_RADIUS) {
        newVy = -newVy * 0.7;
        newY = Math.max(BALL_RADIUS, Math.min(CANVAS_HEIGHT - BALL_RADIUS, newY));
      }

      // Obstacle collisions
      obstacles.forEach(obstacle => {
        if (
          newX > obstacle.x && 
          newX < obstacle.x + obstacle.width &&
          newY > obstacle.y && 
          newY < obstacle.y + obstacle.height
        ) {
          if (obstacle.type === 'water') {
            // Reset ball to previous position (penalty)
            setStrokes(prev => prev + 1);
            return {
              x: 100,
              y: CANVAS_HEIGHT - 100,
              vx: 0,
              vy: 0,
              moving: false
            };
          } else if (obstacle.type === 'sand') {
            // Slow down in sand
            newVx *= 0.3;
            newVy *= 0.3;
          } else if (obstacle.type === 'tree') {
            // Bounce off tree
            newVx = -newVx * 0.5;
            newVy = -newVy * 0.5;
          }
        }
      });

      // Check hole
      const distanceToHole = Math.sqrt(
        (newX - hole.x) ** 2 + (newY - hole.y) ** 2
      );

      if (distanceToHole <= HOLE_RADIUS) {
        // Ball in hole!
        setTotalScore(prev => prev + strokes);
        
        if (currentHole >= maxHoles) {
          setGameOver(true);
          if (onScoreUpdate) onScoreUpdate(Math.max(0, 100 - totalScore - strokes));
        } else {
          setCurrentHole(prev => prev + 1);
          // Generate new hole layout
          setHole({ x: 450 + Math.random() * 100, y: 50 + Math.random() * 100 });
          setObstacles([
            { 
              x: 200 + Math.random() * 200, 
              y: 200 + Math.random() * 200, 
              width: 60 + Math.random() * 40, 
              height: 30 + Math.random() * 30, 
              type: 'sand' 
            },
            { 
              x: 250 + Math.random() * 200, 
              y: 150 + Math.random() * 200, 
              width: 40 + Math.random() * 40, 
              height: 40 + Math.random() * 40, 
              type: 'water' 
            },
            { 
              x: 200 + Math.random() * 300, 
              y: 100 + Math.random() * 300, 
              width: 20, 
              height: 20, 
              type: 'tree' 
            }
          ]);
        }
        
        setStrokes(0);
        return {
          x: 100,
          y: CANVAS_HEIGHT - 100,
          vx: 0,
          vy: 0,
          moving: false
        };
      }

      // Stop ball if moving too slowly
      if (Math.abs(newVx) < 0.1 && Math.abs(newVy) < 0.1) {
        return { x: newX, y: newY, vx: 0, vy: 0, moving: false };
      }

      return { x: newX, y: newY, vx: newVx, vy: newVy, moving: true };
    });
  }, [ball.moving, gameOver, paused, obstacles, hole, strokes, currentHole, totalScore, maxHoles, onScoreUpdate]);

  const resetGame = () => {
    setBall({ x: 100, y: CANVAS_HEIGHT - 100, vx: 0, vy: 0, moving: false });
    setHole({ x: 500, y: 80 });
    setObstacles([
      { x: 200, y: 200, width: 80, height: 40, type: 'sand' },
      { x: 350, y: 300, width: 60, height: 60, type: 'water' },
      { x: 300, y: 150, width: 20, height: 20, type: 'tree' }
    ]);
    setStrokes(0);
    setCurrentHole(1);
    setTotalScore(0);
    setAimAngle(0);
    setPower(0);
    setCharging(false);
    setGameOver(false);
    setPaused(false);
  };

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
      
      if (!ball.moving) {
        const angle = Math.atan2(
          (e.clientY - rect.top) - ball.y,
          (e.clientX - rect.left) - ball.x
        );
        setAimAngle(angle);
      }
    };

    const handleMouseDown = () => {
      if (!ball.moving && !gameOver && !paused) {
        setCharging(true);
        setPower(0);
      }
    };

    const handleMouseUp = () => {
      if (charging && !ball.moving && !gameOver && !paused) {
        hitBall(aimAngle, power);
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
  }, [ball, charging, aimAngle, power, gameOver, paused, hitBall]);

  useEffect(() => {
    if (charging) {
      const interval = setInterval(() => {
        setPower(prev => Math.min(100, prev + 3));
      }, 50);
      return () => clearInterval(interval);
    }
  }, [charging]);

  const getObstacleColor = (type: string) => {
    switch (type) {
      case 'sand': return 'bg-yellow-600';
      case 'water': return 'bg-blue-500';
      case 'tree': return 'bg-green-700';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">GOLF</div>
            <div className="text-sm">Hole {currentHole}/{maxHoles} | Par {par}</div>
            <div className="text-sm">Strokes: {strokes} | Total: {totalScore + strokes}</div>
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
          className="relative bg-green-400 border-2 border-gray-600 cursor-crosshair"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Tee area */}
          <div
            className="absolute bg-green-600 rounded"
            style={{
              left: 80,
              top: CANVAS_HEIGHT - 120,
              width: 40,
              height: 40
            }}
          />

          {/* Obstacles */}
          {obstacles.map((obstacle, index) => (
            <div
              key={index}
              className={`absolute ${getObstacleColor(obstacle.type)}`}
              style={{
                left: obstacle.x,
                top: obstacle.y,
                width: obstacle.width,
                height: obstacle.height
              }}
            />
          ))}

          {/* Hole */}
          <div
            className="absolute bg-black rounded-full border-2 border-gray-800"
            style={{
              left: hole.x - HOLE_RADIUS,
              top: hole.y - HOLE_RADIUS,
              width: HOLE_RADIUS * 2,
              height: HOLE_RADIUS * 2
            }}
          />

          {/* Flag */}
          <div
            className="absolute bg-red-500"
            style={{
              left: hole.x + 10,
              top: hole.y - 30,
              width: 2,
              height: 30
            }}
          />
          <div
            className="absolute bg-red-500"
            style={{
              left: hole.x + 12,
              top: hole.y - 25,
              width: 15,
              height: 10
            }}
          />

          {/* Ball */}
          <div
            className="absolute bg-white rounded-full border border-gray-300"
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
                x2={ball.x + Math.cos(aimAngle) * 100}
                y2={ball.y + Math.sin(aimAngle) * 100}
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
          <p>Aim with mouse, click and hold to set power, release to swing!</p>
          <div className="mt-2 text-xs">
            <span className="text-yellow-400">Sand</span> • 
            <span className="text-blue-400 ml-2">Water</span> • 
            <span className="text-green-400 ml-2">Trees</span>
          </div>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-green-400 text-2xl font-bold mb-2 retro-font">ROUND COMPLETE!</div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Total Score: {totalScore}</p>
              <p>Par: {maxHoles * par} | Your Score: {totalScore}</p>
              <p>
                {totalScore < maxHoles * par ? 'Under Par!' : 
                 totalScore === maxHoles * par ? 'Par!' : 'Over Par'}
              </p>
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

export default Golf;