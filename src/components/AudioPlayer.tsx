import React, { useState, useEffect, useRef } from 'react';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import { tracks } from '../data/tracks';

const AudioPlayerComponent = () => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isTextOverflowing, setIsTextOverflowing] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  const handleNext = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
  };

  const handlePrevious = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
  };

  useEffect(() => {
    const checkOverflow = () => {
      const title = tracks[currentTrackIndex].title;
      // Simple check: if title is longer than 25 characters, it probably needs scrolling
      const needsScrolling = title.length > 25;
      setIsTextOverflowing(needsScrolling);
      console.log(`Title: "${title}", Length: ${title.length}, Needs scrolling: ${needsScrolling}`);
    };
    
    checkOverflow();
  }, [currentTrackIndex]);

  return (
    <div className="w-[600px] mx-auto mt-10">
      <div className="song-title text-center mb-6 h-16 overflow-hidden relative">
        <div 
          ref={titleRef}
          className={`whitespace-nowrap song-title ${isTextOverflowing ? 'animate-marquee' : 'flex justify-center items-center h-full'}`}
        >
          {tracks[currentTrackIndex].title}
        </div>
      </div>
      <AudioPlayer
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
  );
};

export default AudioPlayerComponent;
