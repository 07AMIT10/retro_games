import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface GalagaProps {
  onScoreUpdate?: (score: number) => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 700;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 30;
const ENEMY_WIDTH = 30;
const ENEMY_HEIGHT = 20;
const BULLET_SIZE = 4;

interface Position {
  x: number;
  y: number;
}

interface Bullet extends Position {
  active: boolean;
  speed: number;
}

interface Enemy extends Position {
  type: 'bee' | 'butterfly' | 'boss';
  active: boolean;
  formation: boolean;
  angle: number;
  speed: number;
  health: number;
  points: number;
  homeX: number;
  homeY: number;
  attackTimer: number;
}

const Galaga: React.FC<GalagaProps> = ({ onScoreUpdate }) => {
  const [player, setPlayer] = useState<Position>({ 
    x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, 
    y: CANVAS_HEIGHT - 50 
  });
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [enemyBullets, setEnemyBullets] = useState<Bullet[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [waveComplete, setWaveComplete] = useState(false);
  const [formationTime, setFormationTime] = useState(0);

  const createEnemies = useCallback(() => {
    const newEnemies: Enemy[] = [];
    const rows = Math.min(4 + Math.floor(level / 2), 6);
    const cols = Math.min(8 + Math.floor(level / 3), 10);
    
    // Create formation
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let enemyType: Enemy['type'];
        let health: number;
        let points: number;
        
        if (row === 0 && col % 2 === 0) {
          enemyType = 'boss';
          health = 2 + Math.floor(level / 5);
          points = 150;
        } else if (row <= 1) {
          enemyType = 'butterfly';
          health = 1 + Math.floor(level / 8);
          points = 80;
        } else {
          enemyType = 'bee';
          health = 1;
          points = 50;
        }
        
        const homeX = 100 + col * 50;
        const homeY = 100 + row * 40;
        
        newEnemies.push({
          x: homeX,
          y: homeY,
          homeX,
          homeY,
          type: enemyType,
          active: true,
          formation: true,
          angle: 0,
          speed: 1 + level * 0.1,
          health,
          points,
          attackTimer: Math.random() * 300 + 200
        });
      }
    }
    
    return newEnemies;
  }, [level]);

  const shoot = useCallback(() => {
    if (gameOver || paused || bullets.length >= 3) return;
    
    setBullets(prev => [
      ...prev,
      {
        x: player.x + PLAYER_WIDTH / 2,
        y: player.y,
        active: true,
        speed: 10
      }
    ]);
  }, [player, bullets.length, gameOver, paused]);

  const updatePlayer = useCallback(() => {
    if (gameOver || paused) return;

    setPlayer(prev => {
      let newX = prev.x;
      
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) {
        newX = Math.max(0, prev.x - 6);
      }
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) {
        newX = Math.min(CANVAS_WIDTH - PLAYER_WIDTH, prev.x + 6);
      }
      
      return { ...prev, x: newX };
    });
  }, [keys, gameOver, paused]);

  const updateBullets = useCallback(() => {
    if (gameOver || paused) return;

    setBullets(prev => 
      prev.map(bullet => ({
        ...bullet,
        y: bullet.y - bullet.speed,
        active: bullet.active && bullet.y > 0
      })).filter(bullet => bullet.active)
    );

    setEnemyBullets(prev =>
      prev.map(bullet => ({
        ...bullet,
        y: bullet.y + bullet.speed,
        active: bullet.active && bullet.y < CANVAS_HEIGHT
      })).filter(bullet => bullet.active)
    );
  }, [gameOver, paused]);

  const updateEnemies = useCallback(() => {
    if (gameOver || paused) return;

    setFormationTime(prev => prev + 1);

    setEnemies(prev => {
      const activeEnemies = prev.filter(enemy => enemy.active);
      
      if (activeEnemies.length === 0) {
        setWaveComplete(true);
        setTimeout(() => {
          setLevel(prevLevel => prevLevel + 1);
          setWaveComplete(false);
          setFormationTime(0);
        }, 2000);
        return createEnemies();
      }

      return prev.map(enemy => {
        if (!enemy.active) return enemy;

        let newX = enemy.x;
        let newY = enemy.y;
        let newFormation = enemy.formation;
        let newAngle = enemy.angle;
        let newAttackTimer = enemy.attackTimer - 1;

        if (enemy.formation) {
          // Formation flying pattern with gentle movement
          const time = formationTime / 100;
          const waveAmplitude = enemy.type === 'boss' ? 15 : 10;
          newX = enemy.homeX + Math.sin(time + enemy.homeX * 0.01) * waveAmplitude;
          newY = enemy.homeY + Math.sin(time * 0.3) * 5;
          
          // Decide to attack
          if (newAttackTimer <= 0 && Math.random() < 0.003) {
            newFormation = false;
            newAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            newAttackTimer = 0;
          }
        } else {
          // Attack pattern - dive toward player then return to formation
          if (newAttackTimer < 120) {
            // Diving attack
            const targetX = player.x + PLAYER_WIDTH / 2;
            const targetY = player.y;
            const dx = targetX - enemy.x;
            const dy = targetY - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 20) {
              newX += (dx / distance) * (enemy.speed + 2);
              newY += (dy / distance) * (enemy.speed + 2);
            }
            
            newAttackTimer++;
          } else {
            // Return to formation
            const dx = enemy.homeX - enemy.x;
            const dy = enemy.homeY - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 10) {
              newX += (dx / distance) * enemy.speed * 1.5;
              newY += (dy / distance) * enemy.speed * 1.5;
            } else {
              newFormation = true;
              newAttackTimer = Math.random() * 400 + 300;
            }
          }
        }

        return {
          ...enemy,
          x: newX,
          y: newY,
          formation: newFormation,
          angle: newAngle,
          attackTimer: newAttackTimer
        };
      });
    });

    // Enhanced enemy shooting
    const shootChance = 0.008 + level * 0.002;
    if (Math.random() < shootChance) {
      const activeEnemies = enemies.filter(enemy => enemy.active);
      if (activeEnemies.length > 0) {
        const shooters = activeEnemies.filter(enemy => 
          !enemy.formation || Math.random() < 0.3
        );
        
        if (shooters.length > 0) {
          const shooter = shooters[Math.floor(Math.random() * shooters.length)];
          const bulletSpeed = shooter.type === 'boss' ? 4 : 3;
          
          setEnemyBullets(prev => [
            ...prev,
            {
              x: shooter.x + ENEMY_WIDTH / 2,
              y: shooter.y + ENEMY_HEIGHT,
              active: true,
              speed: bulletSpeed
            }
          ]);
        }
      }
    }
  }, [enemies, gameOver, paused, createEnemies, player, level, formationTime]);

  const checkCollisions = useCallback(() => {
    if (gameOver || paused) return;

    // Player bullets vs enemies
    setBullets(prevBullets => {
      let newBullets = [...prevBullets];
      
      setEnemies(prevEnemies => {
        let newEnemies = [...prevEnemies];
        let pointsEarned = 0;

        newBullets.forEach((bullet, bulletIndex) => {
          if (!bullet.active) return;

          newEnemies.forEach((enemy, enemyIndex) => {
            if (!enemy.active) return;

            if (
              bullet.x >= enemy.x && 
              bullet.x <= enemy.x + ENEMY_WIDTH &&
              bullet.y >= enemy.y && 
              bullet.y <= enemy.y + ENEMY_HEIGHT
            ) {
              newBullets[bulletIndex] = { ...bullet, active: false };
              newEnemies[enemyIndex] = { 
                ...enemy, 
                health: enemy.health - 1 
              };
              
              if (newEnemies[enemyIndex].health <= 0) {
                newEnemies[enemyIndex].active = false;
                let points = enemy.points * level;
                if (!enemy.formation) points *= 2; // Bonus for hitting attacking enemy
                pointsEarned += points;
              }
            }
          });
        });

        if (pointsEarned > 0) {
          setScore(prev => prev + pointsEarned);
        }

        return newEnemies;
      });

      return newBullets.filter(bullet => bullet.active);
    });

    // Enemy bullets vs player
    setEnemyBullets(prevBullets => {
      const newBullets = prevBullets.filter(bullet => {
        if (!bullet.active) return false;

        if (
          bullet.x >= player.x && 
          bullet.x <= player.x + PLAYER_WIDTH &&
          bullet.y >= player.y && 
          bullet.y <= player.y + PLAYER_HEIGHT
        ) {
          setLives(prev => {
            const newLives = prev - 1;
            if (newLives <= 0) {
              setGameOver(true);
              if (onScoreUpdate) onScoreUpdate(score);
            }
            return newLives;
          });
          return false;
        }

        return true;
      });

      return newBullets;
    });

    // Enemy vs player collision
    const enemyHit = enemies.some(enemy => 
      enemy.active &&
      enemy.x < player.x + PLAYER_WIDTH &&
      enemy.x + ENEMY_WIDTH > player.x &&
      enemy.y < player.y + PLAYER_HEIGHT &&
      enemy.y + ENEMY_HEIGHT > player.y
    );

    if (enemyHit) {
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setGameOver(true);
          if (onScoreUpdate) onScoreUpdate(score);
        }
        return newLives;
      });
    }
  }, [enemies, player, gameOver, paused, score, onScoreUpdate]);

  const resetGame = () => {
    setPlayer({ x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, y: CANVAS_HEIGHT - 50 });
    setBullets([]);
    setEnemies(createEnemies());
    setEnemyBullets([]);
    setScore(0);
    setLives(3);
    setLevel(1);
    setWaveComplete(false);
    setFormationTime(0);
    setGameOver(false);
    setPaused(false);
  };

  useEffect(() => {
    if (enemies.length === 0) {
      setEnemies(createEnemies());
    }
  }, [enemies.length, createEnemies]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      
      if (e.key === ' ') {
        if (gameOver) return;
        if (paused) {
          setPaused(false);
        } else {
          shoot();
        }
        return;
      }
      
      if (e.key === 'p' || e.key === 'P') {
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
  }, [shoot, gameOver, paused]);

  useEffect(() => {
    const gameInterval = setInterval(() => {
      updatePlayer();
      updateBullets();
      updateEnemies();
      checkCollisions();
    }, 16);

    return () => clearInterval(gameInterval);
  }, [updatePlayer, updateBullets, updateEnemies, checkCollisions]);

  const getEnemyColor = (enemy: Enemy) => {
    if