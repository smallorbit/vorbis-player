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
    
    const handleResize = () => checkOverflow();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [currentTrackIndex, tracks]);

  // Dynamically adjust font size to fit long song titles within the container width
  // This ensures titles are always readable regardless of length
  useEffect(() => {
    const adjustFontSize = () => {
      if (titleRef.current) {
        const titleElement = titleRef.current;
        const container = titleElement.parentElement;
        
        if (container) {
          const containerWidth = container.offsetWidth;
          const screenWidth = window.innerWidth;
          
          // Base font size based on screen size (responsive)
          let baseFontSize;
          if (screenWidth < 640) {
            baseFontSize = 18; // Mobile
          } else if (screenWidth < 768) {
            baseFontSize = 20; // Small tablet
          } else if (screenWidth < 1024) {
            baseFontSize = 24; // Tablet
          } else {
            baseFontSize = 32; // Desktop
          }
          
          let fontSize = baseFontSize;
          titleElement.style.fontSize = `${fontSize}px`;
          
          // Reduce font size until text fits, with responsive minimum
          const minFontSize = screenWidth < 640 ? 12 : 14;
          
          while (
            titleElement.scrollWidth > containerWidth && 
            fontSize > minFontSize
          ) {
            fontSize -= 1;
            titleElement.style.fontSize = `${fontSize}px`;
          }
        }
      }
    };
    
    adjustFontSize();
    
    const handleResize = () => adjustFontSize();
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

  return (
    <div className="w-full max-w-md mx-auto mt-4 px-4 sm:max-w-lg md:max-w-2xl lg:max-w-4xl">
      <div className="song-title text-center mb-4 sm:mb-6 h-12 sm:h-16 flex items-center justify-center px-2">
        <div 
          ref={titleRef}
          className="whitespace-nowrap text-sm sm:text-base md:text-lg"
        >
          {tracks[currentTrackIndex].title}
        </div>
      </div>
      <div className="bg-white/5 rounded-lg p-3 sm:p-4 backdrop-blur-sm border border-white/10">
        <div style={{ paddingRight: '20px' }}>
          <AudioPlayer
            ref={audioPlayerRef}
            autoPlay
            src={tracks[currentTrackIndex].src}
            onEnded={handleNext}
            onClickNext={handleNext}
            onClickPrevious={handlePrevious}
            showSkipControls
            showJumpControls={false}
            layout="horizontal"
          />
        </div>
      </div>
      <div className="mt-4 sm:mt-6">
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
