import { useState, useEffect, useCallback, memo } from 'react';
import { spotifyAuth, getSpotifyUserPlaylists, type Track } from '../services/spotify';
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
      
      // Limit to 5 tracks for demo purposes
      const limitedTracks = fetchedTracks.slice(0, 5);
      setTracks(limitedTracks);
      
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

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    playTrack(nextIndex);
  }, [currentTrackIndex, tracks.length, playTrack]);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;
    const prevIndex = currentTrackIndex === 0 ? tracks.length - 1 : currentTrackIndex - 1;
    playTrack(prevIndex);
  }, [currentTrackIndex, tracks.length, playTrack]);

  const currentTrack = tracks[currentTrackIndex] || null;

  if (isLoading) {
    return (
      <div className={`bg-gradient-to-br from-gray-900 via-black to-gray-800 dark:from-[#1a1a1a] dark:to-[#0d0d0d] rounded-3xl p-8 max-w-lg mx-auto shadow-[0_25px_60px_rgba(0,0,0,0.8)] border-2 border-orange-400/20 dark:border-gray-700/30 ${className}`}>
        <div className="text-center text-gray-600 dark:text-gray-400 animate-pulse py-12 text-xl font-bold">Loading Spotify...</div>
      </div>
    );
  }

  if (!spotifyAuth.isAuthenticated()) {
    return (
      <div className={`bg-gradient-to-br from-gray-900 via-black to-gray-800 dark:from-[#1a1a1a] dark:to-[#0d0d0d] rounded-3xl p-8 max-w-lg mx-auto shadow-[0_25px_60px_rgba(0,0,0,0.8)] border-2 border-orange-400/20 dark:border-gray-700/30 ${className}`}>
        <div className="text-center py-8">
          <h3 className="text-3xl font-black text-gray-800 dark:text-white mb-6 drop-shadow-lg">Connect to Spotify</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg leading-relaxed font-semibold">
            Sign in to your Spotify account to play music. Requires Spotify Premium.
          </p>
          <button
            onClick={() => spotifyAuth.redirectToAuth()}
            className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-600 hover:from-orange-500 hover:via-orange-600 hover:to-amber-700 text-white px-10 py-4 rounded-2xl font-black text-lg transition-all transform hover:scale-110 active:scale-95 shadow-[0_12px_35px_rgba(251,146,60,0.5)] border-3 border-orange-300/50 dark:border-orange-400/30 ring-4 ring-orange-200/30 dark:ring-orange-400/20"
          >
            Connect Spotify
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gradient-to-br from-gray-900 via-black to-gray-800 dark:from-[#1a1a1a] dark:to-[#0d0d0d] rounded-3xl p-8 max-w-lg mx-auto shadow-[0_25px_60px_rgba(0,0,0,0.8)] border-2 border-red-400/30 ${className}`}>
        <div className="text-center text-red-500 dark:text-red-400 py-8 text-xl font-bold">{error}</div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className={`bg-gradient-to-br from-gray-900 via-black to-gray-800 dark:from-[#1a1a1a] dark:to-[#0d0d0d] rounded-3xl p-8 max-w-lg mx-auto shadow-[0_25px_60px_rgba(0,0,0,0.8)] border-2 border-orange-400/20 dark:border-gray-700/30 ${className}`}>
        <div className="text-center text-gray-600 dark:text-gray-400 py-8 text-xl font-bold">No tracks available</div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-gray-900 via-black to-gray-800 dark:from-[#1a1a1a] dark:to-[#0d0d0d] rounded-3xl p-8 max-w-lg mx-auto shadow-[0_25px_60px_rgba(0,0,0,0.8)] border-2 border-orange-400/20 dark:border-gray-700/30 backdrop-blur-lg ${className}`}>
      <div className="mb-8">
        <TrackDisplay track={currentTrack} />
      </div>

      <div>
        <PlayerControls 
          isPlayerReady={isPlayerReady}
          onPlay={() => spotifyPlayer.resume()}
          onPause={() => spotifyPlayer.pause()}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
      </div>

      {showPlaylist && (
        <div className="mt-8">
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
      <div className="text-center text-gray-400 dark:text-gray-500 py-8">
        No track selected
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-6">
      {track.image && (
        <div className="relative group">
          <img 
            src={track.image} 
            alt={track.album}
            className="w-28 h-28 rounded-3xl object-cover flex-shrink-0 shadow-2xl ring-4 ring-orange-400/30 dark:ring-white/10 border-2 border-orange-300/50 dark:border-gray-700/50"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-orange-600/30 dark:from-black/20 dark:to-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500" />
          <div className="absolute inset-0 ring-2 ring-orange-400/50 dark:ring-orange-400/30 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="text-gray-900 dark:text-white font-bold text-2xl mb-3 truncate leading-tight drop-shadow-sm">{track.name}</h4>
        <p className="text-gray-700 dark:text-gray-300 text-lg font-semibold truncate mb-2 drop-shadow-sm">{track.artists}</p>
        <p className="text-gray-600 dark:text-gray-500 text-base truncate font-medium">{track.album}</p>
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
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isPlayerReady) return;

    const checkPlaybackState = async () => {
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        setIsPlaying(!state.paused);
        setProgress(state.position);
        setDuration(state.track_window.current_track.duration_ms);
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

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Progress Bar */}
      <div className="space-y-4">
        <div className="relative w-full bg-gray-300 dark:bg-gray-700/50 rounded-full h-3 overflow-hidden shadow-inner border border-gray-400/30 dark:border-gray-600/30">
          <div 
            className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500 h-3 rounded-full transition-all duration-500 ease-out shadow-[0_0_15px_rgba(251,146,60,0.5)] relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-60" />
            <div className="absolute right-0 top-0 w-4 h-3 bg-orange-600 rounded-full shadow-lg border-2 border-white" />
          </div>
        </div>
        <div className="flex justify-between text-base text-gray-700 dark:text-gray-300 font-bold drop-shadow-sm">
          <span className="bg-gray-200/50 dark:bg-gray-800/50 px-2 py-1 rounded-lg">{formatTime(progress)}</span>
          <span className="bg-gray-200/50 dark:bg-gray-800/50 px-2 py-1 rounded-lg">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-8">
        <button 
          onClick={onPrevious} 
          disabled={!isPlayerReady}
          className="text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 transition-all disabled:opacity-30 p-4 rounded-full bg-gray-200/70 dark:bg-white/5 hover:bg-orange-100 dark:hover:bg-orange-500/10 active:scale-90 shadow-lg border-2 border-gray-300/50 dark:border-gray-600/30 hover:border-orange-400/50"
        >
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>
        
        <button 
          onClick={handlePlayPause} 
          disabled={!isPlayerReady}
          className="bg-gradient-to-b from-orange-400 via-orange-500 to-amber-600 hover:from-orange-500 hover:via-orange-600 hover:to-amber-700 text-white rounded-full p-6 transition-all disabled:opacity-30 transform hover:scale-115 active:scale-95 shadow-[0_12px_35px_rgba(251,146,60,0.5)] border-4 border-orange-300/50 dark:border-orange-400/30 ring-4 ring-orange-200/30 dark:ring-orange-400/20"
        >
          {isPlaying ? (
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
        
        <button 
          onClick={onNext} 
          disabled={!isPlayerReady}
          className="text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 transition-all disabled:opacity-30 p-4 rounded-full bg-gray-200/70 dark:bg-white/5 hover:bg-orange-100 dark:hover:bg-orange-500/10 active:scale-90 shadow-lg border-2 border-gray-300/50 dark:border-gray-600/30 hover:border-orange-400/50"
        >
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>
      
      {/* Volume and Shuffle */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center space-x-4 bg-gray-200/70 dark:bg-gray-800/50 px-4 py-3 rounded-2xl shadow-lg border-2 border-gray-300/50 dark:border-gray-600/30">
          <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            disabled={!isPlayerReady}
            className="w-28 h-2 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
            style={{
              background: `linear-gradient(to right, #fb923c 0%, #fb923c ${volume}%, #d1d5db ${volume}%, #d1d5db 100%)`
            }}
          />
        </div>
        
        <button className="flex items-center space-x-3 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-600 hover:from-orange-500 hover:via-orange-600 hover:to-amber-700 text-white px-6 py-3.5 rounded-2xl text-base font-black transition-all transform hover:scale-110 active:scale-95 shadow-[0_8px_25px_rgba(251,146,60,0.4)] border-3 border-orange-300/50 dark:border-orange-400/30 ring-2 ring-orange-200/40 dark:ring-orange-400/20">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
          </svg>
          <span>SHUFFLE</span>
        </button>
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
    <div>
      {tracks.map((track, index) => (
        <div
          key={track.id}
          onClick={() => onTrackSelect(index)}
          style={{ backgroundColor: index === currentTrackIndex ? '#f0f0f0' : 'transparent' }}
        >
          <div>
            {track.image && (
              <img 
                src={track.image} 
                alt={track.album}
                width="40"
                height="40"
              />
            )}
            <div>
              <p>{track.name}</p>
              <p>{track.artists}</p>
            </div>
            <div>
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