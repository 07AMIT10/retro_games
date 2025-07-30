import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface AirHockeyProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const PADDLE_RADIUS = 30;
const PUCK_RADIUS = 15;
const MAX_SPEED = 12;
const MIN_SPEED = 0.3;

interface Position {
  x: number;
  y: number;
}

interface Velocity {
  dx: number;
  dy: number;
}

interface Paddle extends Position {
  vx: number;
  vy: number;
}

interface Puck extends Position, Velocity {
  trail: Position[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const AirHockey: React.FC<AirHockeyProps> = ({ onScoreUpdate }) => {
  const [playerPaddle, setPlayerPaddle] = useState<Paddle>({ 
    x: 100, 
    y: CANVAS_HEIGHT / 2,
    vx: 0,
    vy: 0
  });
  const [computerPaddle, setComputerPaddle] = useState<Paddle>({ 
    x: CANVAS_WIDTH - 100, 
    y: CANVAS_HEIGHT / 2,
    vx: 0,
    vy: 0
  });
  const [puck, setPuck] = useState<Puck>({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT / 2, 
    dx: 3, 
    dy: 2,
    trail: []
  });
  const [playerScore, setPlayerScore] = useState(0);
  const [computerScore, setComputerScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [aiDifficulty, setAiDifficulty] = useState(0.7); // Adaptive AI difficulty
  const [combo, setCombo] = useState(0);
  const [lastCollisionTime, setLastCollisionTime] = useState(0);

  const createParticles = (x: number, y: number, color: string, count: number = 8) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      newParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  const resetPuck = (winner: 'player' | 'computer') => {
    const angle = (Math.random() - 0.5) * Math.PI / 3; // Max 30 degrees
    const speed = 4 + Math.random() * 2;
    setPuck({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      dx: (winner === 'player' ? -1 : 1) * Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      trail: []
    });
    setCombo(0);
  };

  const resetGame = () => {
    setPlayerPaddle({ x: 100, y: CANVAS_HEIGHT / 2, vx: 0, vy: 0 });
    setComputerPaddle({ x: CANVAS_WIDTH - 100, y: CANVAS_HEIGHT / 2, vx: 0, vy: 0 });
    setPlayerScore(0);
    setComputerScore(0);
    setGameOver(false);
    setPaused(false);
    setParticles([]);
    setAiDifficulty(0.7);
    setCombo(0);
    resetPuck('player');
  };

  const checkPaddleCollision = (puck: Puck, paddle: Paddle): boolean => {
    const dx = puck.x - paddle.x;
    const dy = puck.y - paddle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= PADDLE_RADIUS + PUCK_RADIUS;
  };

  const limitSpeed = (dx: number, dy: number) => {
    const speed = Math.sqrt(dx * dx + dy * dy);
    if (speed > MAX_SPEED) {
      return {
        dx: (dx / speed) * MAX_SPEED,
        dy: (dy / speed) * MAX_SPEED
      };
    }
    if (speed < MIN_SPEED && speed > 0) {
      return {
        dx: (dx / speed) * MIN_SPEED,
        dy: (dy / speed) * MIN_SPEED
      };
    }
    return { dx, dy };
  };

  const updateGame = useCallback(() => {
    if (gameOver || paused) return;

    // Update player paddle to follow mouse with physics
    setPlayerPaddle(prev => {
      const maxX = CANVAS_WIDTH / 2 - PADDLE_RADIUS;
      const targetX = Math.max(PADDLE_RADIUS, Math.min(maxX, mousePos.x));
      const targetY = Math.max(PADDLE_RADIUS, Math.min(CANVAS_HEIGHT - PADDLE_RADIUS, mousePos.y));
      
      // Add momentum to paddle movement
      const newVx = (targetX - prev.x) * 0.3;
      const newVy = (targetY - prev.y) * 0.3;
      
      return {
        x: targetX,
        y: targetY,
        vx: newVx,
        vy: newVy
      };
    });

    // Enhanced computer AI with adaptive difficulty
    setComputerPaddle(prev => {
      const minX = CANVAS_WIDTH / 2 + PADDLE_RADIUS;
      
      // Predict puck position
      const predictTime = 30;
      const predictedX = puck.x + puck.dx * predictTime;
      const predictedY = puck.y + puck.dy * predictTime;
      
      // AI reaction time and accuracy based on difficulty
      const reactionDelay = (1 - aiDifficulty) * 20;
      const accuracy = 0.5 + aiDifficulty * 0.4;
      
      let targetX = prev.x;
      let targetY = predictedY + (Math.random() - 0.5) * 100 * (1 - accuracy);
      
      // Only react if puck is coming towards AI
      if (puck.dx > 0 && puck.x > CANVAS_WIDTH / 2) {
        targetX = Math.max(minX, Math.min(CANVAS_WIDTH - PADDLE_RADIUS, predictedX));
      }
      
      targetY = Math.max(PADDLE_RADIUS, Math.min(CANVAS_HEIGHT - PADDLE_RADIUS, targetY));
      
      const speed = 3 + aiDifficulty * 2;
      let newX = prev.x;
      let newY = prev.y;
      
      if (Math.abs(targetX - prev.x) > 5) {
        newX += Math.sign(targetX - prev.x) * speed;
      }
      if (Math.abs(targetY - prev.y) > 5) {
        newY += Math.sign(targetY - prev.y) * speed;
      }
      
      const newVx = newX - prev.x;
      const newVy = newY - prev.y;
      
      return {
        x: Math.max(minX, Math.min(CANVAS_WIDTH - PADDLE_RADIUS, newX)),
        y: Math.max(PADDLE_RADIUS, Math.min(CANVAS_HEIGHT - PADDLE_RADIUS, newY)),
        vx: newVx,
        vy: newVy
      };
    });

    // Update puck with enhanced physics
    setPuck(prevPuck => {
      const newX = prevPuck.x + prevPuck.dx;
      let newY = prevPuck.y + prevPuck.dy;
      let newDx = prevPuck.dx;
      let newDy = prevPuck.dy;
      let newTrail = [...prevPuck.trail, { x: prevPuck.x, y: prevPuck.y }];
      
      // Limit trail length
      if (newTrail.length > 10) {
        newTrail = newTrail.slice(-10);
      }

      // Wall collisions with sound effect simulation
      if (newY <= PUCK_RADIUS || newY >= CANVAS_HEIGHT - PUCK_RADIUS) {
        newDy = -newDy * 0.9; // Some energy loss
        newY = Math.max(PUCK_RADIUS, Math.min(CANVAS_HEIGHT - PUCK_RADIUS, newY));
        createParticles(newX, newY, '#ffffff', 6);
      }

      // Player paddle collision with enhanced physics
      if (checkPaddleCollision({ x: newX, y: newY, dx: newDx, dy: newDy, trail: [] }, playerPaddle)) {
        const dx = newX - playerPaddle.x;
        const dy = newY - playerPaddle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          // Transfer paddle momentum to puck
          const puckSpeed = Math.sqrt(newDx * newDx + newDy * newDy);
          const paddleSpeed = Math.sqrt(playerPaddle.vx * playerPaddle.vx + playerPaddle.vy * playerPaddle.vy);
          const totalSpeed = (puckSpeed + paddleSpeed * 0.5) * 1.1;
          
          newDx = (dx / distance) * totalSpeed;
          newDy = (dy / distance) * totalSpeed;
          
          // Add some paddle velocity
          newDx += playerPaddle.vx * 0.3;
          newDy += playerPaddle.vy * 0.3;
          
          const limited = limitSpeed(newDx, newDy);
          newDx = limited.dx;
          newDy = limited.dy;
          
          setCombo(prev => prev + 1);
          createParticles(newX, newY, '#3B82F6', 8);
        }
      }

      // Computer paddle collision
      if (checkPaddleCollision({ x: newX, y: newY, dx: newDx, dy: newDy, trail: [] }, computerPaddle)) {
        const dx = newX - computerPaddle.x;
        const dy = newY - computerPaddle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          const puckSpeed = Math.sqrt(newDx * newDx + newDy * newDy);
          const paddleSpeed = Math.sqrt(computerPaddle.vx * computerPaddle.vx + computerPaddle.vy * computerPaddle.vy);
          const totalSpeed = (puckSpeed + paddleSpeed * 0.5) * 1.1;
          
          newDx = (dx / distance) * totalSpeed;
          newDy = (dy / distance) * totalSpeed;
          
          newDx += computerPaddle.vx * 0.3;
          newDy += computerPaddle.vy * 0.3;
          
          const limited = limitSpeed(newDx, newDy);
          newDx = limited.dx;
          newDy = limited.dy;
          
          // Increase AI difficulty slightly after each hit
          setAiDifficulty(prev => Math.min(0.95, prev + 0.01));
          createParticles(newX, newY, '#EF4444', 8);
        }
      }

      // Scoring with enhanced effects
      if (newX < 0) {
        setComputerScore(prev => {
          const newScore = prev + 1;
          if (newScore >= 7) {
            setGameOver(true);
          }
          return newScore;
        });
        createParticles(50, CANVAS_HEIGHT / 2, '#EF4444', 20);
        resetPuck('computer');
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: -3, dy: 2, trail: [] };
      }

      if (newX > CANVAS_WIDTH) {
        setPlayerScore(prev => {
          const newScore = prev + 1;
          if (newScore >= 7) {
            setGameOver(true);
            const bonusScore = newScore * 100 + combo * 50;
            if (onScoreUpdate) onScoreUpdate(bonusScore);
          }
          return newScore;
        });
        createParticles(CANVAS_WIDTH - 50, CANVAS_HEIGHT / 2, '#3B82F6', 20);
        resetPuck('player');
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: 3, dy: 2, trail: [] };
      }

      // Apply enhanced friction
      const frictionFactor = 0.999;
      newDx *= frictionFactor;
      newDy *= frictionFactor;

      return { x: newX, y: newY, dx: newDx, dy: newDy, trail: newTrail };
    });

    // Update particles
    setParticles(prev => prev.map(particle => ({
      ...particle,
      x: particle.x + particle.vx,
      y: particle.y + particle.vy,
      vx: particle.vx * 0.98,
      vy: particle.vy * 0.98,
      life: particle.life - 0.02
    })).filter(particle => particle.life > 0));

  }, [mousePos, puck, playerPaddle, computerPaddle, gameOver, paused, onScoreUpdate, combo, aiDifficulty]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setPaused(prev => !prev);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  useEffect(() => {
    const gameInterval = setInterval(updateGame, 16);
    return () => clearInterval(gameInterval);
  }, [updateGame]);

