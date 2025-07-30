import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, Target, Trophy } from 'lucide-react';

interface SoccerProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;
const BALL_RADIUS = 8;
const GOAL_WIDTH = 140;
const GOAL_HEIGHT = 80;
const PLAYER_RADIUS = 12;
const GOALKEEPER_RADIUS = 15;

interface Position {
  x: number;
  y: number;
}

interface Ball extends Position {
  vx: number;
  vy: number;
  moving: boolean;
  trail: Position[];
  spin: number;
  bounces: number;
}

interface Player extends Position {
  team: 'home' | 'away';
  id: number;
  targetX: number;
  targetY: number;
  speed: number;
  role: 'striker' | 'midfielder' | 'defender' | 'goalkeeper';
  stamina: number;
  hasBall: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface GameMode {
  name: string;
  duration: number;
  description: string;
}

const GAME_MODES: GameMode[] = [
  { name: 'Penalty Shootout', duration: 60, description: 'Score penalties against the keeper' },
  { name: 'Free Kick Master', duration: 90, description: 'Curved shots and wall challenges' },
  { name: 'Skills Challenge', duration: 120, description: 'Dribbling and accuracy tests' }
];

const Soccer: React.FC<SoccerProps> = ({ onScoreUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  
  const [gameMode, setGameMode] = useState(0);
  const [ball, setBall] = useState<Ball>({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT - 80, 
    vx: 0, 
    vy: 0, 
    moving: false,
    trail: [],
    spin: 0,
    bounces: 0
  });
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [goals, setGoals] = useState({ home: 0, away: 0 });
  const [attempts, setAttempts] = useState(0);
  const [gameTime, setGameTime] = useState(GAME_MODES[0].duration);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [lastGoal, setLastGoal] = useState<'home' | 'away' | null>(null);
  const [saves, setSaves] = useState(0);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(0);
  const [wind, setWind] = useState({ x: 0, y: 0 });
  const [powerUpActive, setPowerUpActive] = useState<string | null>(null);
  const [powerUpTimer, setPowerUpTimer] = useState(0);

  const homeGoal = { x: CANVAS_WIDTH / 2 - GOAL_WIDTH / 2, y: 10 };
  const awayGoal = { x: CANVAS_WIDTH / 2 - GOAL_WIDTH / 2, y: CANVAS_HEIGHT - GOAL_HEIGHT - 10 };

  const createPlayers = useCallback(() => {
    const newHomePlayers: Player[] = [];
    const newAwayPlayers: Player[] = [];

    // Home team (attacking up)
    if (gameMode === 0) { // Penalty mode - just goalkeeper
      newAwayPlayers.push({
        id: 0,
        x: CANVAS_WIDTH / 2,
        y: homeGoal.y + GOAL_HEIGHT / 2,
        team: 'away',
        targetX: CANVAS_WIDTH / 2,
        targetY: homeGoal.y + GOAL_HEIGHT / 2,
        speed: 3 + level * 0.5,
        role: 'goalkeeper',
        stamina: 100,
        hasBall: false
      });
    } else {
      // Full team setup for other modes
      const homeFormation = [
        { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100, role: 'striker' },
        { x: CANVAS_WIDTH / 3, y: CANVAS_HEIGHT - 200, role: 'midfielder' },
        { x: 2 * CANVAS_WIDTH / 3, y: CANVAS_HEIGHT - 200, role: 'midfielder' },
        { x: CANVAS_WIDTH / 4, y: CANVAS_HEIGHT - 350, role: 'defender' },
        { x: 3 * CANVAS_WIDTH / 4, y: CANVAS_HEIGHT - 350, role: 'defender' },
      ];

      homeFormation.forEach((pos, i) => {
        newHomePlayers.push({
          id: i,
          x: pos.x,
          y: pos.y,
          team: 'home',
          targetX: pos.x,
          targetY: pos.y,
          speed: 2 + Math.random(),
          role: pos.role as Player['role'],
          stamina: 80 + Math.random() * 20,
          hasBall: false
        });
      });

      // Away team goalkeeper
      newAwayPlayers.push({
        id: 0,
        x: CANVAS_WIDTH / 2,
        y: homeGoal.y + GOAL_HEIGHT / 2,
        team: 'away',
        targetX: CANVAS_WIDTH / 2,
        targetY: homeGoal.y + GOAL_HEIGHT / 2,
        speed: 3 + level * 0.5,
        role: 'goalkeeper',
        stamina: 100,
        hasBall: false
      });
    }

    setHomePlayers(newHomePlayers);
    setAwayPlayers(newAwayPlayers);
  }, [gameMode, level, homeGoal]);

  const addParticles = (x: number, y: number, color: string, count: number = 10, size: number = 2) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 30 + Math.random() * 30,
        color,
        size: size + Math.random() * 2
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  const spawnPowerUp = useCallback(() => {
    if (Math.random() < 0.005 && !powerUpActive) {
      const powerUps = ['precision', 'power', 'curve', 'freeze'];
      const powerUp = powerUps[Math.floor(Math.random() * powerUps.length)];
      setPowerUpActive(powerUp);
      setPowerUpTimer(300); // 5 seconds
      addParticles(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '#ff00ff', 15, 3);
    }
  }, [powerUpActive]);

  const kickBall = useCallback((targetX: number, targetY: number, power: number) => {
    if (ball.moving || gameOver || paused) return;

    const dx = targetX - ball.x;
    const dy = targetY - ball.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    let maxSpeed = 18;
    if (powerUpActive === 'power') maxSpeed = 25;
    if (powerUpActive === 'precision') power = Math.min(power * 1.2, 100);
    
    const speed = Math.min((power / 100) * maxSpeed, maxSpeed);
    let vx = (dx / distance) * speed;
    let vy = (dy / distance) * speed;

    // Add curve for free kicks
    if (gameMode === 1 && powerUpActive === 'curve') {
      vx += (Math.random() - 0.5) * 8;
    }

    // Add wind effect
    vx += wind.x;
    vy += wind.y;
    
    setBall(prev => ({
      ...prev,
      vx,
      vy,
      moving: true,
      trail: [],
      spin: (Math.random() - 0.5) * 0.3,
      bounces: 0
    }));

    setAttempts(prev => prev + 1);
    addParticles(ball.x, ball.y, '#00ff00', 8, 2);

    // Use power-up
    if (powerUpActive) {
      setPowerUpActive(null);
      setPowerUpTimer(0);
    }
  }, [ball, gameOver, paused, gameMode, powerUpActive, wind]);

  const updateBall = useCallback(() => {
    if (!ball.moving || gameOver || paused) return;

    setBall(prev => {
      let newX = prev.x + prev.vx;
      let newY = prev.y + prev.vy;
      let newVx = prev.vx * 0.988; // air resistance
      let newVy = prev.vy * 0.988;
      let newSpin = prev.spin * 0.95;
      let newBounces = prev.bounces;

      // Apply gravity
      newVy += 0.25;

      // Apply wind and spin effects
      if (gameMode === 1) { // Free kick mode
        newVx += newSpin * 0.5;
        newVx += wind.x * 0.1;
        newVy += wind.y * 0.1;
      }

      // Boundary collisions
      if (newX <= BALL_RADIUS || newX >= CANVAS_WIDTH - BALL_RADIUS) {
        newVx = -newVx * 0.75;
        newX = Math.max(BALL_RADIUS, Math.min(CANVAS_WIDTH - BALL_RADIUS, newX));
        newBounces++;
        addParticles(newX, newY, '#ffff00', 5, 1);
      }

      if (newY >= CANVAS_HEIGHT - BALL_RADIUS) {
        newVy = -newVy * 0.6;
        newY = CANVAS_HEIGHT - BALL_RADIUS;
        newBounces++;
        addParticles(newX, newY, '#8b4513', 8, 2);
      }

      // Player collisions
      const allPlayers = [...homePlayers, ...awayPlayers];
      allPlayers.forEach(player => {
        const dist = Math.sqrt((newX - player.x) ** 2 + (newY - player.y) ** 2);
        if (dist <= BALL_RADIUS + PLAYER_RADIUS) {
          if (player.role === 'goalkeeper') {
            // Goalkeeper save
            const angle = Math.atan2(newY - player.y, newX - player.x);
            const saveStrength = 8 + level;
            newVx = Math.cos(angle) * saveStrength;
            newVy = Math.sin(angle) * saveStrength * 0.7;
            setSaves(prev => prev + 1);
            addParticles(player.x, player.y, '#ff0000', 12, 3);
            
            // Increase difficulty
            if (saves > 0 && saves % 3 === 0) {
              setLevel(prev => prev + 1);
            }
          } else {
            // Field player touch
            const touchAngle = Math.atan2(newY - player.y, newX - player.x);
            newVx = Math.cos(touchAngle) * 6;
            newVy = Math.sin(touchAngle) * 4;
            addParticles(player.x, player.y, '#0066ff', 6, 2);
          }
        }
      });

      // Goal collision detection
      const inHomeGoal = newY <= homeGoal.y + GOAL_HEIGHT &&
                        newX >= homeGoal.x && 
                        newX <= homeGoal.x + GOAL_WIDTH &&
                        newY >= homeGoal.y;

      const inAwayGoal = newY >= awayGoal.y &&
                        newX >= awayGoal.x && 
                        newX <= awayGoal.x + GOAL_WIDTH &&
                        newY <= awayGoal.y + GOAL_HEIGHT;

      if (inHomeGoal) {
        // Home team scored
        setGoals(prev => ({ ...prev, home: prev.home + 1 }));
        setLastGoal('home');
        setCombo(prev => prev + 1);
        addParticles(newX, newY, '#00ff00', 25, 4);
        
        setTimeout(() => {
          setBall({
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT - 80,
            vx: 0,
            vy: 0,
            moving: false,
            trail: [],
            spin: 0,
            bounces: 0
          });
          setLastGoal(null);
        }, 2000);

        return { ...prev, x: newX, y: newY, vx: 0, vy: 0, moving: false };
      }

      if (inAwayGoal) {
        // Away team scored
        setGoals(prev => ({ ...prev, away: prev.away + 1 }));
        setLastGoal('away');
        addParticles(newX, newY, '#ff0000', 25, 4);
        
        setTimeout(() => {
          setBall({
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT - 80,
            vx: 0,
            vy: 0,
            moving: false,
            trail: [],
            spin: 0,
            bounces: 0
          });
          setLastGoal(null);
        }, 2000);

        return { ...prev, x: newX, y: newY, vx: 0, vy: 0, moving: false };
      }

      // Top and bottom wall collisions
      if (newY <= BALL_RADIUS) {
        newVy = -newVy * 0.7;
        newY = BALL_RADIUS;
        newBounces++;
        addParticles(newX, newY, '#ffffff', 4, 1);
      }

      // Update trail
      const newTrail = [...prev.trail, { x: newX, y: newY }];
      if (newTrail.length > 20) newTrail.shift();

      // Stop ball if moving too slowly or too many bounces
      if ((Math.abs(newVx) < 0.5 && Math.abs(newVy) < 0.5 && newY > CANVAS_HEIGHT - 100) || newBounces > 8) {
        setTimeout(() => {
          setBall({
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT - 80,
            vx: 0,
            vy: 0,
            moving: false,
            trail: [],
            spin: 0,
            bounces: 0
          });
        }, 1000);

        return { ...prev, x: newX, y: newY, vx: 0, vy: 0, moving: false };
      }

      return { 
        x: newX, 
        y: newY, 
        vx: newVx, 
        vy: newVy, 
        moving: true, 
        trail: newTrail, 
        spin: newSpin, 
        bounces: newBounces 
      };
    });
  }, [ball.moving, gameOver, paused, homePlayers, awayPlayers, homeGoal, awayGoal, saves, level, gameMode, wind]);

  const updatePlayers = useCallback(() => {
    if (gameOver || paused) return;

    // Update goalkeepers
    setAwayPlayers(prev => prev.map(player => {
      if (player.role !== 'goalkeeper') return player;

      const ballDirection = ball.moving ? ball.x : CANVAS_WIDTH / 2;
      let speed = player.speed;
      
      if (powerUpActive === 'freeze') speed *= 0.3; // Slow down goalkeeper
      
      const leftBound = homeGoal.x + GOALKEEPER_RADIUS;
      const rightBound = homeGoal.x + GOAL_WIDTH - GOALKEEPER_RADIUS;
      
      let newX = player.x;
      
      if (ballDirection < player.x - 8 && newX > leftBound) {
        newX = Math.max(leftBound, player.x - speed);
      } else if (ballDirection > player.x + 8 && newX < rightBound) {
        newX = Math.min(rightBound, player.x + speed);
      }
      
      // Add some unpredictability at higher levels
      if (level > 3 && Math.random() < 0.02) {
        newX += (Math.random() - 0.5) * 20;
        newX = Math.max(leftBound, Math.min(rightBound, newX));
      }
      
      return { ...player, x: newX };
    }));

    // Update field players (simple AI)
    setHomePlayers(prev => prev.map(player => {
      let newX = player.x;
      let newY = player.y;
      
      // Move towards ball if close
      const distToBall = Math.sqrt((ball.x - player.x) ** 2 + (ball.y - player.y) ** 2);
      if (distToBall < 100 && !ball.moving) {
        const dx = ball.x - player.x;
        const dy = ball.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > PLAYER_RADIUS + BALL_RADIUS + 5) {
          newX += (dx / distance) * player.speed * 0.5;
          newY += (dy / distance) * player.speed * 0.5;
        }
      } else {
        // Return to formation
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
          newX += (dx / distance) * player.speed * 0.3;
          newY += (dy / distance) * player.speed * 0.3;
        }
      }
      
      return { ...player, x: newX, y: newY };
    }));

    spawnPowerUp();
  }, [ball, gameOver, paused, level, powerUpActive, homeGoal, spawnPowerUp]);

