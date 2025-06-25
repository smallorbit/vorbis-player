import { useState, useEffect, useMemo, useRef, useCallback, memo, lazy, Suspense } from 'react';
import AudioPlayer from 'react-modern-audio-player';
const Playlist = lazy(() => import('./Playlist'));
import MediaCollage from './MediaCollage';
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
    if (window.location.pathname === '/auth/dropbox/callback') {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      const fetchedTracks = await getDropboxAudioFiles('');
      if (fetchedTracks.length === 0) {
        setError("No audio files found in your app's Dropbox folder. Make sure files have been added and the app has 'files.metadata.read' permissions.");
      }
      
      setTracks(fetchedTracks);
      
      if (fetchedTracks.length > 0) {
        const sortedTracks = sortTracksByNumber(fetchedTracks);
        const firstSortedTrack = sortedTracks[0];
        const originalIndex = fetchedTracks.findIndex(track => track === firstSortedTrack);
        if (originalIndex !== -1) {
          setCurrentTrackIndex(originalIndex);
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

  useEffect(() => {
    const handleFocus = () => {
      if (window.location.pathname !== '/auth/dropbox/callback' && tracks.length === 0 && !isLoading) {
        fetchTracks();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [tracks.length, isLoading]);


  useEffect(() => {
    const updateCurrentTrack = () => {
      const audio = audioRef.current || document.querySelector('audio');
      if (!audio) return;

      const trackIndex = tracks.findIndex(track => {
        const audioSrc = audio.src || audio.currentSrc;
        return audioSrc && (
          track.src === audioSrc || 
          audioSrc.includes(track.src) || 
          track.src.includes(audioSrc.split('?')[0])
        );
      });

      if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
        setCurrentTrackIndex(trackIndex);
        setShuffleCounter(0);
      }
    };

    const pollInterval = setInterval(updateCurrentTrack, 500);
    return () => clearInterval(pollInterval);
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

  const handleTrackSelect = useCallback((index: number) => {
    if (index === currentTrackIndex) {
      setShuffleCounter(prev => prev + 1);
    } else {
      setCurrentTrackIndex(index);
      setShuffleCounter(0);
    }
    setIsInitialLoad(false);
  }, [currentTrackIndex]);



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
        repeatType: false,
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
