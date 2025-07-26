import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface ConnectFourProps {
  onScoreUpdate?: (score: number) => void;
}

const BOARD_ROWS = 6;
const BOARD_COLS = 7;
const CELL_SIZE = 60;

type Player = 1 | 2;
type Cell = 0 | Player;

const ConnectFour: React.FC<ConnectFourProps> = ({ onScoreUpdate }) => {
  const [board, setBoard] = useState<Cell[][]>(() =>
    Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(0))
  );
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [selectedColumn, setSelectedColumn] = useState<number>(0);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [paused, setPaused] = useState(false);
  const [gameCount, setGameCount] = useState(0);

  const checkWinner = useCallback((board: Cell[][], row: number, col: number, player: Player): boolean => {
    const directions = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal \
      [1, -1]   // diagonal /
    ];

    for (const [dx, dy] of directions) {
      let count = 1;
      
      // Check in positive direction
      for (let i = 1; i < 4; i++) {
        const newRow = row + dx * i;
        const newCol = col + dy * i;
        if (newRow >= 0 && newRow < BOARD_ROWS && newCol >= 0 && newCol < BOARD_COLS && board[newRow][newCol] === player) {
          count++;
        } else {
          break;
        }
      }
      
      // Check in negative direction
      for (let i = 1; i < 4; i++) {
        const newRow = row - dx * i;
        const newCol = col - dy * i;
        if (newRow >= 0 && newRow < BOARD_ROWS && newCol >= 0 && newCol < BOARD_COLS && board[newRow][newCol] === player) {
          count++;
        } else {
          break;
        }
      }
      
      if (count >= 4) {
        return true;
      }
    }
    
    return false;
  }, []);

  const dropPiece = useCallback((col: number) => {
    if (gameOver || paused) return;

    // Find the lowest empty row in the column
    let row = -1;
    for (let r = BOARD_ROWS - 1; r >= 0; r--) {
      if (board[r][col] === 0) {
        row = r;
        break;
      }
    }

    if (row === -1) return; // Column is full

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);

    // Check for winner
    if (checkWinner(newBoard, row, col, currentPlayer)) {
      setWinner(currentPlayer);
      setGameOver(true);
      setScore(prev => {
        const newScore = currentPlayer === 1 ? 
          { ...prev, player1: prev.player1 + 1 } : 
          { ...prev, player2: prev.player2 + 1 };
        
        if (onScoreUpdate) {
          onScoreUpdate((newScore.player1 + newScore.player2) * 100);
        }
        
        return newScore;
      });
      return;
    }

    // Check for draw
    if (newBoard.every(row => row.every(cell => cell !== 0))) {
      setIsDraw(true);
      setGameOver(true);
      return;
    }

    setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
  }, [board, currentPlayer, gameOver, paused, checkWinner, onScoreUpdate]);

  const resetGame = () => {
    setBoard(Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(0)));
    setCurrentPlayer(1);
    setSelectedColumn(0);
    setGameOver(false);
    setWinner(null);
    setIsDraw(false);
    setPaused(false);
  };

  const newGame = () => {
    resetGame();
    setGameCount(prev => prev + 1);
  };

  const resetScore = () => {
    setScore({ player1: 0, player2: 0 });
    setGameCount(0);
    resetGame();
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setSelectedColumn(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setSelectedColumn(prev => Math.min(BOARD_COLS - 1, prev + 1));
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          if (gameOver) {
            newGame();
          } else {
            dropPiece(selectedColumn);
          }
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          resetGame();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          setPaused(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedColumn, gameOver, dropPiece]);

  const getColumnHeight = (col: number): number => {
    for (let row = 0; row < BOARD_ROWS; row++) {
      if (board[row][col] === 0) {
        return BOARD_ROWS - row;
      }
    }
    return 0;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">CONNECT FOUR</div>
            <div className="text-sm">Game #{gameCount + 1}</div>
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

        {/* Score Display */}
        <div className="flex justify-between mb-4 text-center">
          <div className={`p-3 rounded border-2 ${currentPlayer === 1 ? 'border-red-400 bg-red-900' : 'border-gray-600'}`}>
            <div className="text-red-400 font-bold retro-font">PLAYER 1</div>
            <div className="text-white text-xl">{score.player1}</div>
          </div>
          <div className="flex items-center text-cyan-400 retro-font text-lg font-bold">
            VS
          </div>
          <div className={`p-3 rounded border-2 ${currentPlayer === 2 ? 'border-yellow-400 bg-yellow-900' : 'border-gray-600'}`}>
            <div className="text-yellow-400 font-bold retro-font">PLAYER 2</div>
            <div className="text-white text-xl">{score.player2}</div>
          </div>
        </div>

        {/* Column selector */}
        <div className="mb-2">
          <div 
            className="flex justify-center"
            style={{ width: BOARD_COLS * CELL_SIZE }}
          >
            <div
              className={`w-12 h-12 rounded-full border-3 transition-all duration-200 ${
                currentPlayer === 1 ? 'bg-red-500 border-red-400' : 'bg-yellow-500 border-yellow-400'
              }`}
              style={{
                marginLeft: selectedColumn * CELL_SIZE + (CELL_SIZE - 48) / 2,
                opacity: gameOver ? 0 : 1
              }}
            />
          </div>
        </div>

        {/* Game Board */}
        <div
          className="grid bg-blue-800 border-4 border-blue-600 rounded-lg p-2 gap-1"
          style={{
            gridTemplateColumns: `repeat(${BOARD_COLS}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${BOARD_ROWS}, ${CELL_SIZE}px)`
          }}
        >
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="flex items-center justify-center bg-blue-900 rounded-full cursor-pointer hover:bg-blue-700 transition-colors duration-200"
                style={{ width: CELL_SIZE, height: CELL_SIZE }}
                onClick={() => {
                  setSelectedColumn(colIndex);
                  dropPiece(colIndex);
                }}
              >
                {cell === 1 && (
                  <div className="w-12 h-12 bg-red-500 rounded-full border-2 border-red-400" />
                )}
                {cell === 2 && (
                  <div className="w-12 h-12 bg-yellow-500 rounded-full border-2 border-yellow-400" />
                )}
                {cell === 0 && (
                  <div className="w-12 h-12 bg-gray-800 rounded-full border border-gray-600" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Column indicators */}
        <div className="flex justify-center mt-2 space-x-1">
          {Array(BOARD_COLS).fill(null).map((_, col) => (
            <div
              key={col}
              className={`w-12 h-6 flex items-center justify-center rounded cursor-pointer transition-all duration-200 ${
                selectedColumn === col ? 'bg-cyan-400 text-black' : 'bg-gray-700 text-cyan-400'
              } ${getColumnHeight(col) === 0 ? 'opacity-50' : 'hover:bg-cyan-500'}`}
              onClick={() => {
                setSelectedColumn(col);
                dropPiece(col);
              }}
            >
              <span className="text-xs font-bold retro-font">{col + 1}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <p><strong>←→</strong> Select Column</p>
              <p><strong>Space/Enter</strong> Drop Piece</p>
            </div>
            <div>
              <p><strong>R</strong> Restart Game</p>
              <p><strong>P</strong> Pause</p>
            </div>
          </div>
          <p className="text-yellow-400">Connect four pieces vertically, horizontally, or diagonally to win!</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            {winner && (
              <div className={`text-2xl font-bold mb-2 retro-font ${
                winner === 1 ? 'text-red-400' : 'text-yellow-400'
              }`}>
                PLAYER {winner} WINS!
              </div>
            )}
            {isDraw && (
              <div className="text-cyan-400 text-2xl font-bold mb-2 retro-font">
                IT'S A DRAW!
              </div>
            )}
            <div className="flex justify-center space-x-4 mt-4">
              <button
                onClick={newGame}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-bold border-2 border-cyan-400"
              >
                NEW GAME
              </button>
              <button
                onClick={resetScore}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded font-bold border-2 border-cyan-400"
              >
                RESET SCORE
              </button>
            </div>
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

export default ConnectFour;