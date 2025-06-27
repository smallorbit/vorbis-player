import { useState, useEffect, useCallback, memo } from 'react';
import { spotifyAuth, getSpotifyUserPlaylists, Track } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';

interface SpotifyAudioPlayerProps {
  className?: string;
  autoPlay?: boolean;
  showPlaylist?: boolean;
}

const SpotifyAudioPlayer = ({ 
  className = "", 
  autoPlay = false, 
  showPlaylist = true 
}: SpotifyAudioPlayerProps) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  const fetchTracks = useCallback(async () => {
    if (window.location.pathname === '/auth/spotify/callback') {
      setIsLoading(false);
      return;
    }

    if (!spotifyAuth.isAuthenticated()) {
      setIsLoading(false);
      setError("Not authenticated");
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      
      await spotifyPlayer.initialize();
      setIsPlayerReady(true);
      
      const fetchedTracks = await getSpotifyUserPlaylists();
      if (fetchedTracks.length === 0) {
        setError("No tracks found. Add music to your Spotify playlists or liked songs.");
        return;
      }
      
      setTracks(fetchedTracks);
      
      if (fetchedTracks.length > 0) {
        setCurrentTrackIndex(0);
        if (autoPlay) {
          await spotifyPlayer.playTrack(fetchedTracks[0].uri);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to initialize:', err);
      setError(err instanceof Error ? err.message : "Failed to load tracks");
    } finally {
      setIsLoading(false);
    }
  }, [autoPlay]);

  useEffect(() => {
    const handleAuthRedirect = async () => {
      try {
        await spotifyAuth.handleRedirect();
        if (spotifyAuth.isAuthenticated()) {
          fetchTracks();
        }
      } catch (error) {
        console.error('Auth redirect error:', error);
      }
    };

    handleAuthRedirect();
  }, [fetchTracks]);

  useEffect(() => {
    const handlePlayerStateChange = (state: SpotifyPlaybackState | null) => {
      if (state && state.track_window.current_track) {
        const currentTrack = state.track_window.current_track;
        const trackIndex = tracks.findIndex(track => track.id === currentTrack.id);
        
        if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
          setCurrentTrackIndex(trackIndex);
        }
      }
    };

    if (isPlayerReady) {
      spotifyPlayer.onPlayerStateChanged(handlePlayerStateChange);
    }
  }, [tracks, currentTrackIndex, isPlayerReady]);

  const playTrack = useCallback(async (index: number) => {
    if (tracks[index] && isPlayerReady) {
      try {
        await spotifyPlayer.playTrack(tracks[index].uri);
        setCurrentTrackIndex(index);
      } catch (error) {
        console.error('Failed to play track:', error);
      }
    }
  }, [tracks, isPlayerReady]);

  const currentTrack = tracks[currentTrackIndex] || null;

  if (isLoading) {
    return (
      <div className={`bg-neutral-900 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse text-white text-center">Loading Spotify...</div>
      </div>
    );
  }

  if (!spotifyAuth.isAuthenticated()) {
    return (
      <div className={`bg-neutral-900 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <h3 className="text-xl font-bold text-white mb-4">Connect to Spotify</h3>
          <p className="text-gray-300 mb-6">
            Sign in to your Spotify account to play music. Requires Spotify Premium.
          </p>
          <button
            onClick={() => spotifyAuth.redirectToAuth()}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
          >
            Connect Spotify
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-neutral-900 rounded-lg p-6 ${className}`}>
        <div className="text-center text-red-400">{error}</div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className={`bg-neutral-900 rounded-lg p-6 ${className}`}>
        <div className="text-center text-gray-400">No tracks available</div>
      </div>
    );
  }

  return (
    <div className={`bg-neutral-900 rounded-lg overflow-hidden ${className}`}>
      {/* Current Track Display */}
      <div className="p-4 border-b border-neutral-700">
        <TrackDisplay track={currentTrack} />
      </div>

      {/* Player Controls */}
      <div className="p-4 border-b border-neutral-700">
        <PlayerControls 
          isPlayerReady={isPlayerReady}
          onPlay={() => spotifyPlayer.resume()}
          onPause={() => spotifyPlayer.pause()}
          onNext={() => spotifyPlayer.nextTrack()}
          onPrevious={() => spotifyPlayer.previousTrack()}
        />
      </div>

      {/* Playlist */}
      {showPlaylist && (
        <div className="max-h-64 overflow-y-auto">
          <PlaylistView
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            onTrackSelect={playTrack}
          />
        </div>
      )}
    </div>
  );
};

const TrackDisplay = memo<{ track: Track | null }>(({ track }) => {
  if (!track) {
    return (
      <div className="text-center text-gray-400">
        No track selected
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      {track.image && (
        <img 
          src={track.image} 
          alt={track.album}
          className="w-16 h-16 rounded-lg object-cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-medium truncate">{track.name}</h4>
        <p className="text-gray-400 text-sm truncate">{track.artists}</p>
        <p className="text-gray-500 text-xs truncate">{track.album}</p>
      </div>
    </div>
  );
});

TrackDisplay.displayName = 'TrackDisplay';

const PlayerControls = memo<{
  isPlayerReady: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}>(({ isPlayerReady, onPlay, onPause, onNext, onPrevious }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);

  useEffect(() => {
    if (!isPlayerReady) return;

    const checkPlaybackState = async () => {
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        setIsPlaying(!state.paused);
      }
    };
    
    const interval = setInterval(checkPlaybackState, 1000);
    return () => clearInterval(interval);
  }, [isPlayerReady]);

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (isPlayerReady) {
      spotifyPlayer.setVolume(newVolume / 100);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <button
          onClick={onPrevious}
          disabled={!isPlayerReady}
          className="text-white hover:text-gray-300 transition-colors disabled:opacity-50"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>
        
        <button
          onClick={handlePlayPause}
          disabled={!isPlayerReady}
          className="bg-green-600 hover:bg-green-700 text-white rounded-full p-3 transition-colors disabled:opacity-50"
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
        
        <button
          onClick={onNext}
          disabled={!isPlayerReady}
          className="text-white hover:text-gray-300 transition-colors disabled:opacity-50"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>
      
      <div className="flex items-center space-x-2">
        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => handleVolumeChange(Number(e.target.value))}
          className="w-20 accent-green-600"
          disabled={!isPlayerReady}
        />
      </div>
    </div>
  );
});

PlayerControls.displayName = 'PlayerControls';

const PlaylistView = memo<{
  tracks: Track[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
}>(({ tracks, currentTrackIndex, onTrackSelect }) => {
  return (
    <div className="divide-y divide-neutral-700">
      {tracks.map((track, index) => (
        <div
          key={track.id}
          onClick={() => onTrackSelect(index)}
          className={`p-3 cursor-pointer hover:bg-neutral-800 transition-colors ${
            index === currentTrackIndex ? 'bg-neutral-800 border-l-4 border-green-600' : ''
          }`}
        >
          <div className="flex items-center space-x-3">
            {track.image && (
              <img 
                src={track.image} 
                alt={track.album}
                className="w-10 h-10 rounded object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{track.name}</p>
              <p className="text-gray-400 text-xs truncate">{track.artists}</p>
            </div>
            <div className="text-gray-500 text-xs">
              {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

PlaylistView.displayName = 'PlaylistView';

export default SpotifyAudioPlayer;
export type { SpotifyAudioPlayerProps };