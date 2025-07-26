import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Shuffle } from 'lucide-react';

interface SlidingPuzzleProps {
  onScoreUpdate?: (score: number) => void;
}

const GRID_SIZE = 4;
const CELL_SIZE = 70;

type PuzzleGrid = number[][];

const SlidingPuzzle: React.FC<SlidingPuzzleProps> = ({ onScoreUpdate }) => {
  const [grid, setGrid] = useState<PuzzleGrid>(() => 
    Array(GRID_SIZE).fill(null).map((_, row) => 
      Array(GRID_SIZE).fill(null).map((_, col) => 
        row * GRID_SIZE + col + 1
      )
    )
  );
  const [moves, setMoves] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [paused, setPaused] = useState(false);
  const [emptyPos, setEmptyPos] = useState<{ row: number; col: number }>({ row: GRID_SIZE - 1, col: GRID_SIZE - 1 });

  const createSolvedGrid = (): PuzzleGrid => {
    const solvedGrid = Array(GRID_SIZE).fill(null).map((_, row) => 
      Array(GRID_SIZE).fill(null).map((_, col) => 
        row * GRID_SIZE + col + 1
      )
    );
    solvedGrid[GRID_SIZE - 1][GRID_SIZE - 1] = 0; // Empty space
    return solvedGrid;
  };

  const shuffleGrid = useCallback(() => {
    const newGrid = createSolvedGrid();
    let emptyRow = GRID_SIZE - 1;
    let emptyCol = GRID_SIZE - 1;

    // Perform random valid moves to shuffle
    for (let i = 0; i < 1000; i++) {
      const directions = [];
      if (emptyRow > 0) directions.push({ row: emptyRow - 1, col: emptyCol });
      if (emptyRow < GRID_SIZE - 1) directions.push({ row: emptyRow + 1, col: emptyCol });
      if (emptyCol > 0) directions.push({ row: emptyRow, col: emptyCol - 1 });
      if (emptyCol < GRID_SIZE - 1) directions.push({ row: emptyRow, col: emptyCol + 1 });

      if (directions.length > 0) {
        const randomDir = directions[Math.floor(Math.random() * directions.length)];
        
        // Swap empty space with the selected tile
        newGrid[emptyRow][emptyCol] = newGrid[randomDir.row][randomDir.col];
        newGrid[randomDir.row][randomDir.col] = 0;
        
        emptyRow = randomDir.row;
        emptyCol = randomDir.col;
      }
    }

    setGrid(newGrid);
    setEmptyPos({ row: emptyRow, col: emptyCol });
    setMoves(0);
    setTimeElapsed(0);
    setGameWon(false);
    setPaused(false);
  }, []);

  const isSolved = useCallback((grid: PuzzleGrid): boolean => {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const expectedValue = row === GRID_SIZE - 1 && col === GRID_SIZE - 1 ? 0 : row * GRID_SIZE + col + 1;
        if (grid[row][col] !== expectedValue) {
          return false;
        }
      }
    }
    return true;
  }, []);

  const canMoveTile = (row: number, col: number): boolean => {
    const rowDiff = Math.abs(row - emptyPos.row);
    const colDiff = Math.abs(col - emptyPos.col);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
  };

  const moveTile = useCallback((row: number, col: number) => {
    if (gameWon || paused || !canMoveTile(row, col)) return;

    const newGrid = grid.map(r => [...r]);
    
    // Swap tile with empty space
    newGrid[emptyPos.row][emptyPos.col] = newGrid[row][col];
    newGrid[row][col] = 0;
    
    setGrid(newGrid);
    setEmptyPos({ row, col });
    setMoves(prev => prev + 1);

    // Check if puzzle is solved
    if (isSolved(newGrid)) {
      setGameWon(true);
      const timeBonus = Math.max(0, 1000 - timeElapsed);
      const movesPenalty = moves * 2;
      const finalScore = Math.max(100, 2000 + timeBonus - movesPenalty);
      
      if (onScoreUpdate) {
        onScoreUpdate(finalScore);
      }
    }
  }, [grid, emptyPos, gameWon, paused, moves, timeElapsed, isSolved, onScoreUpdate]);

  const resetGame = () => {
    shuffleGrid();
  };

  useEffect(() => {
    // Initialize with shuffled grid
    shuffleGrid();
  }, [shuffleGrid]);

  useEffect(() => {
    if (!gameWon && !paused) {
      const timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [gameWon, paused]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameWon || paused) return;

      const { row: emptyRow, col: emptyCol } = emptyPos;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (emptyRow < GRID_SIZE - 1) {
            moveTile(emptyRow + 1, emptyCol);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (emptyRow > 0) {
            moveTile(emptyRow - 1, emptyCol);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (emptyCol < GRID_SIZE - 1) {
            moveTile(emptyRow, emptyCol + 1);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (emptyCol > 0) {
            moveTile(emptyRow, emptyCol - 1);
          }
          break;
        case ' ':
          e.preventDefault();
          setPaused(prev => !prev);
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
  }, [emptyPos, moveTile, gameWon, paused]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">SLIDING PUZZLE</div>
            <div className="text-sm">
              Moves: {moves} | Time: {formatTime(timeElapsed)}
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPaused(!paused)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded border border-cyan-400"
              disabled={gameWon}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={shuffleGrid}
              className="bg-yellow-600 hover:bg-yellow-700 text-white p-2 rounded border border-cyan-400"
            >
              <Shuffle className="w-4 h-4" />
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
          className="grid gap-2 bg-gray-800 border-2 border-gray-600 p-4 rounded"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`
          }}
        >
          {grid.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  flex items-center justify-center font-bold text-xl cursor-pointer transition-all duration-200 rounded retro-font
                  ${cell === 0 ? 
                    'bg-gray-900 border-2 border-gray-700' : 
                    canMoveTile(rowIndex, colIndex) ? 
                      'bg-cyan-500 hover:bg-cyan-400 text-black border-2 border-cyan-400 hover:scale-105' : 
                      'bg-gray-600 text-gray-300 border-2 border-gray-500'
                  }
                `}
                style={{ width: CELL_SIZE, height: CELL_SIZE }}
                onClick={() => moveTile(rowIndex, colIndex)}
              >
                {cell > 0 && cell}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <p><strong>Arrow Keys</strong> - Move tiles</p>
              <p><strong>Click</strong> - Move tile to empty space</p>
            </div>
            <div>
              <p><strong>Space</strong> - Pause</p>
              <p><strong>R</strong> - New puzzle</p>
            </div>
          </div>
          <p className="text-yellow-400">Arrange the numbers 1-15 in order!</p>
        </div>

        {gameWon && (
          <div className="mt-4 text-center">
            <div className="text-green-400 text-2xl font-bold mb-2 retro-font">PUZZLE SOLVED!</div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Time: {formatTime(timeElapsed)}</p>
              <p>Moves: {moves}</p>
              <p>Score: {Math.max(100, 2000 + Math.max(0, 1000 - timeElapsed) - moves * 2)}</p>
            </div>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-bold border-2 border-cyan-400"
            >
              NEW PUZZLE
            </button>
          </div>
        )}

        {paused && !gameWon && (
          <div className="mt-4 text-center text-yellow-400 text-xl font-bold retro-font">
            PAUSED
          </div>
        )}
      </div>
    </div>
  );
};

export default SlidingPuzzle;