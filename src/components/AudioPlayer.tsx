import React, { useState, useEffect, useRef } from 'react';
import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import Playlist from './Playlist';
import { getDropboxAudioFiles } from '../services/dropbox';
import type { Track } from '../services/dropbox';
import { HyperText } from './ui/hyper-text';

const AudioPlayerComponent = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        <HyperText
          className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white py-0"
          duration={800}
          animateOnHover={false}
          startOnView={false}
          delay={0}
          as="span"
          trigger={currentTrackIndex}
          characterSet={["♪", "♫", "♬", "♩", "♯", "♭", "𝄞", "𝄡", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]}
        >
          {tracks[currentTrackIndex].title}
        </HyperText>
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
