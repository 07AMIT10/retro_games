import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const SEGMENT_SIZE = 20;
const PLAYER_SIZE = 30;
const BULLET_SIZE = 4;
const MUSHROOM_SIZE = 20;

interface Position {
  x: number;
  y: number;
}

interface Segment extends Position {
  id: number;
}

interface Bullet extends Position {
  active: boolean;
}

interface Mushroom extends Position {
  hits: number;
}

interface CentipedeProps {
  onScoreUpdate?: (score: number) => void;
}

const Centipede: React.FC<CentipedeProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Position>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 60 });
  const [centipede, setCentipede] = useState<Segment[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [mushrooms, setMushrooms] = useState<Mushroom[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());

  const createCentipede = useCallback((length: number = 12) => {
    const segments: Segment[] = [];
    for (let i = 0; i < length; i++) {
      segments.push({
        id: i,
        x: i * SEGMENT_SIZE,
        y: 0
      });
    }
    return segments;
  }, []);

  const createMushrooms = useCallback(() => {
    const newMushrooms: Mushroom[] = [];
    for (let i = 0; i < 30 + level * 5; i++) {
      newMushrooms.push({
        x: Math.floor(Math.random() * (CANVAS_WIDTH / MUSHROOM_SIZE)) * MUSHROOM_SIZE,
        y: Math.floor(Math.random() * (CANVAS_HEIGHT / MUSHROOM_SIZE)) * MUSHROOM_SIZE,
        hits: 0
      });
    }
    return newMushrooms;
  }, [level]);

  const shoot = useCallback(() => {
    if (gameOver || paused) return;
    
    setBullets(prev => [
      ...prev,
      {
        x: player.x + PLAYER_SIZE / 2,
        y: player.y,
        active: true
      }
    ]);
  }, [player, gameOver, paused]);

  const updatePlayer = useCallback(() => {
    if (gameOver || paused) return;

    setPlayer(prev => {
      let newX = prev.x;
      let newY = prev.y;

      if (keys.has('ArrowLeft')) {
        newX = Math.max(0, prev.x - 4);
      }
      if (keys.has('ArrowRight')) {
        newX = Math.min(CANVAS_WIDTH - PLAYER_SIZE, prev.x + 4);
      }
      if (keys.has('ArrowUp')) {
        newY = Math.max(CANVAS_HEIGHT / 2, prev.y - 4);
      }
      if (keys.has('ArrowDown')) {
        newY = Math.min(CANVAS_HEIGHT - PLAYER_SIZE, prev.y + 4);
      }

      return { x: newX, y: newY };
    });
  }, [keys, gameOver, paused]);

  const updateCentipede = useCallback(() => {
    if (gameOver || paused) return;

    setCentipede(prevSegments => {
      if (prevSegments.length === 0) return createCentipede();

      return prevSegments.map((segment, index) => {
        let newX = segment.x;
        let newY = segment.y;

        // Move right until hitting edge or mushroom
        newX += 2;

        if (newX >= CANVAS_WIDTH - SEGMENT_SIZE) {
          newX = CANVAS_WIDTH - SEGMENT_SIZE;
          newY += SEGMENT_SIZE;
        }

        // Check mushroom collision
        const hitMushroom = mushrooms.some(mushroom => 
          newX < mushroom.x + MUSHROOM_SIZE &&
          newX + SEGMENT_SIZE > mushroom.x &&
          newY < mushroom.y + MUSHROOM_SIZE &&
          newY + SEGMENT_SIZE > mushroom.y
        );

        if (hitMushroom) {
          newY += SEGMENT_SIZE;
          newX = segment.x - 2;
        }

        return { ...segment, x: newX, y: newY };
      });
    });
  }, [gameOver, paused, mushrooms, createCentipede]);

  const updateBullets = useCallback(() => {
    if (gameOver || paused) return;

    setBullets(prevBullets => 
      prevBullets
        .map(bullet => ({ ...bullet, y: bullet.y - 8 }))
        .filter(bullet => bullet.y > 0)
    );
  }, [gameOver, paused]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Bullet vs Centipede
    setBullets(prevBullets => {
      let newBullets = [...prevBullets];
      
      setCentipede(prevSegments => {
        let newSegments = [...prevSegments];
        let pointsEarned = 0;

        newBullets.forEach((bullet, bulletIndex) => {
          if (!bullet.active) return;

          newSegments.forEach((segment, segmentIndex) => {
            if (
              bullet.x < segment.x + SEGMENT_SIZE &&
              bullet.x + BULLET_SIZE > segment.x &&
              bullet.y < segment.y + SEGMENT_SIZE &&
              bullet.y + BULLET_SIZE > segment.y
            ) {
              newBullets[bulletIndex] = { ...bullet, active: false };
              newSegments.splice(segmentIndex, 1);
              pointsEarned += 10;

              // Add mushroom where segment was hit
              setMushrooms(prev => [...prev, { x: segment.x, y: segment.y, hits: 0 }]);
            }
          });
        });

        if (pointsEarned > 0) {
          setScore(prev => prev + pointsEarned);
        }

        // Check if centipede is destroyed
        if (newSegments.length === 0) {
          setLevel(prev => prev + 1);
          setMushrooms(createMushrooms());
          return createCentipede(12 + level);
        }

        return newSegments;
      });

      return newBullets.filter(bullet => bullet.active);
    });

    // Bullet vs Mushroom
    setBullets(prevBullets => {
      let newBullets = [...prevBullets];
      
      setMushrooms(prevMushrooms => {
        let newMushrooms = [...prevMushrooms];

        newBullets.forEach((bullet, bulletIndex) => {
          if (!bullet.active) return;

          newMushrooms.forEach((mushroom, mushroomIndex) => {
            if (
              bullet.x < mushroom.x + MUSHROOM_SIZE &&
              bullet.x + BULLET_SIZE > mushroom.x &&
              bullet.y < mushroom.y + MUSHROOM_SIZE &&
              bullet.y + BULLET_SIZE > mushroom.y
            ) {
              newBullets[bulletIndex] = { ...bullet, active: false };
              newMushrooms[mushroomIndex] = { ...mushroom, hits: mushroom.hits + 1 };
              
              if (newMushrooms[mushroomIndex].hits >= 4) {
                newMushrooms.splice(mushroomIndex, 1);
                setScore(prev => prev + 1);
              }
            }
          });
        });

        return newMushrooms;
      });

      return newBullets.filter(bullet => bullet.active);
    });

    // Player vs Centipede
    const playerHit = centipede.some(segment =>
      player.x < segment.x + SEGMENT_SIZE &&
      player.x + PLAYER_SIZE > segment.x &&
      player.y < segment.y + SEGMENT_SIZE &&
      player.y + PLAYER_SIZE > segment.y
    );

    if (playerHit) {
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setGameOver(true);
          if (onScoreUpdate) onScoreUpdate(score);
        }
        return newLives;
      });
      setPlayer({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 60 });
    }
  }, [centipede, player, gameOver, paused, level, createMushrooms, createCentipede, score, onScoreUpdate]);

  const resetGame = () => {
    setPlayer({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 60 });
    setCentipede(createCentipede());
    setBullets([]);
    setMushrooms(createMushrooms());
    setScore(0);
    setLives(3);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (centipede.length === 0) {
      setCentipede(createCentipede());
    }
    if (mushrooms.length === 0) {
      setMushrooms(createMushrooms());
    }
  }, [centipede.length, mushrooms.length, createCentipede, createMushrooms]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === ' ') {
        if (paused) {
          setPaused(false);
        } else {
          shoot();
        }
        return;
      }
      if (e.key === 'p') {
        setPaused(prev => !prev);
        return;
      }
      setKeys(prev => new Set(prev).add(e.key));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      setKeys(prev => {
        const newKeys = new Set(prev);
        newKeys.delete(e.key);
        return newKeys;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [shoot, paused]);

  useEffect(() => {
    const gameInterval = setInterval(() => {
      updatePlayer();
      updateCentipede();
      updateBullets();
      checkCollisions();
    }, 50);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateCentipede, updateBullets, checkCollisions]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">SCORE: {score}</div>
            <div className="text-sm">LIVES: {lives} | LEVEL: {level}</div>
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
          className="relative bg-black border-2 border-gray-600 overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Mushrooms */}
          {mushrooms.map((mushroom, index) => (
            <div
              key={index}
              className={`absolute rounded ${
                mushroom.hits === 0 ? 'bg-yellow-400' :
                mushroom.hits === 1 ? 'bg-yellow-500' :
                mushroom.hits === 2 ? 'bg-orange-400' : 'bg-red-400'
              }`}
              style={{
                left: mushroom.x,
                top: mushroom.y,
                width: MUSHROOM_SIZE,
                height: MUSHROOM_SIZE
              }}
            />
          ))}

          {/* Centipede */}
          {centipede.map((segment, index) => (
            <div
              key={segment.id}
              className={`absolute rounded ${
                index === 0 ? 'bg-red-400' : 'bg-green-400'
              }`}
              style={{
                left: segment.x,
                top: segment.y,
                width: SEGMENT_SIZE,
                height: SEGMENT_SIZE
              }}
            />
          ))}

          {/* Player */}
          <div
            className="absolute bg-cyan-400 rounded"
            style={{
              left: player.x,
              top: player.y,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
            }}
          />

          {/* Bullets */}
          {bullets.map((bullet, index) => (
            <div
              key={index}
              className="absolute bg-white rounded-full"
              style={{
                left: bullet.x,
                top: bullet.y,
                width: BULLET_SIZE,
                height: BULLET_SIZE
              }}
            />
          ))}
        </div>

        <div className="mt-4 text-center text-sm text-cyan-400 retro-font">
          <p>Destroy the centipede! Shoot mushrooms to clear the path.</p>
        </div>

        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2 retro-font">GAME OVER!</div>
            <p className="text-cyan-400 mb-4 retro-font">Score: {score}</p>
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

export default Centipede;