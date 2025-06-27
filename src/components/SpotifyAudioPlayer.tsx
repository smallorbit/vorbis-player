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
      <div className={className}>
        <div>Loading Spotify...</div>
      </div>
    );
  }

  if (!spotifyAuth.isAuthenticated()) {
    return (
      <div className={className}>
        <div>
          <h3>Connect to Spotify</h3>
          <p>
            Sign in to your Spotify account to play music. Requires Spotify Premium.
          </p>
          <button
            onClick={() => spotifyAuth.redirectToAuth()}
          >
            Connect Spotify
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div>{error}</div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className={className}>
        <div>No tracks available</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div>
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
        <div>
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
      <div>
        No track selected
      </div>
    );
  }

  return (
    <div>
      {track.image && (
        <img 
          src={track.image} 
          alt={track.album}
          width="64"
          height="64"
        />
      )}
      <div>
        <h4>{track.name}</h4>
        <p>{track.artists}</p>
        <p>{track.album}</p>
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
    <div>
      <div>
        <button onClick={onPrevious} disabled={!isPlayerReady}>
          Previous
        </button>
        
        <button onClick={handlePlayPause} disabled={!isPlayerReady}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        
        <button onClick={onNext} disabled={!isPlayerReady}>
          Next
        </button>
      </div>
      
      <div>
        <label>Volume</label>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => handleVolumeChange(Number(e.target.value))}
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