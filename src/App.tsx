import React, { useState, useEffect } from 'react';
import { Gamepad2, Filter, Home, Play, Trophy, Zap, Car } from 'lucide-react';
import Snake from './games/Snake';
import Tetris from './games/Tetris';
import Pong from './games/Pong';
import PacMan from './games/PacMan';
import SpaceInvaders from './games/SpaceInvaders';
import RoadRacer from './games/RoadRacer';
import CircuitRacer from './games/CircuitRacer';
import { getHighScore, saveHighScore } from './utils/scoring';

type GameType = 'arcade' | 'puzzle' | 'sports' | 'shooter' | 'racing';
type FilterType = GameType | 'all';

interface Game {
  id: string;
  name: string;
  type: GameType;
  description: string;
  icon: string;
  component: React.ComponentType;
  controls: string[];
  highScoreKey: string;
}

const games: Game[] = [
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
  }
];

const filterOptions: { value: FilterType; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Games', icon: <Gamepad2 className="w-4 h-4" /> },
  { value: 'arcade', label: 'Arcade', icon: <Zap className="w-4 h-4" /> },
  { value: 'puzzle', label: 'Puzzle', icon: <Trophy className="w-4 h-4" /> },
  { value: 'sports', label: 'Sports', icon: <Play className="w-4 h-4" /> },
  { value: 'shooter', label: 'Shooter', icon: <Filter className="w-4 h-4" /> },
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
              <p>CLASSIC GAMES • ENDLESS FUN • HIGH SCORES</p>
              <span>◀</span>
            </div>
          </div>
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
            </button>
          ))}
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredGames.map((game) => (
            <div
              key={game.id}
              className="group bg-gray-900 border-2 border-gray-600 hover:border-cyan-400 rounded-lg p-6 transition-all duration-300 hover:transform hover:scale-105 retro-glow-hover cursor-pointer retro-card"
              onClick={() => setSelectedGame(game.id)}
            >
              <div className="text-center mb-4">
                <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300 animate-pulse">
                  {game.icon}
                </div>
                <h3 className="text-2xl font-bold text-cyan-400 mb-2 retro-font tracking-wide">
                  {game.name.toUpperCase()}
                </h3>
                <div className="flex items-center justify-center space-x-2 mb-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold retro-font border-2 ${
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
                    HIGH SCORE: {highScores[game.highScoreKey] || 0}
                  </span>
                </div>
              </div>

              <p className="text-gray-300 text-center mb-6 leading-relaxed retro-font text-sm">
                {game.description}
              </p>

              <div className="space-y-2 mb-6">
                <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-wide retro-font border-b border-gray-600 pb-1">
                  Controls:
                </h4>
                {game.controls.map((control, index) => (
                  <div key={index} className="flex items-center justify-center text-sm bg-gray-800 border border-gray-600 rounded py-1">
                    <span className="text-gray-300 retro-font">{control}</span>
                  </div>
                ))}
              </div>

              <button className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-black font-bold py-3 px-6 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-300 flex items-center justify-center space-x-2 retro-button transform hover:scale-105 retro-font">
                <Play className="w-5 h-5" />
                <span>PLAY GAME</span>
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