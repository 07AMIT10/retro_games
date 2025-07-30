import React, { useState, useEffect } from 'react';
import { Gamepad2, Home, Play, Zap, Car, Target, Puzzle } from 'lucide-react';

// Import all games
import Snake from './games/arcade/Snake';
import PacMan from './games/arcade/PacMan';
import Frogger from './games/arcade/Frogger';
import Centipede from './games/arcade/Centipede';
import Asteroids from './games/arcade/Asteroids';
import Breakout from './games/arcade/Breakout';
import MissileCommand from './games/arcade/MissileCommand';

import Tetris from './games/puzzle/Tetris';
import Game2048 from './games/puzzle/Game2048';
import Sokoban from './games/puzzle/Sokoban';
import ConnectFour from './games/puzzle/ConnectFour';
import Sudoku from './games/puzzle/Sudoku';
import Match3 from './games/puzzle/Match3';
import SlidingPuzzle from './games/puzzle/SlidingPuzzle';

import Pong from './games/sports/Pong';
import Basketball from './games/sports/Basketball';
import Tennis from './games/sports/Tennis';
import AirHockey from './games/sports/AirHockey';
import Bowling from './games/sports/Bowling';
import Golf from './games/sports/Golf';
import Soccer from './games/sports/Soccer';

import SpaceInvaders from './games/shooter/SpaceInvaders';
import Galaga from './games/shooter/Galaga';
import Defender from './games/shooter/Defender';
import Phoenix from './games/shooter/Phoenix';
import CentipedeShooter from './games/shooter/CentipedeShooter';
import MissileDefense from './games/shooter/MissileDefense';
import LaserDefense from './games/shooter/LaserDefense';

import RoadRacer from './games/racing/RoadRacer';
import CircuitRacer from './games/racing/CircuitRacer';
import F1Racing from './games/racing/F1Racing';
import DragRacing from './games/racing/DragRacing';
import MountainRacing from './games/racing/MountainRacing';
import DesertRally from './games/racing/DesertRally';
import SpeedChase from './games/racing/SpeedChase';

import { getHighScore, saveHighScore } from './utils/scoring';

type GameType = 'arcade' | 'puzzle' | 'sports' | 'shooter' | 'racing';
type FilterType = GameType | 'all';

interface Game {
  id: string;
  name: string;
  type: GameType;
  description: string;
  icon: string;
  component: React.ComponentType<{ onScoreUpdate?: (score: number) => void }>;
  controls: string[];
  highScoreKey: string;
}

