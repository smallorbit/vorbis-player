import SpotifyAudioPlayer from './SpotifyAudioPlayer';

const SpotifyAudioPlayerExample = () => {
  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          Spotify Audio Player Examples
        </h1>

        {/* Full Featured Player */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Full Featured Player</h2>
          <SpotifyAudioPlayer 
            className="w-full"
            showPlaylist={true}
            autoPlay={false}
          />
        </div>

        {/* Compact Player */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Compact Player (No Playlist)</h2>
          <SpotifyAudioPlayer 
            className="w-full"
            showPlaylist={false}
            autoPlay={false}
          />
        </div>

        {/* Side-by-side Example */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Multiple Players</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SpotifyAudioPlayer 
              className="w-full"
              showPlaylist={false}
              autoPlay={false}
            />
            <SpotifyAudioPlayer 
              className="w-full"
              showPlaylist={false}
              autoPlay={false}
            />
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="bg-neutral-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Usage Instructions</h3>
          <div className="text-gray-300 space-y-2">
            <p>1. You need a Spotify Premium account to use this player</p>
            <p>2. Click "Connect Spotify" to authenticate</p>
            <p>3. The player will load your playlists and liked songs</p>
            <p>4. Use the controls to play/pause, skip tracks, and adjust volume</p>
            <p>5. Click on any track in the playlist to play it</p>
          </div>
        </div>

        {/* Code Example */}
        <div className="bg-neutral-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Code Example</h3>
          <pre className="text-green-400 text-sm overflow-x-auto">
{`import SpotifyAudioPlayer from './components/SpotifyAudioPlayer';

function App() {
  return (
    <div>
      <SpotifyAudioPlayer 
        className="w-full max-w-md mx-auto"
        showPlaylist={true}
        autoPlay={false}
      />
    </div>
  );
}`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SpotifyAudioPlayerExample;