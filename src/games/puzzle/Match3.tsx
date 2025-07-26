import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface Match3Props {
  onScoreUpdate?: (score: number) => void;
}

const GRID_SIZE = 8;
const CELL_SIZE = 50;

type GemType = 1 | 2 | 3 | 4 | 5 | 6;

interface Position {
  row: number;
  col: number;
}

interface Gem {
  type: GemType;
  falling: boolean;
  matched: boolean;
}

const Match3: React.FC<Match3Props> = ({ onScoreUpdate }) => {
  const [board, setBoard] = useState<Gem[][]>(() =>
    Array(GRID_SIZE).fill(null).map(() => 
      Array(GRID_SIZE).fill(null).map(() => ({
        type: (Math.floor(Math.random() * 6) + 1) as GemType,
        falling: false,
        matched: false
      }))
    )
  );
  const [selectedGem, setSelectedGem] = useState<Position | null>(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [combo, setCombo] = useState(0);

  const gemColors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff'];
  const gemShapes = ['💎', '💍', '🔷', '🔶', '🟢', '🟣'];

  const findMatches = useCallback((board: Gem[][]): Position[] => {
    const matches: Position[] = [];
    
    // Check horizontal matches
    for (let row = 0; row < GRID_SIZE; row++) {
      let count = 1;
      let currentType = board[row][0].type;
      
      for (let col = 1; col < GRID_SIZE; col++) {
        if (board[row][col].type === currentType && !board[row][col].matched) {
          count++;
        } else {
          if (count >= 3) {
            for (let i = col - count; i < col; i++) {
              matches.push({ row, col: i });
            }
          }
          count = 1;
          currentType = board[row][col].type;
        }
      }
      
      if (count >= 3) {
        for (let i = GRID_SIZE - count; i < GRID_SIZE; i++) {
          matches.push({ row, col: i });
        }
      }
    }
    
    // Check vertical matches
    for (let col = 0; col < GRID_SIZE; col++) {
      let count = 1;
      let currentType = board[0][col].type;
      
      for (let row = 1; row < GRID_SIZE; row++) {
        if (board[row][col].type === currentType && !board[row][col].matched) {
          count++;
        } else {
          if (count >= 3) {
            for (let i = row - count; i < row; i++) {
              matches.push({ row: i, col });
            }
          }
          count = 1;
          currentType = board[row][col].type;
        }
      }
      
      if (count >= 3) {
        for (let i = GRID_SIZE - count; i < GRID_SIZE; i++) {
          matches.push({ row: i, col });
        }
      }
    }
    
    return matches;
  }, []);

  const removeMatches = useCallback((board: Gem[][], matches: Position[]): Gem[][] => {
    const newBoard = board.map(row => row.map(gem => ({ ...gem })));
    
    matches.forEach(({ row, col }) => {
      newBoard[row][col].matched = true;
    });
    
    return newBoard;
  }, []);

  const dropGems = useCallback((board: Gem[][]): Gem[][] => {
    const newBoard = board.map(row => row.map(gem => ({ ...gem })));
    
    for (let col = 0; col < GRID_SIZE; col++) {
      const column = [];
      
      // Collect non-matched gems
      for (let row = GRID_SIZE - 1; row >= 0; row--) {
        if (!newBoard[row][col].matched) {
          column.push(newBoard[row][col]);
        }
      }
      
      // Fill from bottom
      for (let row = GRID_SIZE - 1; row >= 0; row--) {
        if (column.length > 0) {
          newBoard[row][col] = column.shift()!;
        } else {
          newBoard[row][col] = {
            type: (Math.floor(Math.random() * 6) + 1) as GemType,
            falling: true,
            matched: false
          };
        }
      }
    }
    
    return newBoard;
  }, []);

  const isValidMove = (from: Position, to: Position): boolean => {
    const dx = Math.abs(from.col - to.col);
    const dy = Math.abs(from.row - to.row);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  };

  const swapGems = useCallback((pos1: Position, pos2: Position) => {
    if (!isValidMove(pos1, pos2)) return false;

    const newBoard = board.map(row => row.map(gem => ({ ...gem })));
    const temp = newBoard[pos1.row][pos1.col];
    newBoard[pos1.row][pos1.col] = newBoard[pos2.row][pos2.col];
    newBoard[pos2.row][pos2.col] = temp;

    // Check if this swap creates matches
    const matches = findMatches(newBoard);
    if (matches.length > 0) {
      setBoard(newBoard);
      setMoves(prev => prev + 1);
      processMatches(newBoard);
      return true;
    }
    
    return false;
  }, [board, findMatches]);

  const processMatches = useCallback((board: Gem[][]) => {
    const matches = findMatches(board);
    
    if (matches.length === 0) {
      setCombo(0);
      return;
    }

    setCombo(prev => prev + 1);
    const points = matches.length * 10 * combo;
    setScore(prev => prev + points);

    const boardWithRemovedMatches = removeMatches(board, matches);
    const boardAfterDrop = dropGems(boardWithRemovedMatches);
    
    setBoard(boardAfterDrop);
    
    // Continue processing matches after a delay
    setTimeout(() => {
      processMatches(boardAfterDrop);
    }, 500);
  }, [findMatches, removeMatches, dropGems, combo]);

  const handleGemClick = (row: number, col: number) => {
    if (gameOver || paused) return;

    if (!selectedGem) {
      setSelectedGem({ row, col });
    } else {
      if (selectedGem.row === row && selectedGem.col === col) {
        setSelectedGem(null);
      } else {
        const swapped = swapGems(selectedGem, { row, col });
        setSelectedGem(null);
      }
    }
  };

  const resetGame = () => {
    setBoard(Array(GRID_SIZE).fill(null).map(() => 
      Array(GRID_SIZE).fill(null).map(() => ({
        type: (Math.floor(Math.random() * 6) + 1) as GemType,
        falling: false,
        matched: false
      }))
    ));
    setSelectedGem(null);
    setScore(0);
    setMoves(0);
    setLevel(1);
    setCombo(0);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (score > 0) {
      setLevel(Math.floor(score / 1000) + 1);
      if (onScoreUpdate) {
        onScoreUpdate(score);
      }
    }
  }, [score, onScoreUpdate]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
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
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">MATCH-3</div>
            <div className="text-sm">Score: {score} | Moves: {moves}</div>
            <div className="text-sm">Level: {level} | Combo: {combo}x</div>
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
          className="grid gap-1 bg-gray-800 border-2 border-gray-600 p-2 rounded"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`
          }}
        >
          {board.map((row, rowIndex) =>
            row.map((gem, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  flex items-center justify-center cursor-pointer transition-all duration-200 rounded
                  ${selectedGem?.row === rowIndex && selectedGem?.col === colIndex ? 
                    'ring-2 ring-cyan-400 bg-cyan-900' : 
                    'hover:bg-gray-700'
                  }
                  ${gem.matched ? 'opacity-50' : 'opacity-100'}
                  ${gem.falling ? 'animate-bounce' : ''}
                `}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  backgroundColor: gem.matched ? '#333' : gemColors[gem.type - 1]
                }}
                onClick={() => handleGemClick(rowIndex, colIndex)}
              >
                <span className="text-2xl">
                  {gemShapes[gem.type - 1]}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Click gems to select, then click adjacent gem to swap!</p>
          <p>Match 3 or more gems to score points and create combos!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">GAME OVER!</div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Final Score: {score}</p>
              <p>Moves: {moves}</p>
              <p>Level Reached: {level}</p>
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

export default Match3;