  const updateParticles = useCallback(() => {
    setParticles(prev => 
      prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vx: p.vx * 0.96,
        vy: p.vy * 0.96 + 0.1, // gravity
        life: p.life - 1,
        size: p.size * 0.98
      })).filter(p => p.life > 0)
    );
  }, []);

  const updateWind = useCallback(() => {
    if (gameMode === 1) { // Free kick mode
      setWind(prev => ({
        x: Math.sin(Date.now() * 0.001) * 2,
        y: Math.cos(Date.now() * 0.0008) * 1
      }));
    }
  }, [gameMode]);

  const updatePowerUps = useCallback(() => {
    if (powerUpTimer > 0) {
      setPowerUpTimer(prev => prev - 1);
    } else if (powerUpActive) {
      setPowerUpActive(null);
    }
  }, [powerUpTimer, powerUpActive]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with field background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0d5f2f');
    gradient.addColorStop(0.5, '#0a8f3f');
    gradient.addColorStop(1, '#0d5f2f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw field markings
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    
    // Center circle
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 80, 0, Math.PI * 2);
    ctx.stroke();
    
    // Center line
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT / 2);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    ctx.stroke();

    // Penalty areas
    ctx.strokeRect(homeGoal.x - 60, homeGoal.y, GOAL_WIDTH + 120, 120);
    ctx.strokeRect(awayGoal.x - 60, awayGoal.y - 120, GOAL_WIDTH + 120, 120);

    // Goals
    ctx.fillStyle = '#333333';
    ctx.fillRect(homeGoal.x, homeGoal.y, GOAL_WIDTH, GOAL_HEIGHT);
    ctx.fillRect(awayGoal.x, awayGoal.y, GOAL_WIDTH, GOAL_HEIGHT);
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(homeGoal.x, homeGoal.y, GOAL_WIDTH, GOAL_HEIGHT);
    ctx.strokeRect(awayGoal.x, awayGoal.y, GOAL_WIDTH, GOAL_HEIGHT);

    // Goal nets
    [homeGoal, awayGoal].forEach(goal => {
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 1;
      for (let i = 0; i < GOAL_WIDTH; i += 15) {
        ctx.beginPath();
        ctx.moveTo(goal.x + i, goal.y);
        ctx.lineTo(goal.x + i, goal.y + GOAL_HEIGHT);
        ctx.stroke();
      }
      for (let i = 0; i < GOAL_HEIGHT; i += 15) {
        ctx.beginPath();
        ctx.moveTo(goal.x, goal.y + i);
        ctx.lineTo(goal.x + GOAL_WIDTH, goal.y + i);
        ctx.stroke();
      }
    });

    // Draw wind indicator for free kick mode
    if (gameMode === 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '14px monospace';
      ctx.fillText(`Wind: ${wind.x.toFixed(1)}, ${wind.y.toFixed(1)}`, 10, 30);
      
      // Wind arrow
      const arrowX = 100;
      const arrowY = 30;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX + wind.x * 10, arrowY + wind.y * 10);
      ctx.stroke();
    }

    // Draw particles
    particles.forEach(particle => {
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = particle.life / 60;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw ball trail
    if (ball.trail.length > 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ball.trail.forEach((pos, index) => {
        if (index === 0) {
          ctx.moveTo(pos.x, pos.y);
        } else {
          ctx.lineTo(pos.x, pos.y);
        }
      });
      ctx.stroke();
    }

    // Draw ball with spin effect
    const ballGradient = ctx.createRadialGradient(
      ball.x - 3, ball.y - 3, 0,
      ball.x, ball.y, BALL_RADIUS
    );
    ballGradient.addColorStop(0, '#ffffff');
    ballGradient.addColorStop(1, '#cccccc');
    
    ctx.fillStyle = ballGradient;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    
    // Ball pattern with spin
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.spin * 10);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_RADIUS * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    
    // Pentagon pattern
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(BALL_RADIUS * 0.7 * Math.cos(i * Math.PI * 2 / 5), 
                BALL_RADIUS * 0.7 * Math.sin(i * Math.PI * 2 / 5));
      ctx.stroke();
    }
    ctx.restore();

    // Draw players
    [...homePlayers, ...awayPlayers].forEach(player => {
      const playerGradient = ctx.createRadialGradient(
        player.x - 2, player.y - 2, 0,
        player.x, player.y, PLAYER_RADIUS
      );
      
      if (player.team === 'home') {
        playerGradient.addColorStop(0, '#0066ff');
        playerGradient.addColorStop(1, '#003399');
      } else {
        playerGradient.addColorStop(0, player.role === 'goalkeeper' ? '#ffff00' : '#ff0000');
        playerGradient.addColorStop(1, player.role === 'goalkeeper' ? '#cc9900' : '#990000');
      }
      
      ctx.fillStyle = playerGradient;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.role === 'goalkeeper' ? GOALKEEPER_RADIUS : PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Player number
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(player.id.toString(), player.x, player.y + 3);
    });

    // Draw aiming line
    if (charging && !ball.moving) {
      const dx = mousePos.x - ball.x;
      const dy = mousePos.y - ball.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 200;
      const normalizedDistance = Math.min(distance, maxDistance);
      
      ctx.strokeStyle = `rgba(255, ${255 - power * 2}, 0, ${Math.min(power / 50, 1)})`;
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(
        ball.x + (dx / distance) * normalizedDistance,
        ball.y + (dy / distance) * normalizedDistance
      );
      ctx.stroke();
      ctx.setLineDash([]);

      // Trajectory prediction
      if (power > 30) {
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        
        let predX = ball.x;
        let predY = ball.y;
        let predVx = (dx / distance) * (power / 100) * 18;
        let predVy = (dy / distance) * (power / 100) * 18;
        
        for (let i = 0; i < 50; i++) {
          ctx.lineTo(predX, predY);
          predX += predVx * 0.5;
          predY += predVy * 0.5;
          predVx *= 0.99;
          predVy = predVy * 0.99 + 0.25;
          
          if (predY >= CANVAS_HEIGHT || predY <= 0 || predX <= 0 || predX >= CANVAS_WIDTH) break;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw power meter
    if (charging) {
      const meterWidth = 250;
      const meterHeight = 25;
      const meterX = CANVAS_WIDTH / 2 - meterWidth / 2;
      const meterY = CANVAS_HEIGHT - 50;
      
      ctx.fillStyle = '#000000';
      ctx.fillRect(meterX, meterY, meterWidth, meterHeight);
      
      const powerColor = power > 80 ? '#ff0000' : power > 50 ? '#ffaa00' : '#00ff00';
      ctx.fillStyle = powerColor;
      ctx.fillRect(meterX, meterY, (power / 100) * meterWidth, meterHeight);
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`POWER: ${Math.round(power)}%`, CANVAS_WIDTH / 2, meterY + 18);
    }

    // Power-up indicator
    if (powerUpActive) {
      ctx.fillStyle = 'rgba(255, 0, 255, 0.8)';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`POWER-UP: ${powerUpActive.toUpperCase()}`, CANVAS_WIDTH / 2, 50);
      ctx.fillText(`${Math.ceil(powerUpTimer / 60)}s`, CANVAS_WIDTH / 2, 70);
    }

    // Combo indicator
    if (combo > 1) {
      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`COMBO x${combo}`, CANVAS_WIDTH / 2, 100);
    }

    // Goal celebration
    if (lastGoal) {
      ctx.fillStyle = lastGoal === 'home' ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      ctx.fillStyle = lastGoal === 'home' ? '#00ff00' : '#ff0000';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GOAL!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      
      if (lastGoal === 'home' && combo > 1) {
        ctx.font = 'bold 24px monospace';
        ctx.fillText(`COMBO x${combo}!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
      }
    }
  }, [ball, homePlayers, awayPlayers, particles, charging, power, mousePos, lastGoal, combo, powerUpActive, powerUpTimer, gameMode, wind, homeGoal, awayGoal]);

  const resetGame = () => {
    setBall({ 
      x: CANVAS_WIDTH / 2, 
      y: CANVAS_HEIGHT - 80, 
      vx: 0, 
      vy: 0, 
      moving: false,
      trail: [],
      spin: 0,
      bounces: 0
    });
    setGoals({ home: 0, away: 0 });
    setAttempts(0);
    setSaves(0);
    setGameTime(GAME_MODES[gameMode].duration);
    setPower(0);
    setCharging(false);
    setParticles([]);
    setLastGoal(null);
    setLevel(1);
    setCombo(0);
    setPowerUpActive(null);
    setPowerUpTimer(0);
    setWind({ x: 0, y: 0 });
    setGameOver(false);
    setPaused(false);
    createPlayers();
  };

  // Game timer
  useEffect(() => {
    if (gameTime > 0 && !gameOver && !paused) {
      const timer = setTimeout(() => setGameTime(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (gameTime === 0) {
      setGameOver(true);
      const finalScore = goals.home * 100 + combo * 50 + (attempts > 0 ? Math.floor((goals.home / attempts) * 100) : 0);
      if (onScoreUpdate) onScoreUpdate(finalScore);
    }
  }, [gameTime, gameOver, paused, goals.home, attempts, combo, onScoreUpdate]);

  // Initialize players on game mode change
  useEffect(() => {
    createPlayers();
    setGameTime(GAME_MODES[gameMode].duration);
  }, [gameMode, createPlayers]);

  // Game loop
  useEffect(() => {
    const gameLoop = () => {
      if (!paused && !gameOver) {
        updateBall();
        updatePlayers();
        updateParticles();
        updateWind();
        updatePowerUps();
        
        if (charging) {
          setPower(prev => Math.min(prev + 1.5, 100));
        }
      }
      
      draw();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateBall, updatePlayers, updateParticles, updateWind, updatePowerUps, draw, paused, gameOver, charging]);

  // Mouse/touch events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    };

    const handleMouseDown = () => {
      if (!ball.moving && !gameOver && !paused) {
        setCharging(true);
        setPower(0);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (charging && !ball.moving && !gameOver && !paused) {
        const rect = canvas.getBoundingClientRect();
        kickBall(e.clientX - rect.left, e.clientY - rect.top, power);
        setCharging(false);
        setPower(0);
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [ball.moving, gameOver, paused, charging, power, kickBall]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setPaused(prev => !prev);
      }
      if (e.key >= '1' && e.key <= '3') {
        const mode = parseInt(e.key) - 1;
        if (mode !== gameMode) {
          setGameMode(mode);
          resetGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameMode, resetGame]);

  const accuracy = attempts > 0 ? Math.round((goals.home / attempts) * 100) : 0;

  return (
    <div className="flex flex-col items-center space-y-4 p-4 bg-gradient-to-br from-green-900 via-green-800 to-green-700 min-h-screen text-white">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-2 text-green-100 font-mono tracking-wider">
          ⚽ SOCCER CHAMPIONSHIP ⚽
        </h2>
        <p className="text-green-200 font-mono">{GAME_MODES[gameMode].description}</p>
      </div>

      {/* Game Mode Selector */}
      <div className="flex gap-2 mb-4">
        {GAME_MODES.map((mode, index) => (
          <button
            key={index}
            onClick={() => {
              setGameMode(index);
              resetGame();
            }}
            className={`px-4 py-2 rounded font-mono text-sm border-2 transition-colors ${
              gameMode === index 
                ? 'bg-green-600 border-green-400 text-white' 
                : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {mode.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center font-mono">
        <div className="bg-black/30 rounded-lg p-3 border border-green-400">
          <div className="text-green-400 text-sm">GOALS</div>
          <div className="text-2xl font-bold text-white">{goals.home}</div>
        </div>
        <div className="bg-black/30 rounded-lg p-3 border border-green-400">
          <div className="text-green-400 text-sm">ATTEMPTS</div>
          <div className="text-2xl font-bold text-white">{attempts}</div>
        </div>
        <div className="bg-black/30 rounded-lg p-3 border border-green-400">
          <div className="text-green-400 text-sm">SAVES</div>
          <div className="text-2xl font-bold text-yellow-400">{saves}</div>
        </div>
        <div className="bg-black/30 rounded-lg p-3 border border-green-400">
          <div className="text-green-400 text-sm">LEVEL</div>
          <div className="text-2xl font-bold text-cyan-400">{level}</div>
        </div>
        <div className="bg-black/30 rounded-lg p-3 border border-green-400">
          <div className="text-green-400 text-sm">TIME</div>
          <div className="text-2xl font-bold text-white">{gameTime}s</div>
        </div>
      </div>

      <div className="relative border-4 border-white rounded-lg overflow-hidden shadow-2xl">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block cursor-crosshair"
        />
        
        {gameOver && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center bg-green-800 p-8 rounded-lg border-2 border-green-400">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
              <h3 className="text-3xl font-bold mb-4 text-green-100 font-mono">GAME OVER!</h3>
              <p className="text-xl mb-2 text-white">Goals: {goals.home}</p>
              <p className="text-xl mb-2 text-white">Attempts: {attempts}</p>
              <p className="text-xl mb-2 text-white">Accuracy: {accuracy}%</p>
              <p className="text-xl mb-2 text-white">Level Reached: {level}</p>
              <p className="text-xl mb-2 text-white">Best Combo: {combo}</p>
              <p className="text-lg text-green-400">Final Score: {goals.home * 100 + combo * 50 + Math.floor(accuracy)}</p>
            </div>
          </div>
        )}
        
        {paused && !gameOver && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-4xl font-bold text-white font-mono">PAUSED</div>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setPaused(!paused)}
          disabled={gameOver}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-bold transition-colors border-2 border-green-400 font-mono"
        >
          {paused ? <Play size={20} /> : <Pause size={20} />}
          {paused ? 'RESUME' : 'PAUSE'}
        </button>
        
        <button
          onClick={resetGame}
          className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors border-2 border-red-400 font-mono"
        >
          <RotateCcw size={20} />
          RESET
        </button>
      </div>

      <div className="text-center text-green-200 font-mono text-sm space-y-1">
        <p>🎯 Hold and release to shoot with power! 🖱️ Mouse controls direction</p>
        <p>⌨️ SPACE: Pause • 1-3: Change game mode • 🏆 Score combos for bonus points!</p>
        <p>💫 Collect power-ups: Precision, Power, Curve, Freeze • 🌪️ Watch the wind in Free Kick mode!</p>
      </div>
    </div>
  );
};

export default Soccer;