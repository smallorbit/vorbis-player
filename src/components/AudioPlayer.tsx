import { useState, useEffect, useMemo, useCallback, memo, lazy, Suspense } from 'react';
const Playlist = lazy(() => import('./Playlist'));
import MediaCollage from './MediaCollage';
const VideoAdmin = lazy(() => import('./admin/VideoAdmin'));
const AdminKeyCombo = lazy(() => import('./admin/AdminKeyCombo'));
import { getSpotifyUserPlaylists, spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';
import { HyperText } from './hyper-text';

const AudioPlayerComponent = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [shuffleCounter, setShuffleCounter] = useState(0);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const fetchTracks = async () => {
    if (window.location.pathname === '/auth/spotify/callback') {
      setIsLoading(false);
      return;
    }

    // Check if user is authenticated first
    if (!spotifyAuth.isAuthenticated()) {
      setIsLoading(false);
      setError("Redirecting to Spotify login...");
      spotifyAuth.redirectToAuth();
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      
      await spotifyPlayer.initialize();
      
      const fetchedTracks = await getSpotifyUserPlaylists();
      if (fetchedTracks.length === 0) {
        setError("No tracks found in your Spotify account. Please add music to playlists or like some songs in Spotify, then refresh this page.");
      }
      
      setTracks(fetchedTracks);
      
      if (fetchedTracks.length > 0) {
        setCurrentTrackIndex(0);
      }
    } catch (err: unknown) {
      console.error('Failed to initialize Spotify player:', err);
      if (err instanceof Error && err.message.includes('authenticated')) {
        setError("Redirecting to Spotify login...");
        spotifyAuth.redirectToAuth();
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred while fetching tracks.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      if (window.location.pathname !== '/auth/spotify/callback' && tracks.length === 0 && !isLoading) {
        fetchTracks();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [tracks.length, isLoading]);


  useEffect(() => {
    const handlePlayerStateChange = (state: SpotifyPlaybackState | null) => {
      if (state && state.track_window.current_track) {
        const currentTrack = state.track_window.current_track;
        const trackIndex = tracks.findIndex(track => track.id === currentTrack.id);
        
        if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
          setCurrentTrackIndex(trackIndex);
          setShuffleCounter(0);
        }
      }
    };

    spotifyPlayer.onPlayerStateChanged(handlePlayerStateChange);
  }, [tracks, currentTrackIndex]);

  const playTrack = useCallback(async (index: number) => {
    if (tracks[index]) {
      try {
        await spotifyPlayer.playTrack(tracks[index].uri);
        setCurrentTrackIndex(index);
      } catch (error) {
        console.error('Failed to play track:', error);
      }
    }
  }, [tracks]);

  // Memoize the current track to prevent unnecessary re-renders
  const currentTrack = useMemo(() => tracks[currentTrackIndex] || null, [tracks, currentTrackIndex]);




  const renderContent = () => {
    if (isLoading) {
      return <div className="text-center">Loading music from Spotify...</div>;
    }

    if (error) {
      const isAuthError = error.includes('Redirecting to Spotify login') ||
        error.includes('No authentication token') ||
        error.includes('Authentication expired');

      if (isAuthError) {
        return (
          <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10 max-w-md w-full">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-4">Connect to Spotify</h2>
              <p className="text-gray-300 mb-6">
                Sign in to your Spotify account to access your music. Requires Spotify Premium.
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

      return <div className="text-center text-red-500">Error: {error}</div>;
    }

    if (tracks.length === 0) {
      return <div className="text-center">No tracks to play.</div>;
    }

    if (isInitialLoad) {
      return (
        <div className="bg-white/10 rounded-xl p-8 backdrop-blur-sm border border-white/20 shadow-xl max-w-md w-full mx-4">
          <div className="text-center">

            <HyperText duration={800} className="text-2xl font-bold text-white mb-3" as="h2">
              Vorbis Player
            </HyperText>
            <button
              onClick={() => setIsInitialLoad(false)}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg"
            >
              Click to start
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>

            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl">
        <MediaCollage
          currentTrack={currentTrack}
          shuffleCounter={shuffleCounter}
        />
        <div className="mb-3 sm:mb-4 md:mb-6">
          <Suspense fallback={
            <div className="w-full max-w-4xl mx-auto mt-6">
              <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
                <div className="animate-pulse text-white/60 text-center">Loading playlist...</div>
              </div>
            </div>
          }>
            <Playlist
              tracks={tracks}
              currentTrackIndex={currentTrackIndex}
              onTrackSelect={playTrack}
            />
          </Suspense>
        </div>
        <div className="bg-white/5 rounded-lg p-2 sm:p-3 md:p-4 backdrop-blur-sm border border-white/10">
          <SpotifyPlayerControls
            currentTrack={currentTrack}
            onPlay={() => spotifyPlayer.resume()}
            onPause={() => spotifyPlayer.pause()}
            onNext={() => {
              spotifyPlayer.nextTrack();
              setShuffleCounter(0);
            }}
            onPrevious={() => {
              spotifyPlayer.previousTrack();
              setShuffleCounter(0);
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-2 sm:px-4">
      <Suspense fallback={null}>
        <AdminKeyCombo onActivate={() => setShowAdminPanel(true)} />
      </Suspense>

      {renderContent()}

      {showAdminPanel && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        }>
          <VideoAdmin onClose={() => setShowAdminPanel(false)} />
        </Suspense>
      )}
    </div>
  );
};

const SpotifyPlayerControls = memo<{
  currentTrack: Track | null;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}>(({ currentTrack, onPlay, onPause, onNext, onPrevious }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);

  useEffect(() => {
    const checkPlaybackState = async () => {
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        setIsPlaying(!state.paused);
      }
    };
    
    const interval = setInterval(checkPlaybackState, 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    spotifyPlayer.setVolume(newVolume / 100);
  };

  return (
    <div className="flex flex-col space-y-3 p-4">
      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{currentTrack?.name || 'No track selected'}</p>
        <p className="text-gray-400 text-sm truncate">{currentTrack?.artists || ''}</p>
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onPrevious}
            className="text-white hover:text-gray-300 transition-colors"
          >
            ⏮️
          </button>
          
          <button
            onClick={handlePlayPause}
            className="bg-green-600 hover:bg-green-700 text-white rounded-full p-2 transition-colors"
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <button
            onClick={onNext}
            className="text-white hover:text-gray-300 transition-colors"
          >
            ⏭️
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-white text-sm">🔊</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
});

SpotifyPlayerControls.displayName = 'SpotifyPlayerControls';

export default AudioPlayerComponent;
