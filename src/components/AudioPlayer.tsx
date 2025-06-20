import React, { useState, useEffect, useRef } from 'react';
import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import Playlist from './Playlist';
import { getDropboxAudioFiles } from '../services/dropbox';
import type { Track } from '../services/dropbox';

const AudioPlayerComponent = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTextOverflowing, setIsTextOverflowing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const audioPlayerRef = useRef<any>(null);

  useEffect(() => {
    const fetchTracks = async () => {
      try {
        setIsLoading(true);
        const fetchedTracks = await getDropboxAudioFiles('');
        if (fetchedTracks.length === 0) {
          setError("No audio files found in your app's Dropbox folder. Make sure files have been added and the app has 'files.metadata.read' permissions.");
        }
        setTracks(fetchedTracks);
      } catch (err: any) {
        setError(err.message || "An unknown error occurred while fetching tracks.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTracks();
  }, []);

  const handleNext = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
  };

  const handlePrevious = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
  };

  const handleTrackSelect = (index: number) => {
    setCurrentTrackIndex(index);
  };

  const handleMuteToggle = () => {
    if (audioPlayerRef.current) {
      const audio = audioPlayerRef.current.audio.current;
      if (audio) {
        audio.muted = !audio.muted;
        setIsMuted(audio.muted);
      }
    }
  };

  useEffect(() => {
    const checkOverflow = () => {
      if (titleRef.current) {
        const titleElement = titleRef.current;
        const containerWidth = titleElement.parentElement?.offsetWidth || 0;
        const titleWidth = titleElement.scrollWidth;
        const isOverflowing = titleWidth > containerWidth;
        setIsTextOverflowing(isOverflowing);
        console.log(`Container width: ${containerWidth}, Title width: ${titleWidth}, Overflowing: ${isOverflowing}`);
      }
    };
    
    checkOverflow();
    
    // Re-check on window resize
    const handleResize = () => checkOverflow();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [currentTrackIndex, tracks]);

  if (isLoading) {
    return <div className="text-center mt-20">Loading music from Dropbox...</div>;
  }

  if (error) {
    return <div className="text-center mt-20 text-red-500">Error: {error}</div>;
  }

  if (tracks.length === 0) {
    return <div className="text-center mt-20">No tracks to play.</div>;
  }

  const CustomMuteButton = () => (
    <button
      onClick={handleMuteToggle}
      className="rhap_button-clear rhap_volume-button"
      aria-label={isMuted ? "Unmute" : "Mute"}
    >
      {isMuted ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
        </svg>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      )}
    </button>
  );

  return (
    <div className="w-[393px] mx-auto mt-10">
      <div className="song-title text-center mb-6 h-16 overflow-hidden relative">
        <div 
          ref={titleRef}
          className={`whitespace-nowrap song-title ${isTextOverflowing ? 'animate-marquee' : 'flex justify-center items-center h-full'}`}
        >
          {tracks[currentTrackIndex].title}
        </div>
      </div>
      <AudioPlayer
        ref={audioPlayerRef}
        autoPlay
        src={tracks[currentTrackIndex].src}
        onEnded={handleNext}
        onClickNext={handleNext}
        onClickPrevious={handlePrevious}
        showSkipControls
        showJumpControls={false}
        customControlsSection={[
          RHAP_UI.MAIN_CONTROLS,
          RHAP_UI.VOLUME_CONTROLS,
        ]}
        customVolumeControls={[<CustomMuteButton key="mute-button" />]}
        layout="horizontal"
      />
      <Playlist 
        tracks={tracks}
        currentTrackIndex={currentTrackIndex}
        onTrackSelect={handleTrackSelect}
      />
    </div>
  );
};

export default AudioPlayerComponent;
