import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Undo } from 'lucide-react';

interface SokobanProps {
  onScoreUpdate?: (score: number) => void;
}

const CELL_SIZE = 40;
const BOARD_WIDTH = 15;
const BOARD_HEIGHT = 12;

// Cell types: 0=empty, 1=wall, 2=target, 3=box, 4=player, 5=box on target, 6=player on target
type CellType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface Position {
  x: number;
  y: number;
}

interface GameState {
  board: CellType[][];
  playerPos: Position;
  moves: number;
  pushes: number;
}

// Simple level for demonstration
const INITIAL_LEVEL: CellType[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,0,0,1,1,1,1,0,0,1],
  [1,0,1,2,2,0,0,0,0,0,0,1,0,0,1],
  [1,0,1,2,2,0,0,3,3,0,0,1,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,4,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,0,0,0,0,0,0,0,0,1,0,0,1],
  [1,0,1,1,1,1,0,0,0,1,1,1,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const Sokoban: React.FC<SokobanProps> = ({ onScoreUpdate }) => {
  const [board, setBoard] = useState<CellType[][]>(() => 
    INITIAL_LEVEL.map(row => [...row])
  );
  const [playerPos, setPlayerPos] = useState<Position>({ x: 4, y: 6 });
  const [moves, setMoves] = useState(0);
  const [pushes, setPushes] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameWon, setGameWon] = useState(false);
  const [paused, setPaused] = useState(false);
  const [history, setHistory] = useState<GameState[]>([]);

  const findPlayerPosition = useCallback((board: CellType[][]): Position => {
    for (let y = 0; y < board.length; y++) {
      for (let x = 0; x < board[y].length; x++) {
        if (board[y][x] === 4 || board[y][x] === 6) {
          return { x, y };
        }
      }
    }
    return { x: 4, y: 6 };
  }, []);

  const saveState = useCallback(() => {
    setHistory(prev => [...prev, {
      board: board.map(row => [...row]),
      playerPos: { ...playerPos },
      moves,
      pushes
    }]);
  }, [board, playerPos, moves, pushes]);

  const undoMove = () => {
    if (history.length === 0) return;
    
    const previousState = history[history.length - 1];
    setBoard(previousState.board);
    setPlayerPos(previousState.playerPos);
    setMoves(previousState.moves);
    setPushes(previousState.pushes);
    setHistory(prev => prev.slice(0, -1));
  };

  const isValidMove = (x: number, y: number, board: CellType[][]): boolean => {
    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) {
      return false;
    }
    return board[y][x] !== 1; // Not a wall
  };

  const movePlayer = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameWon || paused) return;

    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    
    const newX = playerPos.x + dx;
    const newY = playerPos.y + dy;

    if (!isValidMove(newX, newY, board)) return;

    saveState();

    const newBoard = board.map(row => [...row]);
    const targetCell = newBoard[newY][newX];

    // Check if there's a box at the target position
    if (targetCell === 3 || targetCell === 5) {
      const boxNewX = newX + dx;
      const boxNewY = newY + dy;

      // Check if box can be pushed
      if (!isValidMove(boxNewX, boxNewY, newBoard)) return;
      
      const boxTargetCell = newBoard[boxNewY][boxNewX];
      if (boxTargetCell === 3 || boxTargetCell === 5 || boxTargetCell === 4 || boxTargetCell === 6) {
        return; // Can't push box into another box or player
      }

      // Move the box
      const isBoxOnTarget = targetCell === 5;
      const isNewPosTarget = newBoard[boxNewY][boxNewX] === 2;
      
      newBoard[boxNewY][boxNewX] = isNewPosTarget ? 5 : 3;
      newBoard[newY][newX] = isBoxOnTarget ? 2 : 0;
      
      setPushes(prev => prev + 1);
    }

    // Move player
    const currentPlayerCell = newBoard[playerPos.y][playerPos.x];
    const isPlayerOnTarget = currentPlayerCell === 6;
    
    newBoard[playerPos.y][playerPos.x] = isPlayerOnTarget ? 2 : 0;
    
    const isNewPosTarget = newBoard[newY][newX] === 2;
    newBoard[newY][newX] = isNewPosTarget ? 6 : 4;

    setBoard(newBoard);
    setPlayerPos({ x: newX, y: newY });
    setMoves(prev => prev + 1);

    // Check win condition
    const allBoxesOnTargets = newBoard.flat().every(cell => cell !== 3);
    if (allBoxesOnTargets && newBoard.flat().some(cell => cell === 5)) {
      setGameWon(true);
      const score = Math.max(1000 - moves * 10 - pushes * 5, 100);
      if (onScoreUpdate) {
        onScoreUpdate(score);
      }
    }
  }, [playerPos, board, gameWon, paused, moves, pushes, saveState, onScoreUpdate]);

  const resetGame = () => {
    const newBoard = INITIAL_LEVEL.map(row => [...row]);
    setBoard(newBoard);
    setPlayerPos(findPlayerPosition(newBoard));
    setMoves(0);
    setPushes(0);
    setGameWon(false);
    setPaused(false);
    setHistory([]);
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          movePlayer('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          movePlayer('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          movePlayer('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          movePlayer('right');
          break;
        case 'u':
        case 'U':
          e.preventDefault();
          undoMove();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          resetGame();
          break;
        case ' ':
          e.preventDefault();
          setPaused(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [movePlayer]);

  const getCellDisplay = (cell: CellType) => {
    switch (cell) {
      case 0: return null; // Empty
      case 1: return <div className="w-full h-full bg-gray-600 border border-gray-500" />; // Wall
      case 2: return <div className="w-6 h-6 bg-red-400 rounded-full mx-auto mt-4" />; // Target
      case 3: return <div className="w-8 h-8 bg-yellow-600 border-2 border-yellow-500 mx-auto mt-3" />; // Box
      case 4: return <div className="w-6 h-6 bg-cyan-400 rounded-full mx-auto mt-4" />; // Player
      case 5: return <div className="w-8 h-8 bg-green-500 border-2 border-green-400 mx-auto mt-3" />; // Box on target
      case 6: return <div className="w-6 h-6 bg-green-300 rounded-full mx-auto mt-4" />; // Player on target
      default: return null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">MOVES: {moves}</div>
            <div className="text-sm">PUSHES: {pushes} | LEVEL: {level}</div>
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
              onClick={undoMove}
              className="bg-yellow-600 hover:bg-yellow-700 text-white p-2 rounded border border-cyan-400"
              disabled={history.length === 0}
            >
              <Undo className="w-4 h-4" />
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
          className="grid bg-gray-800 border-2 border-gray-600 p-2 gap-1"
          style={{
            gridTemplateColumns: `repeat(${BOARD_WIDTH}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${BOARD_HEIGHT}, ${CELL_SIZE}px)`
          }}
        >
          {board.flat().map((cell, index) => (
            <div
              key={index}
              className="flex items-center justify-center bg-gray-700"
              style={{ width: CELL_SIZE, height: CELL_SIZE }}
            >
              {getCellDisplay(cell)}
            </div>
          ))}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <p><strong>Arrow Keys/WASD</strong> - Move</p>
              <p><strong>U</strong> - Undo Move</p>
            </div>
            <div>
              <p><strong>R</strong> - Restart Level</p>
              <p><strong>Space</strong> - Pause</p>
            </div>
          </div>
          <p className="text-yellow-400">Push all boxes (yellow) onto targets (red)!</p>
        </div>

        {gameWon && (
          <div className="mt-4 text-center">
            <div className="text-green-400 text-2xl font-bold mb-2 retro-font">LEVEL COMPLETE!</div>
            <div className="text-cyan-400 mb-4 retro-font">
              <p>Moves: {moves} | Pushes: {pushes}</p>
              <p>Score: {Math.max(1000 - moves * 10 - pushes * 5, 100)}</p>
            </div>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-bold border-2 border-cyan-400"
            >
              PLAY AGAIN
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

export default Sokoban;