const games: Game[] = [
  // Arcade Games
  {
    id: 'snake',
    name: 'Snake',
    type: 'arcade',
    description: 'Guide the snake to eat food and grow longer without hitting walls or yourself.',
    icon: '🐍',
    component: Snake,
    controls: ['Arrow Keys - Move', 'Space - Pause'],
    highScoreKey: 'snake_high_score'
  },
  {
    id: 'pacman',
    name: 'Pac-Man',
    type: 'arcade',
    description: 'Navigate the maze, collect dots, and avoid the ghosts.',
    icon: '👻',
    component: PacMan,
    controls: ['Arrow Keys - Move', 'Space - Pause'],
    highScoreKey: 'pacman_high_score'
  },
  {
    id: 'frogger',
    name: 'Frogger',
    type: 'arcade',
    description: 'Help the frog cross busy roads and rivers safely.',
    icon: '🐸',
    component: Frogger,
    controls: ['Arrow Keys - Move', 'Space - Pause'],
    highScoreKey: 'frogger_high_score'
  },
  {
    id: 'centipede',
    name: 'Centipede',
    type: 'arcade',
    description: 'Shoot the descending centipede and avoid the mushrooms.',
    icon: '🐛',
    component: Centipede,
    controls: ['Arrow Keys - Move', 'Space - Shoot'],
    highScoreKey: 'centipede_high_score'
  },
  {
    id: 'asteroids',
    name: 'Asteroids',
    type: 'arcade',
    description: 'Navigate space and destroy asteroids with your ship.',
    icon: '🚀',
    component: Asteroids,
    controls: ['Arrow Keys - Move/Rotate', 'Space - Shoot'],
    highScoreKey: 'asteroids_high_score'
  },
  {
    id: 'breakout',
    name: 'Breakout',
    type: 'arcade',
    description: 'Break all the bricks with the bouncing ball.',
    icon: '🧱',
    component: Breakout,
    controls: ['Arrow Keys - Move Paddle', 'Space - Launch'],
    highScoreKey: 'breakout_high_score'
  },
  {
    id: 'missile-command',
    name: 'Missile Command',
    type: 'arcade',
    description: 'Defend your cities from incoming missiles.',
    icon: '🚀',
    component: MissileCommand,
    controls: ['Mouse - Aim/Shoot', 'Space - Pause'],
    highScoreKey: 'missile_command_high_score'
  },

  // Puzzle Games
  {
    id: 'tetris',
    name: 'Tetris',
    type: 'puzzle',
    description: 'Stack falling blocks to create complete lines and clear them.',
    icon: '🧩',
    component: Tetris,
    controls: ['Arrow Keys - Move/Rotate', 'Space - Drop'],
    highScoreKey: 'tetris_high_score'
  },
  {
    id: '2048',
    name: '2048',
    type: 'puzzle',
    description: 'Combine tiles to reach the 2048 tile.',
    icon: '🔢',
    component: Game2048,
    controls: ['Arrow Keys - Move', 'R - Restart'],
    highScoreKey: '2048_high_score'
  },
  {
    id: 'sokoban',
    name: 'Sokoban',
    type: 'puzzle',
    description: 'Push boxes to their target positions.',
    icon: '📦',
    component: Sokoban,
    controls: ['Arrow Keys - Move', 'U - Undo', 'R - Restart'],
    highScoreKey: 'sokoban_high_score'
  },
  {
    id: 'connect-four',
    name: 'Connect Four',
    type: 'puzzle',
    description: 'Connect four pieces in a row to win.',
    icon: '🔴',
    component: ConnectFour,
    controls: ['Arrow Keys - Move', 'Space - Drop', 'R - Restart'],
    highScoreKey: 'connect_four_high_score'
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    type: 'puzzle',
    description: 'Fill the grid with numbers 1-9 following the rules.',
    icon: '🔢',
    component: Sudoku,
    controls: ['Click - Select', 'Numbers - Fill', 'Delete - Clear'],
    highScoreKey: 'sudoku_high_score'
  },
  {
    id: 'match3',
    name: 'Match-3',
    type: 'puzzle',
    description: 'Match three or more gems to clear them.',
    icon: '💎',
    component: Match3,
    controls: ['Click & Drag - Swap', 'Space - Pause'],
    highScoreKey: 'match3_high_score'
  },
  {
    id: 'sliding-puzzle',
    name: 'Sliding Puzzle',
    type: 'puzzle',
    description: 'Arrange the numbered tiles in order.',
    icon: '🧩',
    component: SlidingPuzzle,
    controls: ['Click - Move Tile', 'R - Shuffle'],
    highScoreKey: 'sliding_puzzle_high_score'
  },

  // Sports Games
  {
    id: 'pong',
    name: 'Pong',
    type: 'sports',
    description: 'Classic table tennis game. First to 10 points wins!',
    icon: '🏓',
    component: Pong,
    controls: ['W/S - Left Paddle', 'Up/Down - Right Paddle'],
    highScoreKey: 'pong_high_score'
  },
  {
    id: 'basketball',
    name: 'Basketball',
    type: 'sports',
    description: 'Shoot hoops and score as many baskets as possible.',
    icon: '🏀',
    component: Basketball,
    controls: ['Mouse - Aim', 'Click - Shoot'],
    highScoreKey: 'basketball_high_score'
  },
  {
    id: 'tennis',
    name: 'Tennis',
    type: 'sports',
    description: 'Rally against the computer in this tennis match.',
    icon: '🎾',
    component: Tennis,
    controls: ['Arrow Keys - Move', 'Space - Hit'],
    highScoreKey: 'tennis_high_score'
  },
  {
    id: 'air-hockey',
    name: 'Air Hockey',
    type: 'sports',
    description: 'Fast-paced air hockey against the computer.',
    icon: '🏒',
    component: AirHockey,
    controls: ['Mouse - Move Paddle', 'Click - Power Shot'],
    highScoreKey: 'air_hockey_high_score'
  },
  {
    id: 'bowling',
    name: 'Bowling',
    type: 'sports',
    description: 'Roll strikes and spares in this bowling game.',
    icon: '🎳',
    component: Bowling,
    controls: ['Arrow Keys - Aim', 'Space - Roll'],
    highScoreKey: 'bowling_high_score'
  },
  {
    id: 'golf',
    name: 'Golf',
    type: 'sports',
    description: 'Complete the course with the lowest score.',
    icon: '⛳',
    component: Golf,
    controls: ['Mouse - Aim', 'Click - Swing'],
    highScoreKey: 'golf_high_score'
  },
  {
    id: 'soccer',
    name: 'Soccer',
    type: 'sports',
    description: 'Score goals in this penalty shootout game.',
    icon: '⚽',
    component: Soccer,
    controls: ['Mouse - Aim', 'Click - Kick'],
    highScoreKey: 'soccer_high_score'
  },

  // Shooter Games
  {
    id: 'space-invaders',
    name: 'Space Invaders',
    type: 'shooter',
    description: 'Defend Earth by shooting down waves of alien invaders.',
    icon: '🛸',
    component: SpaceInvaders,
    controls: ['Left/Right - Move', 'Space - Shoot'],
    highScoreKey: 'space_invaders_high_score'
  },
  {
    id: 'galaga',
    name: 'Galaga',
    type: 'shooter',
    description: 'Shoot alien formations and rescue captured ships.',
    icon: '🚀',
    component: Galaga,
    controls: ['Left/Right - Move', 'Space - Shoot'],
    highScoreKey: 'galaga_high_score'
  },
  {
    id: 'defender',
    name: 'Defender',
    type: 'shooter',
    description: 'Protect humanoids from alien abduction.',
    icon: '🛡️',
    component: Defender,
    controls: ['Arrow Keys - Move', 'Space - Shoot'],
    highScoreKey: 'defender_high_score'
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    type: 'shooter',
    description: 'Battle through waves of alien phoenix birds.',
    icon: '🔥',
    component: Phoenix,
    controls: ['Arrow Keys - Move', 'Space - Shoot'],
    highScoreKey: 'phoenix_high_score'
  },
  {
    id: 'centipede-shooter',
    name: 'Centipede Shooter',
    type: 'shooter',
    description: 'Advanced centipede shooting with power-ups.',
    icon: '🎯',
    component: CentipedeShooter,
    controls: ['Arrow Keys - Move', 'Space - Shoot'],
    highScoreKey: 'centipede_shooter_high_score'
  },
  {
    id: 'missile-defense',
    name: 'Missile Defense',
    type: 'shooter',
    description: 'Intercept incoming missiles to protect your base.',
    icon: '🎯',
    component: MissileDefense,
    controls: ['Mouse - Target', 'Click - Launch'],
    highScoreKey: 'missile_defense_high_score'
  },
  {
    id: 'laser-defense',
    name: 'Laser Defense',
    type: 'shooter',
    description: 'Use laser cannons to defend against alien waves.',
    icon: '⚡',
    component: LaserDefense,
    controls: ['Arrow Keys - Move', 'Space - Laser'],
    highScoreKey: 'laser_defense_high_score'
  },

  // Racing Games
  {
    id: 'road-racer',
    name: 'Road Racer',
    type: 'racing',
    description: 'Navigate through traffic at high speeds. Avoid crashes and collect points!',
    icon: '🏎️',
    component: RoadRacer,
    controls: ['Arrow Keys - Steer', 'Space - Brake'],
    highScoreKey: 'road_racer_high_score'
  },
  {
    id: 'circuit-racer',
    name: 'Circuit Racer',
    type: 'racing',
    description: 'Race around the track and complete as many laps as possible.',
    icon: '🏁',
    component: CircuitRacer,
    controls: ['Arrow Keys - Drive', 'Space - Handbrake'],
    highScoreKey: 'circuit_racer_high_score'
  },
  {
    id: 'f1-racing',
    name: 'F1 Racing',
    type: 'racing',
    description: 'Professional Formula 1 racing with realistic physics.',
    icon: '🏎️',
    component: F1Racing,
    controls: ['Arrow Keys - Drive', 'Space - Boost'],
    highScoreKey: 'f1_racing_high_score'
  },
  {
    id: 'drag-racing',
    name: 'Drag Racing',
    type: 'racing',
    description: 'Quarter-mile drag racing. Perfect your timing!',
    icon: '🚗',
    component: DragRacing,
    controls: ['Space - Accelerate', 'Shift - Gear'],
    highScoreKey: 'drag_racing_high_score'
  },
  {
    id: 'mountain-racing',
    name: 'Mountain Racing',
    type: 'racing',
    description: 'Navigate treacherous mountain roads.',
    icon: '⛰️',
    component: MountainRacing,
    controls: ['Arrow Keys - Drive', 'Space - Brake'],
    highScoreKey: 'mountain_racing_high_score'
  },
  {
    id: 'desert-rally',
    name: 'Desert Rally',
    type: 'racing',
    description: 'Off-road racing through desert terrain.',
    icon: '🏜️',
    component: DesertRally,
    controls: ['Arrow Keys - Drive', 'Space - Turbo'],
    highScoreKey: 'desert_rally_high_score'
  },
  {
    id: 'speed-chase',
    name: 'Speed Chase',
    type: 'racing',
    description: 'High-speed chase game. Outrun the pursuit!',
    icon: '🚓',
    component: SpeedChase,
    controls: ['Arrow Keys - Drive', 'Space - Nitro'],
    highScoreKey: 'speed_chase_high_score'
  }
];

