import { useState, useEffect, useMemo, useRef, useCallback, memo, lazy, Suspense } from 'react';
import AudioPlayer from 'react-modern-audio-player';
// Lazy load Playlist for code splitting
const Playlist = lazy(() => import('./Playlist'));
import MediaCollage from './MediaCollage';
// Lazy load admin components to reduce initial bundle size
const VideoAdmin = lazy(() => import('./admin/VideoAdmin'));
const AdminKeyCombo = lazy(() => import('./admin/AdminKeyCombo'));
import { getDropboxAudioFiles, dropboxAuth } from '../services/dropbox';
import type { Track } from '../services/dropbox';
import { HyperText } from './hyper-text';
import { sortTracksByNumber } from '../lib/utils';

const AudioPlayerComponent = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null!);
  const [shuffleCounter, setShuffleCounter] = useState(0);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const fetchTracks = async () => {
    // Don't try to fetch tracks if we're on the auth callback page
    if (window.location.pathname === '/auth/dropbox/callback') {
      setIsLoading(false); // Don't show loading state during auth
      return;
    }

    try {
      setError(null); // Clear any previous errors
      setIsLoading(true);
      const fetchedTracks = await getDropboxAudioFiles('');
      if (fetchedTracks.length === 0) {
        setError("No audio files found in your app's Dropbox folder. Make sure files have been added and the app has 'files.metadata.read' permissions.");
      }
      
      setTracks(fetchedTracks);
      
      // Set the current track to the first one in sorted order AFTER setting tracks
      if (fetchedTracks.length > 0) {
        const sortedTracks = sortTracksByNumber(fetchedTracks);
        const firstSortedTrack = sortedTracks[0];
        // The fetchedTracks are not sorted, so we find the original index
        const originalIndex = fetchedTracks.findIndex(track => track === firstSortedTrack);
        if (originalIndex !== -1) {
          setCurrentTrackIndex(originalIndex);
          if (import.meta.env.DEV) {
            console.log('🎵 Initial track set to index:', originalIndex, firstSortedTrack.title);
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unknown error occurred while fetching tracks.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  // Listen for navigation events to retry fetching when returning from auth
  useEffect(() => {
    const handleFocus = () => {
      // Only retry if we're not on the callback page and don't have tracks
      if (window.location.pathname !== '/auth/dropbox/callback' && tracks.length === 0 && !isLoading) {
        fetchTracks();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [tracks.length, isLoading]);


  // Enhanced synchronization that works with or without playlist interaction
  useEffect(() => {
    const updateCurrentTrack = () => {
      // Try to find audio element in multiple ways
      const audio = audioRef.current || 
                   document.querySelector('audio') || 
                   document.querySelector('[data-testid="audio-element"]');
      
      if (!audio) {
        if (import.meta.env.DEV) {
          console.log('🎵 No audio element found for sync');
        }
        return;
      }

      // Find the track in the playlist that matches the audio player's current source
      const trackIndex = tracks.findIndex(track => {
        // More robust source matching
        const audioSrc = audio.src || audio.currentSrc;
        return audioSrc && (
          track.src === audioSrc || 
          audioSrc.includes(track.src) || 
          track.src.includes(audioSrc.split('?')[0]) // Handle query parameters
        );
      });

      if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
        if (import.meta.env.DEV) {
          console.log(`🎵 Playlist sync: Track changed from ${currentTrackIndex} to ${trackIndex}`, {
            audioSrc: audio.src || audio.currentSrc,
            trackSrc: tracks[trackIndex]?.src,
            audioElement: audio.constructor.name
          });
        }
        setCurrentTrackIndex(trackIndex);
        setShuffleCounter(0); // Reset shuffle counter when track changes via audio player controls
      }
    };

    // Listen to multiple events to ensure we catch all track changes
    const events = ['loadstart', 'loadedmetadata', 'canplay', 'play', 'ended', 'timeupdate'];
    
    // Set up event listeners with a delay to ensure audio element exists
    const setupListeners = () => {
      const audio = audioRef.current || 
                   document.querySelector('audio') || 
                   document.querySelector('[data-testid="audio-element"]');
                   
      if (audio) {
        events.forEach(event => {
          audio.addEventListener(event, updateCurrentTrack);
        });
        
        if (import.meta.env.DEV) {
          console.log('🎵 Audio event listeners attached to:', audio.constructor.name);
        }
        
        return audio;
      }
      return null;
    };

    // Try to setup immediately
    let audio = setupListeners();
    
    // If no audio element found, try again with intervals
    let retryCount = 0;
    let retryInterval: NodeJS.Timeout | null = null;
    
    if (!audio) {
      retryInterval = setInterval(() => {
        audio = setupListeners();
        retryCount++;
        
        if (audio || retryCount > 10) { // Stop trying after 10 attempts (5 seconds)
          if (retryInterval) clearInterval(retryInterval);
        }
      }, 500);
    }

    // Continuous polling as backup (more aggressive for initial sync)
    const pollInterval = setInterval(() => {
      updateCurrentTrack();
    }, 500); // Check every 500ms

    return () => {
      if (retryInterval) {
        clearInterval(retryInterval);
      }
      clearInterval(pollInterval);
      
      // Clean up event listeners - find the audio element again to be safe
      const currentAudio = audioRef.current || document.querySelector('audio');
      if (currentAudio) {
        events.forEach(event => {
          currentAudio.removeEventListener(event, updateCurrentTrack);
        });
      }
    };
  }, [tracks, currentTrackIndex]);

  // Convert tracks to the format expected by react-modern-audio-player
  const playList = useMemo(() =>
    tracks.map((track, index) => ({
      id: index + 1,
      src: track.src,
      name: track.title,
      writer: 'Unknown Artist',
      img: undefined,
    })), [tracks]
  );

  // Memoize the current track to prevent unnecessary re-renders
  const currentTrack = useMemo(() => tracks[currentTrackIndex] || null, [tracks, currentTrackIndex]);

  // Memoize track selection handler
  const handleTrackSelect = useCallback((index: number) => {
    // If the same track is clicked again
    if (index === currentTrackIndex) {
      setShuffleCounter(prev => prev + 1);
    } else {
      // If a new track is clicked
      setCurrentTrackIndex(index);
      setShuffleCounter(0); // Reset counter for a new track
    }
    setIsInitialLoad(false);
  }, [currentTrackIndex]);

  // Additional sync using MutationObserver to watch for DOM changes
  useEffect(() => {
    let observer: MutationObserver;

    const setupObserver = () => {
      const audioContainer = document.querySelector('[class*="audio"]') || 
                           document.querySelector('[class*="player"]') ||
                           document.body;

      if (audioContainer) {
        observer = new MutationObserver(() => {
          // Check for track changes whenever the DOM changes
          const audio = document.querySelector('audio');
          if (audio && tracks.length > 0) {
            const currentSrc = audio.src || audio.currentSrc;
            if (currentSrc) {
              const trackIndex = tracks.findIndex(track => 
                currentSrc.includes(track.src) || track.src.includes(currentSrc.split('?')[0])
              );
              
              if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
                if (import.meta.env.DEV) {
                  console.log('🎵 MutationObserver detected track change:', trackIndex);
                }
                setCurrentTrackIndex(trackIndex);
                setShuffleCounter(0);
              }
            }
          }
        });

        observer.observe(audioContainer, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['src', 'data-current-track']
        });
      }
    };

    // Setup with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(setupObserver, 1000);

    return () => {
      clearTimeout(timeoutId);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [tracks, currentTrackIndex]);

  // Final fallback: Monitor if we have tracks but no current track properly set
  useEffect(() => {
    if (tracks.length > 0 && currentTrackIndex === 0 && !isInitialLoad) {
      // Force sync check after tracks are loaded
      const timeoutId = setTimeout(() => {
        const audio = document.querySelector('audio');
        if (audio && audio.src) {
          const trackIndex = tracks.findIndex(track => 
            audio.src.includes(track.src) || track.src.includes(audio.src.split('?')[0])
          );
          
          if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
            if (import.meta.env.DEV) {
              console.log('🎵 Final fallback sync triggered:', trackIndex);
            }
            setCurrentTrackIndex(trackIndex);
          }
        }
      }, 2000); // Wait 2 seconds after tracks load

      return () => clearTimeout(timeoutId);
    }
  }, [tracks, currentTrackIndex, isInitialLoad]);

  const renderContent = () => {
    if (isLoading) {
      return <div className="text-center">Loading music from Dropbox...</div>;
    }

    if (error) {
      const isAuthError = error.includes('Redirecting to Dropbox login') ||
        error.includes('No authentication token') ||
        error.includes('Authentication expired');

      if (isAuthError) {
        return (
          <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10 max-w-md w-full">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-4">Connect to Dropbox</h2>
              <p className="text-gray-300 mb-6">
                Sign in to your Dropbox account to access your music files.
              </p>
              <button
                onClick={() => dropboxAuth.redirectToAuth()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Connect Dropbox
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
              onTrackSelect={handleTrackSelect}
            />
          </Suspense>
        </div>
        <div className="bg-white/5 rounded-lg p-2 sm:p-3 md:p-4 backdrop-blur-sm border border-white/10 overflow-hidden">
          <div className="px-2 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-5 pb-2 sm:pb-3 overflow-hidden">
            <AudioPlayerMemo
              currentTrackIndex={currentTrackIndex}
              playList={playList}
              audioRef={audioRef}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-2 sm:px-4">
      {/* Secret Admin Access - Lazy loaded */}
      <Suspense fallback={null}>
        <AdminKeyCombo onActivate={() => setShowAdminPanel(true)} />
      </Suspense>

      {renderContent()}

      {/* Admin Panel Modal - Lazy loaded */}
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

// Memoized AudioPlayer component to prevent unnecessary re-renders
const AudioPlayerMemo = memo<{
  currentTrackIndex: number;
  playList: Array<{
    id: number;
    src: string;
    name: string;
    writer: string;
    img: undefined;
  }>;
  audioRef: React.MutableRefObject<HTMLAudioElement>;
}>(({ currentTrackIndex, playList, audioRef }) => {
  return (
    <AudioPlayer
      key={currentTrackIndex}
      playList={playList}
      audioRef={audioRef}
      audioInitialState={{
        isPlaying: true,
        curPlayId: currentTrackIndex + 1,
        volume: 1
      }}
      activeUI={{
        all: false,
        playButton: true,
        prevNnext: true,
        volumeSlider: true,
        repeatType: true,
        trackTime: true,
        trackInfo: false,
        artwork: false,
        progress: "bar",
        playList: false
      }}
    />
  );
});

AudioPlayerMemo.displayName = 'AudioPlayerMemo';

export default AudioPlayerComponent;
