import { useState, useEffect, useMemo, useRef } from 'react';
import AudioPlayer from 'react-modern-audio-player';
import Playlist from './Playlist';
import { getDropboxAudioFiles, dropboxAuth } from '../services/dropbox';
import type { Track } from '../services/dropbox';

const sortTracksByNumber = (tracks: Track[]): Track[] => {
  return [...tracks].sort((a, b) => {
    const aMatch = a.title.match(/^(\d+)/);
    const bMatch = b.title.match(/^(\d+)/);
    
    if (aMatch && bMatch) {
      const aNum = parseInt(aMatch[1], 10);
      const bNum = parseInt(bMatch[1], 10);
      return aNum - bNum;
    }
    
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    
    return a.title.localeCompare(b.title);
  });
};

const AudioPlayerComponent = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null!);
  
  useEffect(() => {
    // Don't try to fetch tracks if we're on the auth callback page
    if (window.location.pathname === '/auth/dropbox/callback') {
      setIsLoading(false); // Don't show loading state during auth
      return;
    }

    const fetchTracks = async () => {
      try {
        setError(null); // Clear any previous errors
        setIsLoading(true);
        const fetchedTracks = await getDropboxAudioFiles('');
        if (fetchedTracks.length === 0) {
          setError("No audio files found in your app's Dropbox folder. Make sure files have been added and the app has 'files.metadata.read' permissions.");
        }
        // Set the current track to the first one in sorted order before setting tracks
        if (fetchedTracks.length > 0) {
          const sortedTracks = sortTracksByNumber(fetchedTracks);
          const firstSortedTrack = sortedTracks[0];
          const originalIndex = fetchedTracks.findIndex(track => track === firstSortedTrack);
          if (originalIndex !== -1) {
            setCurrentTrackIndex(originalIndex);
          }
        }
        setTracks(fetchedTracks);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An unknown error occurred while fetching tracks.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTracks();
  }, []);

  // Listen for navigation events to retry fetching when returning from auth
  useEffect(() => {
    const handleFocus = () => {
      // Only retry if we're not on the callback page and don't have tracks
      if (window.location.pathname !== '/auth/dropbox/callback' && tracks.length === 0 && !isLoading) {
        const fetchTracks = async () => {
          try {
            setError(null);
            setIsLoading(true);
            const fetchedTracks = await getDropboxAudioFiles('');
            if (fetchedTracks.length === 0) {
              setError("No audio files found in your app's Dropbox folder. Make sure files have been added and the app has 'files.metadata.read' permissions.");
            }
            setTracks(fetchedTracks);
            // Set the current track to the first one in sorted order
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
        fetchTracks();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [tracks.length, isLoading]);

  const handleTrackSelect = (index: number) => {
    setIsInitialLoad(false);
    setCurrentTrackIndex(index);
  };

  // Listen for track changes when using next/previous buttons
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || tracks.length === 0 || isInitialLoad) return;

    const updateCurrentTrack = () => {
      const currentSrc = audio.src;
      if (!currentSrc) return;
      
      const trackIndex = tracks.findIndex(track => track.src === currentSrc);
      if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
        console.log('Track changed via skip buttons:', trackIndex, tracks[trackIndex]?.title);
        setCurrentTrackIndex(trackIndex);
      }
    };

    const handlePlay = () => {
      setIsInitialLoad(false);
    };

    // Listen to multiple events to catch track changes
    audio.addEventListener('loadstart', updateCurrentTrack);
    audio.addEventListener('loadeddata', updateCurrentTrack);
    audio.addEventListener('canplay', updateCurrentTrack);
    audio.addEventListener('play', handlePlay);
    
    return () => {
      audio.removeEventListener('loadstart', updateCurrentTrack);
      audio.removeEventListener('loadeddata', updateCurrentTrack);
      audio.removeEventListener('canplay', updateCurrentTrack);
      audio.removeEventListener('play', handlePlay);
    };
  }, [tracks, currentTrackIndex, isInitialLoad]);

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

  if (isLoading) {
    return <div className="text-center mt-20">Loading music from Dropbox...</div>;
  }

  if (error) {
    // Check if it's an authentication error
    const isAuthError = error.includes('Redirecting to Dropbox login') || 
                       error.includes('No authentication token') ||
                       error.includes('Authentication expired');
    
    if (isAuthError) {
      return (
        <div className="text-center mt-20">
          <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10 max-w-md mx-auto">
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
    
    return <div className="text-center mt-20 text-red-500">Error: {error}</div>;
  }

  if (tracks.length === 0) {
    return <div className="text-center mt-20">No tracks to play.</div>;
  }

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white/10 rounded-xl p-8 backdrop-blur-sm border border-white/20 shadow-xl max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Music Player</h2>
            <p className="text-gray-300 mb-8">Ready to start your playlist</p>
            <button
              onClick={() => setIsInitialLoad(false)}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg"
            >
              Start Playing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full mx-auto mt-4 px-2 sm:px-4 sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl">
      <div className="bg-white/5 rounded-lg p-2 sm:p-3 md:p-4 backdrop-blur-sm border border-white/10 overflow-hidden">
        <div className="song-title text-center mb-3 sm:mb-4 md:mb-6 h-10 sm:h-12 md:h-16 flex items-center justify-center px-2">
          <div className="px-2 sm:px-3 md:px-4 pt-2 md:pt-3">
            <span className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white py-0">
              {tracks[currentTrackIndex].title}
            </span>
          </div>
        </div>
        <div className="px-2 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-5 pb-2 sm:pb-3 overflow-hidden">
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
        </div>
      </div>
      <div className="mt-3 sm:mt-4 md:mt-6">
        <Playlist 
          tracks={tracks}
          currentTrackIndex={currentTrackIndex}
          onTrackSelect={handleTrackSelect}
        />
      </div>
    </div>
  );
};

export default AudioPlayerComponent;
