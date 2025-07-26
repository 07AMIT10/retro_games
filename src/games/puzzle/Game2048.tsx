import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const GRID_SIZE = 4;

type Grid = number[][];

interface Game2048Props {
  onScoreUpdate?: (score: number) => void;
}

const Game2048: React.FC<Game2048Props> = ({ onScoreUpdate }) => {
  const [grid, setGrid] = useState<Grid>(() => 
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0))
  );
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    const saved = localStorage.getItem('2048_best');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  const getEmptyCells = (grid: Grid): Position[] => {
    const empty: Position[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (grid[row][col] === 0) {
          empty.push({ row, col });
        }
      }
    }
    return empty;
  };

  const addRandomTile = useCallback((grid: Grid): Grid => {
    const emptyCells = getEmptyCells(grid);
    if (emptyCells.length === 0) return grid;

    const newGrid = grid.map(row => [...row]);
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    newGrid[randomCell.row][randomCell.col] = Math.random() < 0.9 ? 2 : 4;
    
    return newGrid;
  }, []);

  const initializeGrid = useCallback(() => {
    let newGrid: Grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
    newGrid = addRandomTile(newGrid);
    newGrid = addRandomTile(newGrid);
    return newGrid;
  }, [addRandomTile]);

  const moveLeft = (grid: Grid): { grid: Grid; score: number; moved: boolean } => {
    let newScore = 0;
    let moved = false;
    const newGrid = grid.map(row => {
      const filteredRow = row.filter(cell => cell !== 0);
      const mergedRow: number[] = [];
      
      for (let i = 0; i < filteredRow.length; i++) {
        if (i < filteredRow.length - 1 && filteredRow[i] === filteredRow[i + 1]) {
          const mergedValue = filteredRow[i] * 2;
          mergedRow.push(mergedValue);
          newScore += mergedValue;
          i++; // Skip next element as it's merged
        } else {
          mergedRow.push(filteredRow[i]);
        }
      }
      
      while (mergedRow.length < GRID_SIZE) {
        mergedRow.push(0);
      }
      
      if (JSON.stringify(row) !== JSON.stringify(mergedRow)) {
        moved = true;
      }
      
      return mergedRow;
    });

    return { grid: newGrid, score: newScore, moved };
  };

  const rotateGrid = (grid: Grid): Grid => {
    const newGrid: Grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        newGrid[col][GRID_SIZE - 1 - row] = grid[row][col];
      }
    }
    return newGrid;
  };

  const move = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    if (gameOver) return;

    let currentGrid = [...grid.map(row => [...row])];
    let rotations = 0;

    // Rotate grid to convert all moves to left moves
    switch (direction) {
      case 'up':
        rotations = 3;
        break;
      case 'right':
        rotations = 2;
        break;
      case 'down':
        rotations = 1;
        break;
      default:
        rotations = 0;
    }

    for (let i = 0; i < rotations; i++) {
      currentGrid = rotateGrid(currentGrid);
    }

    const { grid: movedGrid, score: moveScore, moved } = moveLeft(currentGrid);

    if (!moved) return;

    // Rotate back
    let finalGrid = movedGrid;
    for (let i = 0; i < (4 - rotations) % 4; i++) {
      finalGrid = rotateGrid(finalGrid);
    }

    // Add random tile
    finalGrid = addRandomTile(finalGrid);

    setGrid(finalGrid);
    setScore(prev => {
      const newScore = prev + moveScore;
      if (newScore > bestScore) {
        setBestScore(newScore);
        localStorage.setItem('2048_best', newScore.toString());
      }
      return newScore;
    });

    // Check for 2048 tile
    if (!won && finalGrid.flat().includes(2048)) {
      setWon(true);
    }

    // Check game over
    const canMove = ['left', 'right', 'up', 'down'].some(dir => {
      let testGrid = [...finalGrid.map(row => [...row])];
      let testRotations = 0;

      switch (dir) {
        case 'up': testRotations = 3; break;
        case 'right': testRotations = 2; break;
        case 'down': testRotations = 1; break;
        default: testRotations = 0;
      }

      for (let i = 0; i < testRotations; i++) {
        testGrid = rotateGrid(testGrid);
      }

      const { moved } = moveLeft(testGrid);
      return moved;
    });

    if (!canMove) {
      setGameOver(true);
      if (onScoreUpdate) onScoreUpdate(score + moveScore);
    }
  }, [grid, gameOver, won, bestScore, addRandomTile, score, onScoreUpdate]);

  const resetGame = () => {
    setGrid(initializeGrid());
    setScore(0);
    setGameOver(false);
    setWon(false);
  };

  const getTileColor = (value: number): string => {
    const colors: Record<number, string> = {
      2: '#eee4da',
      4: '#ede0c8',
      8: '#f2b179',
      16: '#f59563',
      32: '#f67c5f',
      64: '#f65e3b',
      128: '#edcf72',
      256: '#edcc61',
      512: '#edc850',
      1024: '#edc53f',
      2048: '#edc22e'
    };
    return colors[value] || '#3c3a32';
  };

  const getTextColor = (value: number): string => {
    return value <= 4 ? '#776e65' : '#f9f6f2';
  };

  useEffect(() => {
    if (grid.flat().every(cell => cell === 0)) {
      setGrid(initializeGrid());
    }
  }, [grid, initializeGrid]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          move('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          move('right');
          break;
        case 'ArrowUp':
          e.preventDefault();
          move('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          move('down');
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          resetGame();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [move]);

  interface Position {
    row: number;
    col: number;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">SCORE: {score}</div>
            <div className="text-sm">BEST: {bestScore}</div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white p-2 rounded border border-cyan-400"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg" style={{ width: '400px', height: '400px' }}>
          <div className="grid grid-cols-4 gap-2 w-full h-full">
            {grid.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="flex items-center justify-center rounded font-bold text-xl retro-font transition-all duration-200"
                  style={{
                    backgroundColor: cell === 0 ? '#cdc1b4' : getTileColor(cell),
                    color: getTextColor(cell),
                    fontSize: cell >= 1000 ? '16px' : '20px'
                  }}
                >
                  {cell > 0 && cell}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Use arrow keys to move tiles. Combine same numbers to reach 2048!</p>
        </div>

        {won && !gameOver && (
          <div className="mt-4 text-center">
            <div className="text-green-400 text-2xl font-bold mb-2 retro-font">YOU WON!</div>
            <p className="text-cyan-400 mb-4 retro-font">Keep playing to beat your high score!</p>
          </div>
        )}

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">GAME OVER!</div>
            <p className="text-cyan-400 mb-4 retro-font">Final Score: {score}</p>
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

export default Game2048;