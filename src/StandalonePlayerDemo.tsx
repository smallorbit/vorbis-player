import { useState } from 'react';
import SpotifyAudioPlayer from './components/SpotifyAudioPlayer';
import SpotifyAudioPlayerExample from './components/SpotifyAudioPlayerExample';

const StandalonePlayerDemo = () => {
  const [activeDemo, setActiveDemo] = useState<'single' | 'examples'>('single');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Navigation */}
      <nav className="p-4 bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Spotify Audio Player Demo</h1>
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveDemo('single')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeDemo === 'single' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              Single Player
            </button>
            <button
              onClick={() => setActiveDemo('examples')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeDemo === 'examples' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              Examples
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="p-4">
        {activeDemo === 'single' ? (
          <div className="max-w-md mx-auto mt-8">
            <SpotifyAudioPlayer 
              className="w-full shadow-2xl"
              showPlaylist={true}
              autoPlay={false}
            />
          </div>
        ) : (
          <SpotifyAudioPlayerExample />
        )}
      </div>
    </div>
  );
};

export default StandalonePlayerDemo;