import React, { useState } from 'react';
import { Gamepad2, Filter, Home, Play, Trophy, Zap } from 'lucide-react';
import Snake from './games/Snake';
import Tetris from './games/Tetris';
import Pong from './games/Pong';
import PacMan from './games/PacMan';
import SpaceInvaders from './games/SpaceInvaders';

type GameType = 'arcade' | 'puzzle' | 'sports' | 'shooter';
type FilterType = GameType | 'all';

interface Game {
  id: string;
  name: string;
  type: GameType;
  description: string;
  icon: string;
  component: React.ComponentType;
  controls: string[];
}

const games: Game[] = [
  {
    id: 'snake',
    name: 'Snake',
    type: 'arcade',
    description: 'Guide the snake to eat food and grow longer without hitting walls or yourself.',
    icon: '🐍',
    component: Snake,
    controls: ['Arrow Keys - Move', 'Space - Pause']
  },
  {
    id: 'tetris',
    name: 'Tetris',
    type: 'puzzle',
    description: 'Stack falling blocks to create complete lines and clear them.',
    icon: '🧩',
    component: Tetris,
    controls: ['Arrow Keys - Move/Rotate', 'Space - Drop']
  },
  {
    id: 'pong',
    name: 'Pong',
    type: 'sports',
    description: 'Classic table tennis game. First to 10 points wins!',
    icon: '🏓',
    component: Pong,
    controls: ['W/S - Left Paddle', 'Up/Down - Right Paddle']
  },
  {
    id: 'pacman',
    name: 'Pac-Man',
    type: 'arcade',
    description: 'Navigate the maze, collect dots, and avoid the ghosts.',
    icon: '👻',
    component: PacMan,
    controls: ['Arrow Keys - Move', 'Space - Pause']
  },
  {
    id: 'space-invaders',
    name: 'Space Invaders',
    type: 'shooter',
    description: 'Defend Earth by shooting down waves of alien invaders.',
    icon: '🛸',
    component: SpaceInvaders,
    controls: ['Left/Right - Move', 'Space - Shoot']
  }
];

const filterOptions: { value: FilterType; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Games', icon: <Gamepad2 className="w-4 h-4" /> },
  { value: 'arcade', label: 'Arcade', icon: <Zap className="w-4 h-4" /> },
  { value: 'puzzle', label: 'Puzzle', icon: <Trophy className="w-4 h-4" /> },
  { value: 'sports', label: 'Sports', icon: <Play className="w-4 h-4" /> },
  { value: 'shooter', label: 'Shooter', icon: <Filter className="w-4 h-4" /> }
];

function App() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredGames = games.filter(game => 
    filter === 'all' || game.type === filter
  );

  const currentGame = games.find(game => game.id === selectedGame);

  if (selectedGame && currentGame) {
    const GameComponent = currentGame.component;
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSelectedGame(null)}
                className="flex items-center space-x-2 text-green-400 hover:text-green-300 transition-colors"
              >
                <Home className="w-5 h-5" />
                <span className="font-medium">Back to Games</span>
              </button>
              <div className="h-6 w-px bg-gray-600" />
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <span className="text-2xl">{currentGame.icon}</span>
                <span>{currentGame.name}</span>
              </h2>
            </div>
            <div className="hidden md:flex items-center space-x-4 text-sm text-gray-400">
              {currentGame.controls.map((control, index) => (
                <span key={index} className="bg-gray-700 px-2 py-1 rounded">
                  {control}
                </span>
              ))}
            </div>
          </div>
        </div>
        <GameComponent />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 tracking-tight">
              <span className="bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                Legacy Games
              </span>
            </h1>
            <p className="text-lg text-gray-300">
              Play classic games that defined gaming history
            </p>
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
              className={`flex items-center space-x-2 px-6 py-3 rounded-full font-medium transition-all transform hover:scale-105 ${
                filter === option.value
                  ? 'bg-gradient-to-r from-green-500 to-blue-600 text-white shadow-lg shadow-green-500/25'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20 backdrop-blur-sm'
              }`}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredGames.map((game) => (
            <div
              key={game.id}
              className="group bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:border-green-400/50 transition-all duration-300 hover:transform hover:scale-105 hover:shadow-2xl hover:shadow-green-500/20 cursor-pointer"
              onClick={() => setSelectedGame(game.id)}
            >
              <div className="text-center mb-4">
                <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">
                  {game.icon}
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{game.name}</h3>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  game.type === 'arcade' ? 'bg-yellow-500/20 text-yellow-300' :
                  game.type === 'puzzle' ? 'bg-purple-500/20 text-purple-300' :
                  game.type === 'sports' ? 'bg-green-500/20 text-green-300' :
                  'bg-red-500/20 text-red-300'
                }`}>
                  {game.type.charAt(0).toUpperCase() + game.type.slice(1)}
                </span>
              </div>

              <p className="text-gray-300 text-center mb-6 leading-relaxed">
                {game.description}
              </p>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                  Controls:
                </h4>
                {game.controls.map((control, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{control}</span>
                  </div>
                ))}
              </div>

              <button className="w-full mt-6 bg-gradient-to-r from-green-500 to-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:from-green-600 hover:to-blue-700 transition-all flex items-center justify-center space-x-2 group-hover:shadow-lg">
                <Play className="w-5 h-5" />
                <span>Play Game</span>
              </button>
            </div>
          ))}
        </div>

        {filteredGames.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-2xl font-bold text-white mb-2">No games found</h3>
            <p className="text-gray-400">Try selecting a different filter</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-black/20 backdrop-blur-sm border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <p className="text-gray-400">
            Built with ❤️ for retro gaming enthusiasts
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;