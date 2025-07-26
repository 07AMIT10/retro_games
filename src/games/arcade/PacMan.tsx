import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface PacManProps {
  onScoreUpdate?: (score: number) => void;
}

const MAZE_WIDTH = 21;
const MAZE_HEIGHT = 21;
const CELL_SIZE = 20;

type CellType = 0 | 1 | 2 | 3; // 0: wall, 1: dot, 2: empty, 3: power pellet

interface Position {
  x: number;
  y: number;
}

interface Ghost {
  x: number;
  y: number;
  direction: Direction;
  color: string;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const INITIAL_MAZE: CellType[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,0],
  [0,3,0,0,1,0,0,0,1,1,0,1,1,0,0,0,1,0,0,3,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,0,1,0],
  [0,1,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,1,0],
  [0,0,0,0,1,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0,0],
  [2,2,2,0,1,0,1,1,1,1,1,1,1,1,1,0,1,0,2,2,2],
  [0,0,0,0,1,0,1,0,0,2,2,2,0,0,1,0,1,0,0,0,0],
  [1,1,1,1,1,1,1,0,2,2,2,2,2,0,1,1,1,1,1,1,1],
  [0,0,0,0,1,0,1,0,2,2,2,2,2,0,1,0,1,0,0,0,0],
  [2,2,2,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,2,2,2],
  [0,0,0,0,1,0,1,1,1,1,1,1,1,1,1,0,1,0,0,0,0],
  [0,1,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,1,0],
  [0,1,0,0,1,0,0,0,1,0,1,0,1,0,0,0,1,0,0,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,3,0,0,1,0,0,0,1,1,0,1,1,0,0,0,1,0,0,3,0],
  [0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];

const PacMan: React.FC<PacManProps> = ({ onScoreUpdate }) => {
  const [maze, setMaze] = useState<CellType[][]>(() => 
    INITIAL_MAZE.map(row => [...row])
  );
  const [pacman, setPacman] = useState<Position>({ x: 10, y: 15 });
  const [pacmanDirection, setPacmanDirection] = useState<Direction>('RIGHT');
  const [ghosts, setGhosts] = useState<Ghost[]>([
    { x: 10, y: 9, direction: 'UP', color: '#ff0000' },
    { x: 9, y: 10, direction: 'LEFT', color: '#ffb8ff' },
    { x: 10, y: 10, direction: 'RIGHT', color: '#ffb852' },
    { x: 11, y: 10, direction: 'UP', color: '#00ffff' }
  ]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [powerMode, setPowerMode] = useState(false);
  const [powerModeTimer, setPowerModeTimer] = useState(0);

  const isValidMove = (x: number, y: number): boolean => {
    if (x < 0 || x >= MAZE_WIDTH || y < 0 || y >= MAZE_HEIGHT) {
      return false;
    }
    return maze[y][x] !== 0;
  };

  const getRandomDirection = (): Direction => {
    const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    return directions[Math.floor(Math.random() * directions.length)];
  };

  const getNextPosition = (pos: Position, direction: Direction): Position => {
    switch (direction) {
      case 'UP': return { x: pos.x, y: pos.y - 1 };
      case 'DOWN': return { x: pos.x, y: pos.y + 1 };
      case 'LEFT': return { x: pos.x - 1, y: pos.y };
      case 'RIGHT': return { x: pos.x + 1, y: pos.y };
    }
  };

  const movePacman = useCallback((direction: Direction) => {
    if (gameOver || paused) return;

    const nextPos = getNextPosition(pacman, direction);
    
    if (isValidMove(nextPos.x, nextPos.y)) {
      setPacman(nextPos);
      setPacmanDirection(direction);

      // Check for dot collection
      const cell = maze[nextPos.y][nextPos.x];
      if (cell === 1) {
        setScore(prev => prev + 10);
        setMaze(prevMaze => {
          const newMaze = prevMaze.map(row => [...row]);
          newMaze[nextPos.y][nextPos.x] = 2;
          return newMaze;
        });
      } else if (cell === 3) {
        setScore(prev => prev + 50);
        setPowerMode(true);
        setPowerModeTimer(10000); // 10 seconds
        setMaze(prevMaze => {
          const newMaze = prevMaze.map(row => [...row]);
          newMaze[nextPos.y][nextPos.x] = 2;
          return newMaze;
        });
      }

      // Check win condition
      const dotsRemaining = maze.flat().some(cell => cell === 1 || cell === 3);
      if (!dotsRemaining) {
        setGameOver(true);
        if (onScoreUpdate) {
          onScoreUpdate(score);
        }
      }
    }
  }, [pacman, maze, gameOver, paused]);

  const moveGhosts = useCallback(() => {
    if (gameOver || paused) return;

    setGhosts(prevGhosts => prevGhosts.map(ghost => {
      let newDirection = ghost.direction;
      let nextPos = getNextPosition(ghost, newDirection);

      // If can't move in current direction, pick a random valid direction
      if (!isValidMove(nextPos.x, nextPos.y)) {
        const validDirections: Direction[] = [];
        const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
        
        directions.forEach(dir => {
          const testPos = getNextPosition(ghost, dir);
          if (isValidMove(testPos.x, testPos.y)) {
            validDirections.push(dir);
          }
        });

        if (validDirections.length > 0) {
          newDirection = validDirections[Math.floor(Math.random() * validDirections.length)];
          nextPos = getNextPosition(ghost, newDirection);
        } else {
          return ghost; // No valid moves
        }
      }

      return { ...ghost, x: nextPos.x, y: nextPos.y, direction: newDirection };
    }));
  }, [gameOver, paused]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    const collision = ghosts.some(ghost => 
      ghost.x === pacman.x && ghost.y === pacman.y
    );

    if (collision) {
      if (powerMode) {
        setScore(prev => prev + 200);
        // Remove collided ghost (simplified - in real Pac-Man they respawn)
      } else {
        setGameOver(true);
        if (onScoreUpdate) {
          onScoreUpdate(score);
        }
      }
    }
  }, [ghosts, pacman, gameOver, paused, powerMode]);

  const resetGame = () => {
    setMaze(INITIAL_MAZE.map(row => [...row]));
    setPacman({ x: 10, y: 15 });
    setPacmanDirection('RIGHT');
    setGhosts([
      { x: 10, y: 9, direction: 'UP', color: '#ff0000' },
      { x: 9, y: 10, direction: 'LEFT', color: '#ffb8ff' },
      { x: 10, y: 10, direction: 'RIGHT', color: '#ffb852' },
      { x: 11, y: 10, direction: 'UP', color: '#00ffff' }
    ]);
    setScore(0);
    setGameOver(false);
    setPaused(false);
    setPowerMode(false);
    setPowerModeTimer(0);
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          movePacman('UP');
          break;
        case 'ArrowDown':
          e.preventDefault();
          movePacman('DOWN');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          movePacman('LEFT');
          break;
        case 'ArrowRight':
          e.preventDefault();
          movePacman('RIGHT');
          break;
        case ' ':
          e.preventDefault();
          setPaused(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [movePacman]);

  useEffect(() => {
    const ghostInterval = setInterval(moveGhosts, 200);
    return () => clearInterval(ghostInterval);
  }, [moveGhosts]);

  useEffect(() => {
    checkCollisions();
  }, [checkCollisions]);

  useEffect(() => {
    if (powerMode && powerModeTimer > 0) {
      const timer = setTimeout(() => {
        setPowerModeTimer(prev => prev - 100);
      }, 100);

      if (powerModeTimer <= 0) {
        setPowerMode(false);
      }

      return () => clearTimeout(timer);
    }
  }, [powerMode, powerModeTimer]);

  const getCellDisplay = (cell: CellType, x: number, y: number) => {
    if (pacman.x === x && pacman.y === y) {
      return <div className="w-4 h-4 bg-yellow-400 rounded-full mx-auto" />;
    }

    const ghost = ghosts.find(g => g.x === x && g.y === y);
    if (ghost) {
      return (
        <div 
          className="w-4 h-4 rounded-t-full mx-auto"
          style={{ backgroundColor: powerMode ? '#0066ff' : ghost.color }}
        />
      );
    }

    switch (cell) {
      case 0: return <div className="w-full h-full bg-blue-600" />;
      case 1: return <div className="w-1 h-1 bg-yellow-300 rounded-full mx-auto my-auto" />;
      case 3: return <div className="w-3 h-3 bg-yellow-300 rounded-full mx-auto" />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="bg-gray-800 rounded-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="text-white">
            <span className="text-lg font-bold">Score: {score}</span>
            {powerMode && (
              <div className="text-sm text-yellow-400">
                Power Mode: {Math.ceil(powerModeTimer / 1000)}s
              </div>
            )}
          </div>
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
          className="grid bg-black border-2 border-gray-600 p-2"
          style={{
            gridTemplateColumns: `repeat(${MAZE_WIDTH}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${MAZE_HEIGHT}, ${CELL_SIZE}px)`,
            gap: '1px'
          }}
        >
          {maze.flat().map((cell, index) => {
            const x = index % MAZE_WIDTH;
            const y = Math.floor(index / MAZE_WIDTH);
            return (
              <div
                key={index}
                className="flex items-center justify-center"
                style={{ width: CELL_SIZE, height: CELL_SIZE }}
              >
                {getCellDisplay(cell, x, y)}
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-center text-sm text-gray-400">
          <p>Use arrow keys to move • Space to pause</p>
          <p>Collect all dots to win!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-2xl font-bold mb-2">
              {maze.flat().every(cell => cell !== 1 && cell !== 3) ? (
                <span className="text-green-400">You Win!</span>
              ) : (
                <span className="text-red-400">Game Over!</span>
              )}
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

export default PacMan;