const filterOptions: { value: FilterType; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Games', icon: <Gamepad2 className="w-4 h-4" /> },
  { value: 'arcade', label: 'Arcade', icon: <Zap className="w-4 h-4" /> },
  { value: 'puzzle', label: 'Puzzle', icon: <Puzzle className="w-4 h-4" /> },
  { value: 'sports', label: 'Sports', icon: <Play className="w-4 h-4" /> },
  { value: 'shooter', label: 'Shooter', icon: <Target className="w-4 h-4" /> },
  { value: 'racing', label: 'Racing', icon: <Car className="w-4 h-4" /> }
];

function App() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [highScores, setHighScores] = useState<Record<string, number>>({});

  useEffect(() => {
    // Load all high scores on component mount
    const scores: Record<string, number> = {};
    games.forEach(game => {
      scores[game.highScoreKey] = getHighScore(game.highScoreKey);
    });
    setHighScores(scores);
  }, []);

  const handleScoreUpdate = (gameKey: string, score: number) => {
    const currentHigh = highScores[gameKey] || 0;
    if (score > currentHigh) {
      saveHighScore(gameKey, score);
      setHighScores(prev => ({ ...prev, [gameKey]: score }));
    }
  };

  const filteredGames = games.filter(game => 
    filter === 'all' || game.type === filter
  );

  const currentGame = games.find(game => game.id === selectedGame);

  if (selectedGame && currentGame) {
    const GameComponent = currentGame.component;
    return (
      <div className="min-h-screen bg-black retro-bg">
        <div className="bg-gradient-to-r from-purple-900 via-blue-900 to-green-900 border-b-4 border-cyan-400 p-4 retro-glow">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSelectedGame(null)}
                className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-all duration-300 hover:glow retro-button"
              >
                <Home className="w-5 h-5" />
                <span className="font-bold text-lg retro-font">ARCADE</span>
              </button>
              <div className="h-8 w-1 bg-cyan-400 retro-glow" />
              <h2 className="text-2xl font-bold text-white flex items-center space-x-3 retro-font">
                <span className="text-3xl animate-pulse">{currentGame.icon}</span>
                <span className="text-cyan-400">{currentGame.name.toUpperCase()}</span>
              </h2>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <div className="text-green-400 font-bold retro-font">
                HIGH: {highScores[currentGame.highScoreKey] || 0}
              </div>
              <div className="flex space-x-2">
                {currentGame.controls.map((control, index) => (
                  <span key={index} className="bg-gray-800 border border-cyan-400 px-3 py-1 rounded text-cyan-300 text-sm retro-font">
                    {control}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <GameComponent onScoreUpdate={(score: number) => handleScoreUpdate(currentGame.highScoreKey, score)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black retro-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 via-blue-900 to-green-900 border-b-4 border-cyan-400 retro-glow">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-6xl md:text-8xl font-bold text-white mb-4 retro-font tracking-wider">
              <span className="bg-gradient-to-r from-cyan-400 via-green-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
                RETRO
              </span>
              <span className="text-white mx-4">•</span>
              <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent animate-pulse">
                ARCADE
              </span>
            </h1>
            <div className="flex items-center justify-center space-x-4 text-cyan-400 text-xl retro-font">
              <span>▶</span>
              <p>35 CLASSIC GAMES • ENDLESS FUN • HIGH SCORES</p>
              <span>◀</span>
            </div>
          </div>
        </div>
      </div>

      {/* Game Stats */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {filterOptions.slice(1).map((option) => {
            const categoryGames = games.filter(game => game.type === option.value);
            const totalScore = categoryGames.reduce((sum, game) => sum + (highScores[game.highScoreKey] || 0), 0);
            
            return (
              <div key={option.value} className="bg-gray-900 border border-cyan-400 rounded-lg p-4 text-center retro-glow">
                <div className="flex items-center justify-center mb-2">
                  {option.icon}
                  <span className="ml-2 text-cyan-400 font-bold retro-font text-sm">
                    {option.label.toUpperCase()}
                  </span>
                </div>
                <div className="text-white retro-font text-lg">{categoryGames.length}</div>
                <div className="text-green-400 retro-font text-xs">Total: {totalScore}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`flex items-center space-x-2 px-6 py-3 font-bold transition-all duration-300 retro-button retro-font ${
                filter === option.value
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-black border-2 border-cyan-400 retro-glow transform scale-105'
                  : 'bg-gray-800 text-cyan-400 border-2 border-gray-600 hover:border-cyan-400 hover:text-cyan-300'
              }`}
            >
              {option.icon}
              <span>{option.label.toUpperCase()}</span>
              <span className="bg-black bg-opacity-50 px-2 py-1 rounded text-xs">
                {option.value === 'all' ? games.length : games.filter(g => g.type === option.value).length}
              </span>
            </button>
          ))}
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGames.map((game) => (
            <div
              key={game.id}
              className="group bg-gray-900 border-2 border-gray-600 hover:border-cyan-400 rounded-lg p-6 transition-all duration-300 hover:transform hover:scale-105 retro-glow-hover cursor-pointer retro-card"
              onClick={() => setSelectedGame(game.id)}
            >
              <div className="text-center mb-4">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300 animate-pulse">
                  {game.icon}
                </div>
                <h3 className="text-xl font-bold text-cyan-400 mb-2 retro-font tracking-wide">
                  {game.name.toUpperCase()}
                </h3>
                <div className="flex items-center justify-center space-x-2 mb-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold retro-font border ${
                    game.type === 'arcade' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-300' :
                    game.type === 'puzzle' ? 'bg-purple-500/20 text-purple-300 border-purple-300' :
                    game.type === 'sports' ? 'bg-green-500/20 text-green-300 border-green-300' :
                    game.type === 'racing' ? 'bg-red-500/20 text-red-300 border-red-300' :
                    'bg-blue-500/20 text-blue-300 border-blue-300'
                  }`}>
                    {game.type.toUpperCase()}
                  </span>
                </div>
                <div className="bg-gray-800 border border-cyan-400 rounded px-3 py-1 mb-3">
                  <span className="text-green-400 font-bold retro-font text-sm">
                    HIGH: {highScores[game.highScoreKey] || 0}
                  </span>
                </div>
              </div>

              <p className="text-gray-300 text-center mb-4 leading-relaxed retro-font text-sm">
                {game.description}
              </p>

              <div className="space-y-1 mb-4">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wide retro-font border-b border-gray-600 pb-1">
                  Controls:
                </h4>
                {game.controls.slice(0, 2).map((control, index) => (
                  <div key={index} className="flex items-center justify-center text-xs bg-gray-800 border border-gray-600 rounded py-1">
                    <span className="text-gray-300 retro-font">{control}</span>
                  </div>
                ))}
              </div>

              <button className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-black font-bold py-2 px-4 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-300 flex items-center justify-center space-x-2 retro-button transform hover:scale-105 retro-font text-sm">
                <Play className="w-4 h-4" />
                <span>PLAY</span>
              </button>
            </div>
          ))}
        </div>

        {filteredGames.length === 0 && (
          <div className="text-center py-16">
            <div className="text-8xl mb-6 animate-bounce">🎮</div>
            <h3 className="text-3xl font-bold text-cyan-400 mb-4 retro-font">NO GAMES FOUND</h3>
            <p className="text-gray-400 retro-font">Try selecting a different filter</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-r from-purple-900 via-blue-900 to-green-900 border-t-4 border-cyan-400 mt-16 retro-glow">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <p className="text-cyan-400 retro-font text-lg">
            ⚡ BUILT FOR RETRO GAMING LEGENDS ⚡
          </p>
          <div className="flex items-center justify-center space-x-4 mt-4 text-gray-400 text-sm retro-font">
            <span>▶ INSERT COIN TO CONTINUE ◀</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;