  const winner = playerScore >= 7 ? 'Player' : computerScore >= 7 ? 'Computer' : null;
  const puckSpeed = Math.sqrt(puck.dx * puck.dx + puck.dy * puck.dy);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 shadow-2xl retro-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-cyan-400 retro-font">
            <div className="text-lg font-bold">AIR HOCKEY</div>
            <div className="text-sm">Speed: {puckSpeed.toFixed(1)}</div>
            {combo > 5 && <div className="text-yellow-400 text-sm">Combo: {combo}!</div>}
          </div>
          <div className="text-white text-xl font-bold retro-font">
            {playerScore} - {computerScore}
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
          className="relative bg-gradient-to-b from-blue-50 to-blue-100 border-4 border-gray-800 rounded-lg overflow-hidden"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Table markings */}
          <div
            className="absolute border-dashed border-gray-400"
            style={{
              left: CANVAS_WIDTH / 2 - 1,
              top: 20,
              width: 2,
              height: CANVAS_HEIGHT - 40,
              borderWidth: '0 1px'
            }}
          />
          
          {/* Center circle */}
          <div
            className="absolute border-2 border-gray-400 rounded-full"
            style={{
              left: CANVAS_WIDTH / 2 - 30,
              top: CANVAS_HEIGHT / 2 - 30,
              width: 60,
              height: 60
            }}
          />

          {/* Goals */}
          <div
            className="absolute bg-blue-600 border-2 border-blue-800 rounded-r"
            style={{
              left: 0,
              top: CANVAS_HEIGHT / 2 - 60,
              width: 15,
              height: 120
            }}
          />
          <div
            className="absolute bg-red-600 border-2 border-red-800 rounded-l"
            style={{
              left: CANVAS_WIDTH - 15,
              top: CANVAS_HEIGHT / 2 - 60,
              width: 15,
              height: 120
            }}
          />

          {/* Puck trail */}
          {puck.trail.map((pos, index) => (
            <div
              key={index}
              className="absolute bg-gray-600 rounded-full opacity-30"
              style={{
                left: pos.x - (PUCK_RADIUS * 0.5),
                top: pos.y - (PUCK_RADIUS * 0.5),
                width: PUCK_RADIUS,
                height: PUCK_RADIUS,
                opacity: (index / puck.trail.length) * 0.3
              }}
            />
          ))}

          {/* Player paddle */}
          <div
            className="absolute bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-3 border-blue-300 shadow-lg"
            style={{
              left: playerPaddle.x - PADDLE_RADIUS,
              top: playerPaddle.y - PADDLE_RADIUS,
              width: PADDLE_RADIUS * 2,
              height: PADDLE_RADIUS * 2,
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)'
            }}
          />

          {/* Computer paddle */}
          <div
            className="absolute bg-gradient-to-br from-red-400 to-red-600 rounded-full border-3 border-red-300 shadow-lg"
            style={{
              left: computerPaddle.x - PADDLE_RADIUS,
              top: computerPaddle.y - PADDLE_RADIUS,
              width: PADDLE_RADIUS * 2,
              height: PADDLE_RADIUS * 2,
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)'
            }}
          />

          {/* Puck */}
          <div
            className="absolute bg-gradient-to-br from-gray-800 to-black rounded-full border-2 border-gray-600 shadow-xl"
            style={{
              left: puck.x - PUCK_RADIUS,
              top: puck.y - PUCK_RADIUS,
              width: PUCK_RADIUS * 2,
              height: PUCK_RADIUS * 2,
              boxShadow: `0 0 ${puckSpeed * 2}px rgba(255, 255, 255, 0.6)`
            }}
          />

          {/* Particles */}
          {particles.map((particle, index) => (
            <div
              key={index}
              className="absolute rounded-full"
              style={{
                left: particle.x - 2,
                top: particle.y - 2,
                width: 4,
                height: 4,
                backgroundColor: particle.color,
                opacity: particle.life
              }}
            />
          ))}
        </div>

        <div className="mt-4 flex justify-between items-center text-sm text-cyan-400 retro-font">
          <div>Move mouse to control paddle</div>
          <div>AI Level: {Math.floor(aiDifficulty * 100)}%</div>
          <div>First to 7 goals wins!</div>
        </div>

        {gameOver && winner && (
          <div className="mt-4 text-center">
            <div className={`text-2xl font-bold mb-2 retro-font ${
              winner === 'Player' ? 'text-green-400' : 'text-red-400'
            }`}>
              {winner} Wins!
              {winner === 'Player' && combo > 10 && (
                <div className="text-yellow-400 text-lg">Amazing Combo: {combo}!</div>
              )}
            </div>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded border border-cyan-400"
            >
              Play Again
            </button>
          </div>
        )}

        {paused && !gameOver && (
          <div className="mt-4 text-center text-yellow-400 text-lg font-bold retro-font">
            PAUSED
          </div>
        )}
      </div>
    </div>
  );
};

export default AirHockey;