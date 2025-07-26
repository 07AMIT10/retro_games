import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 25;

type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

interface Tetromino {
  type: TetrominoType;
  shape: number[][];
  color: string;
}

const TETROMINOES: Record<TetrominoType, Tetromino> = {
  I: { type: 'I', shape: [[1, 1, 1, 1]], color: '#00f0f0' },
  O: { type: 'O', shape: [[1, 1], [1, 1]], color: '#f0f000' },
  T: { type: 'T', shape: [[0, 1, 0], [1, 1, 1]], color: '#a000f0' },
  S: { type: 'S', shape: [[0, 1, 1], [1, 1, 0]], color: '#00f000' },
  Z: { type: 'Z', shape: [[1, 1, 0], [0, 1, 1]], color: '#f00000' },
  J: { type: 'J', shape: [[1, 0, 0], [1, 1, 1]], color: '#0000f0' },
  L: { type: 'L', shape: [[0, 0, 1], [1, 1, 1]], color: '#f0a000' }
};

interface Position {
  x: number;
  y: number;
}

const Tetris: React.FC = () => {
  const [board, setBoard] = useState<string[][]>(() =>
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(''))
  );
  const [currentPiece, setCurrentPiece] = useState<Tetromino | null>(null);
  const [currentPosition, setCurrentPosition] = useState<Position>({ x: 0, y: 0 });
  const [nextPiece, setNextPiece] = useState<Tetromino | null>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [linesCleared, setLinesCleared] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  const getRandomTetromino = (): Tetromino => {
    const types: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    return TETROMINOES[randomType];
  };

  const rotatePiece = (piece: number[][]): number[][] => {
    const rows = piece.length;
    const cols = piece[0].length;
    const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0));
    
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        rotated[j][rows - 1 - i] = piece[i][j];
      }
    }
    
    return rotated;
  };

  const isValidPosition = (piece: Tetromino, position: Position, testBoard?: string[][]): boolean => {
    const boardToCheck = testBoard || board;
    
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = position.x + x;
          const newY = position.y + y;
          
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
            return false;
          }
          
          if (newY >= 0 && boardToCheck[newY][newX]) {
            return false;
          }
        }
      }
    }
    
    return true;
  };

  const placePiece = useCallback(() => {
    if (!currentPiece) return;

    const newBoard = board.map(row => [...row]);
    
    for (let y = 0; y < currentPiece.shape.length; y++) {
      for (let x = 0; x < currentPiece.shape[y].length; x++) {
        if (currentPiece.shape[y][x]) {
          const boardY = currentPosition.y + y;
          const boardX = currentPosition.x + x;
          if (boardY >= 0) {
            newBoard[boardY][boardX] = currentPiece.color;
          }
        }
      }
    }

    // Clear complete lines
    const fullLines: number[] = [];
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      if (newBoard[y].every(cell => cell !== '')) {
        fullLines.push(y);
      }
    }

    if (fullLines.length > 0) {
      fullLines.reverse().forEach(lineIndex => {
        newBoard.splice(lineIndex, 1);
        newBoard.unshift(Array(BOARD_WIDTH).fill(''));
      });

      const points = [0, 100, 300, 500, 800][fullLines.length] * level;
      setScore(prev => prev + points);
      setLinesCleared(prev => prev + fullLines.length);
      setLevel(Math.floor(linesCleared / 10) + 1);
    }

    setBoard(newBoard);
    setCurrentPiece(nextPiece);
    setNextPiece(getRandomTetromino());
    setCurrentPosition({ x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 });
  }, [board, currentPiece, currentPosition, nextPiece, level, linesCleared]);

  const spawnNewPiece = useCallback(() => {
    if (!nextPiece) return;
    
    const newPosition = { x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 };
    
    if (!isValidPosition(nextPiece, newPosition)) {
      setGameOver(true);
      return;
    }
    
    setCurrentPiece(nextPiece);
    setCurrentPosition(newPosition);
    setNextPiece(getRandomTetromino());
  }, [nextPiece, board]);

  const movePiece = (dx: number, dy: number) => {
    if (!currentPiece || gameOver || paused) return;
    
    const newPosition = { x: currentPosition.x + dx, y: currentPosition.y + dy };
    
    if (isValidPosition(currentPiece, newPosition)) {
      setCurrentPosition(newPosition);
    } else if (dy > 0) {
      placePiece();
    }
  };

  const rotatePieceAction = () => {
    if (!currentPiece || gameOver || paused) return;
    
    const rotated = { ...currentPiece, shape: rotatePiece(currentPiece.shape) };
    
    if (isValidPosition(rotated, currentPosition)) {
      setCurrentPiece(rotated);
    }
  };

  const resetGame = () => {
    setBoard(Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill('')));
    setCurrentPiece(getRandomTetromino());
    setNextPiece(getRandomTetromino());
    setCurrentPosition({ x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 });
    setScore(0);
    setLevel(1);
    setLinesCleared(0);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (!currentPiece) {
      setCurrentPiece(getRandomTetromino());
      setNextPiece(getRandomTetromino());
    }
  }, [currentPiece]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          movePiece(-1, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          movePiece(1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          movePiece(0, 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          rotatePieceAction();
          break;
        case ' ':
          e.preventDefault();
          if (!gameOver) {
            if (paused) {
              setPaused(false);
            } else {
              // Hard drop
              let dropDistance = 0;
              while (currentPiece && isValidPosition(currentPiece, { 
                x: currentPosition.x, 
                y: currentPosition.y + dropDistance + 1 
              })) {
                dropDistance++;
              }
              movePiece(0, dropDistance);
            }
          }
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
  }, [currentPiece, currentPosition, gameOver, paused]);

  useEffect(() => {
    if (!gameOver && !paused) {
      const dropInterval = setInterval(() => {
        movePiece(0, 1);
      }, Math.max(50, 500 - (level - 1) * 50));

      return () => clearInterval(dropInterval);
    }
  }, [level, gameOver, paused, currentPiece, currentPosition]);

  const renderBoard = () => {
    const displayBoard = board.map(row => [...row]);
    
    if (currentPiece) {
      for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
          if (currentPiece.shape[y][x]) {
            const boardY = currentPosition.y + y;
            const boardX = currentPosition.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              displayBoard[boardY][boardX] = currentPiece.color;
            }
          }
        }
      }
    }
    
    return displayBoard;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="flex gap-6">
        {/* Game Board */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-xl font-bold">Tetris</h2>
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
            className="grid border-2 border-gray-600 bg-black"
            style={{
              gridTemplateColumns: `repeat(${BOARD_WIDTH}, ${CELL_SIZE}px)`,
              gridTemplateRows: `repeat(${BOARD_HEIGHT}, ${CELL_SIZE}px)`,
              width: BOARD_WIDTH * CELL_SIZE,
              height: BOARD_HEIGHT * CELL_SIZE
            }}
          >
            {renderBoard().flat().map((cell, index) => (
              <div
                key={index}
                className="border border-gray-700"
                style={{
                  backgroundColor: cell || 'transparent',
                  width: CELL_SIZE,
                  height: CELL_SIZE
                }}
              />
            ))}
          </div>
        </div>

        {/* Info Panel */}
        <div className="bg-gray-800 p-4 rounded-lg text-white space-y-4">
          <div>
            <h3 className="font-bold mb-2">Score</h3>
            <p className="text-2xl text-green-400">{score}</p>
          </div>
          
          <div>
            <h3 className="font-bold mb-2">Level</h3>
            <p className="text-xl text-blue-400">{level}</p>
          </div>
          
          <div>
            <h3 className="font-bold mb-2">Lines</h3>
            <p className="text-xl text-purple-400">{linesCleared}</p>
          </div>
          
          <div>
            <h3 className="font-bold mb-2">Next</h3>
            <div className="bg-gray-700 p-2 rounded" style={{ width: '80px', height: '80px' }}>
              {nextPiece && (
                <div className="grid gap-1" style={{ 
                  gridTemplateColumns: `repeat(${nextPiece.shape[0].length}, 1fr)` 
                }}>
                  {nextPiece.shape.flat().map((cell, index) => (
                    <div
                      key={index}
                      className="w-4 h-4 border border-gray-600"
                      style={{ backgroundColor: cell ? nextPiece.color : 'transparent' }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-400 space-y-1">
            <p><strong>↑</strong> Rotate</p>
            <p><strong>←→</strong> Move</p>
            <p><strong>↓</strong> Soft Drop</p>
            <p><strong>Space</strong> Hard Drop</p>
            <p><strong>P</strong> Pause</p>
          </div>
        </div>
      </div>

      {gameOver && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-gray-800 p-8 rounded-lg text-center">
            <h2 className="text-3xl font-bold text-red-400 mb-4">Game Over</h2>
            <p className="text-white mb-2">Final Score: {score}</p>
            <p className="text-white mb-6">Lines Cleared: {linesCleared}</p>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {paused && !gameOver && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-gray-800 p-8 rounded-lg text-center">
            <h2 className="text-3xl font-bold text-yellow-400 mb-4">Paused</h2>
            <p className="text-white mb-6">Press P or the pause button to continue</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tetris;