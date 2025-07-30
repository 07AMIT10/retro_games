import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface SudokuProps {
  onScoreUpdate?: (score: number) => void;
}

const GRID_SIZE = 9;
const BOX_SIZE = 3;

type SudokuGrid = number[][];
type SudokuNotes = number[][][];

const Sudoku: React.FC<SudokuProps> = ({ onScoreUpdate }) => {
  const [grid, setGrid] = useState<SudokuGrid>(() => 
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0))
  );
  const [initialGrid, setInitialGrid] = useState<SudokuGrid>(() => 
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0))
  );
  const [notes, setNotes] = useState<SudokuNotes>(() =>
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null).map(() => []))
  );
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [paused, setPaused] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [history, setHistory] = useState<{ grid: SudokuGrid; notes: SudokuNotes }[]>([]);
  const [conflicts, setConflicts] = useState<{row: number, col: number}[]>([]);

  const generateSudoku = useCallback(() => {
    // Create a complete valid Sudoku grid
    const newGrid: SudokuGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
    
    // Simple backtracking solver to generate a complete grid
    const fillGrid = (grid: SudokuGrid): boolean => {
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          if (grid[row][col] === 0) {
            const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
            for (const num of numbers) {
              if (isValidMove(grid, row, col, num)) {
                grid[row][col] = num;
                if (fillGrid(grid)) return true;
                grid[row][col] = 0;
              }
            }
            return false;
          }
        }
      }
      return true;
    };

    fillGrid(newGrid);

    // Remove numbers based on difficulty
    const cellsToRemove = difficulty === 'easy' ? 40 : difficulty === 'medium' ? 50 : 60;
    const puzzleGrid = newGrid.map(row => [...row]);
    
    for (let i = 0; i < cellsToRemove; i++) {
      let row, col;
      do {
        row = Math.floor(Math.random() * GRID_SIZE);
        col = Math.floor(Math.random() * GRID_SIZE);
      } while (puzzleGrid[row][col] === 0);
      
      puzzleGrid[row][col] = 0;
    }

    setInitialGrid(puzzleGrid.map(row => [...row]));
    setGrid(puzzleGrid);
    setNotes(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null).map(() => [])));
    setHistory([]);
    setConflicts([]);
  }, [difficulty]);

  const checkConflicts = (grid: SudokuGrid, row: number, col: number, num: number): {row: number, col: number}[] => {
    const foundConflicts: {row: number, col: number}[] = [];
    if (num === 0) return foundConflicts;

    // Check row
    for (let x = 0; x < GRID_SIZE; x++) {
      if (x !== col && grid[row][x] === num) {
        foundConflicts.push({row, col: x});
      }
    }

    // Check column
    for (let x = 0; x < GRID_SIZE; x++) {
      if (x !== row && grid[x][col] === num) {
        foundConflicts.push({row: x, col});
      }
    }

    // Check 3x3 box
    const boxRowStart = Math.floor(row / BOX_SIZE) * BOX_SIZE;
    const boxColStart = Math.floor(col / BOX_SIZE) * BOX_SIZE;
    
    for (let i = 0; i < BOX_SIZE; i++) {
      for (let j = 0; j < BOX_SIZE; j++) {
        const curRow = boxRowStart + i;
        const curCol = boxColStart + j;
        if ((curRow !== row || curCol !== col) && grid[curRow][curCol] === num) {
          foundConflicts.push({row: curRow, col: curCol});
        }
      }
    }
    return foundConflicts;
  };

  const isValidMove = (grid: SudokuGrid, row: number, col: number, num: number): boolean => {
    // Check row
    for (let x = 0; x < GRID_SIZE; x++) {
      if (grid[row][x] === num) return false;
    }

    // Check column
    for (let x = 0; x < GRID_SIZE; x++) {
      if (grid[x][col] === num) return false;
    }

    // Check 3x3 box
    const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
    const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
    
    for (let i = 0; i < BOX_SIZE; i++) {
      for (let j = 0; j < BOX_SIZE; j++) {
        if (grid[boxRow + i][boxCol + j] === num) return false;
      }
    }

    return true;
  };

  const handleCellClick = (row: number, col: number) => {
    if (gameWon || paused || initialGrid[row][col] !== 0) return;
    setSelectedCell({ row, col });
  };

  const handleNumberInput = (num: number) => {
    if (!selectedCell || gameWon || paused) return;
    
    const { row, col } = selectedCell;
    if (initialGrid[row][col] !== 0) return;

    const newGrid = grid.map(r => [...r]);
    const newNotes = notes.map(r => r.map(c => [...c]));
    
    setHistory(prev => [...prev, { grid, notes }]);

    if (isNoteMode) {
      const noteIndex = newNotes[row][col].indexOf(num);
      if (noteIndex > -1) {
        newNotes[row][col].splice(noteIndex, 1);
      } else {
        newNotes[row][col].push(num);
        newNotes[row][col].sort();
      }
      setGrid(newGrid); // Keep grid the same
      setNotes(newNotes);
      return;
    }

    // Not in note mode, placing a number
    newGrid[row][col] = num;
    newNotes[row][col] = []; // Clear notes from cell
    
    const currentConflicts = checkConflicts(newGrid, row, col, num);
    if (currentConflicts.length > 0) {
      setMistakes(prev => prev + 1);
      setScore(prev => Math.max(0, prev - 5));
      setConflicts([...currentConflicts, {row, col}]);
    } else {
      setScore(prev => prev + 10);
      setConflicts([]);
    }

    setGrid(newGrid);
    setNotes(newNotes);

    // Check if puzzle is solved
    const isComplete = newGrid.every(r => r.every(cell => cell !== 0));
    if (isComplete) {
      let isSolved = true;
      for(let r = 0; r < GRID_SIZE; r++) {
        for(let c = 0; c < GRID_SIZE; c++) {
          if(checkConflicts(newGrid, r, c, newGrid[r][c]).length > 0) {
            isSolved = false;
            break;
          }
        }
        if(!isSolved) break;
      }

      if (isSolved) {
        setGameWon(true);
        const timeBonus = Math.max(0, 1000 - timeElapsed);
        const mistakesPenalty = mistakes * 50;
        const finalScore = score + timeBonus - mistakesPenalty;
        setScore(finalScore);
        if (onScoreUpdate) {
          onScoreUpdate(finalScore);
        }
      }
    }
  };

  const resetGame = () => {
    generateSudoku();
    setSelectedCell(null);
    setMistakes(0);
    setScore(0);
    setTimeElapsed(0);
    setGameWon(false);
    setPaused(false);
  };

  const clearCell = () => {
    if (selectedCell && !gameWon && !paused) {
      handleNumberInput(0);
    }
  };

  const handleUndo = () => {
    if (history.length === 0 || paused || gameWon) return;
    const lastState = history[history.length - 1];
    setGrid(lastState.grid);
    setNotes(lastState.notes);
    setHistory(history.slice(0, -1));
    setConflicts([]);
  };

  useEffect(() => {
    generateSudoku();
  }, [generateSudoku]);

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

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setIsNoteMode(prev => !prev);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          handleUndo();
        }
        return;
      }

      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        handleNumberInput(num);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        clearCell();
      } else if (e.key === ' ') {
        e.preventDefault();
        setPaused(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedCell, gameWon, paused]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCellStyle = (row: number, col: number) => {
    const isSelected = selectedCell?.row === row && selectedCell?.col === col;
    const isInitial = initialGrid[row][col] !== 0;
    const isInSameRow = selectedCell?.row === row;
    const isInSameCol = selectedCell?.col === col;
    const isInSameBox = selectedCell && 
      Math.floor(selectedCell.row / BOX_SIZE) === Math.floor(row / BOX_SIZE) &&
      Math.floor(selectedCell.col / BOX_SIZE) === Math.floor(col / BOX_SIZE);
    const isConflict = conflicts.some(c => c.row === row && c.col === col);
    const isSameNumber = selectedCell && grid[selectedCell.row][selectedCell.col] !== 0 && grid[row][col] === grid[selectedCell.row][selectedCell.col];

    return `
      flex items-center justify-center text-lg font-bold cursor-pointer transition-all duration-200 relative
      ${isInitial ? 'bg-gray-700 text-cyan-400' : 'bg-gray-800 text-white hover:bg-gray-600'}
      ${(isInSameRow || isInSameCol || isInSameBox) && !isSelected ? 'bg-gray-650' : ''}
      ${isSameNumber && !isSelected ? 'bg-blue-800' : ''}
      ${isSelected ? 'bg-cyan-400 text-black' : ''}
      ${isConflict ? 'bg-red-800 !text-red-400' : ''}
      ${row % BOX_SIZE === BOX_SIZE - 1 ? 'border-b-2 border-cyan-400' : 'border-b border-gray-600'}
      ${col % BOX_SIZE === BOX_SIZE - 1 ? 'border-r-2 border-cyan-400' : 'border-r border-gray-600'}
      ${row === 0 ? 'border-t-2 border-cyan-400' : ''}
      ${col === 0 ? 'border-l-2 border-cyan-400' : ''}
    `;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">SUDOKU</div>
            <div className="text-sm">
              Time: {formatTime(timeElapsed)} | Mistakes: {mistakes}
            </div>
            <div className="text-sm">Score: {score}</div>
          </div>
          <div className="flex space-x-2">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
              className="bg-gray-800 text-cyan-400 border border-cyan-400 rounded px-2 py-1 text-sm retro-font"
              disabled={gameWon}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <button
              onClick={() => setPaused(!paused)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded border border-cyan-400"
              disabled={gameWon}
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

        {/* Sudoku Grid */}
        <div className="grid grid-cols-9 gap-0 bg-cyan-400 p-1 rounded" style={{ width: '450px', height: '450px' }}>
          {grid.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={getCellStyle(rowIndex, colIndex)}
                style={{ width: '48px', height: '48px' }}
                onClick={() => handleCellClick(rowIndex, colIndex)}
              >
                {cell > 0 ? (
                  cell
                ) : (
                  <div className="grid grid-cols-3 grid-rows-3 w-full h-full text-xs text-gray-400">
                    {notes[rowIndex][colIndex].map(note => (
                      <div key={note} className={`flex items-center justify-center`}>
                        {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Number Input & Controls */}
        <div className="mt-4 flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              onClick={handleUndo}
              className="px-4 h-10 bg-yellow-600 hover:bg-yellow-700 text-white border border-cyan-400 rounded font-bold retro-font text-sm transition-colors duration-200"
              disabled={history.length === 0 || gameWon || paused}
            >
              Undo
            </button>
            <button
              onClick={() => setIsNoteMode(!isNoteMode)}
              className={`px-4 h-10 border border-cyan-400 rounded font-bold retro-font text-sm transition-colors duration-200 ${
                isNoteMode ? 'bg-cyan-400 text-black' : 'bg-gray-700 text-cyan-400 hover:bg-gray-600'
              }`}
              disabled={gameWon || paused}
            >
              Notes
            </button>
            <button
              onClick={clearCell}
              className="px-4 h-10 bg-red-600 hover:bg-red-700 text-white border border-cyan-400 rounded font-bold retro-font text-sm transition-colors duration-200"
              disabled={gameWon || paused || !selectedCell}
            >
              Clear
            </button>
          </div>
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => handleNumberInput(num)}
                className="w-10 h-10 bg-gray-700 hover:bg-gray-600 text-cyan-400 border border-cyan-400 rounded font-bold retro-font transition-colors duration-200"
                disabled={gameWon || paused}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Click cell, then number to fill. Use (N) for notes, (Ctrl+Z) to undo.</p>
        </div>

        {gameWon && (
          <div className="mt-4 text-center">
            <div className="text-green-400 text-2xl font-bold mb-2 retro-font">PUZZLE SOLVED!</div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Time: {formatTime(timeElapsed)}</p>
              <p>Mistakes: {mistakes}</p>
              <p>Final Score: {score}</p>
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

export default Sudoku;