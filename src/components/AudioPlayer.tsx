import { useState, useEffect, useMemo, useRef } from 'react';
import AudioPlayer from 'react-modern-audio-player';
import Playlist from './Playlist';
import MediaCollage from './MediaCollage';
import { getDropboxAudioFiles, dropboxAuth } from '../services/dropbox';
import type { Track } from '../services/dropbox';
import { HyperText } from './ui/hyper-text';
import { sortTracksByNumber } from '../lib/utils';

const AudioPlayerComponent = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null!);
  const [shuffleCounter, setShuffleCounter] = useState(0);
  
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
      // Set the current track to the first one in sorted order before setting tracks
      if (fetchedTracks.length > 0) {
        const sortedTracks = sortTracksByNumber(fetchedTracks);
        const firstSortedTrack = sortedTracks[0];
        // The fetchedTracks are not sorted, so we find the original index
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

  const handleTrackSelect = (index: number) => {
    // If the same track is clicked again
    if (index === currentTrackIndex) {
      setShuffleCounter(prev => prev + 1);
    } else {
      // If a new track is clicked
      setCurrentTrackIndex(index);
      setShuffleCounter(0); // Reset counter for a new track
    }
    setIsInitialLoad(false);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateCurrentTrack = () => {
      // Find the track in the playlist that matches the audio player's current source
      const trackIndex = tracks.findIndex(track => track.src === audio.src);
      if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
        setCurrentTrackIndex(trackIndex);
        setShuffleCounter(0); // Reset shuffle counter when track changes via audio player controls
      }
    };

    audio.addEventListener('loadstart', updateCurrentTrack);
    
    return () => {
      audio.removeEventListener('loadstart', updateCurrentTrack);
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
              Panda Player
            </HyperText>
            <button
              onClick={() => setIsInitialLoad(false)}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg"
            >
              Click to start
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z"/>
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
          currentTrack={tracks[currentTrackIndex] || null} 
          shuffleCounter={shuffleCounter} 
        />
        <div className="mb-3 sm:mb-4 md:mb-6">
          <Playlist 
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            onTrackSelect={handleTrackSelect}
          />
        </div>
        <div className="bg-white/5 rounded-lg p-2 sm:p-3 md:p-4 backdrop-blur-sm border border-white/10 overflow-hidden">
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
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-2 sm:px-4">
      {renderContent()}
    </div>
  );
};

export default AudioPlayerComponent;
