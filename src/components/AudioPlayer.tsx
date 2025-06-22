import React, { useState, useEffect, useRef } from 'react';
import AudioPlayer from 'react-modern-audio-player';
import Playlist from './Playlist';
import { getDropboxAudioFiles } from '../services/dropbox';
import type { Track } from '../services/dropbox';
import { HyperText } from './ui/hyper-text';

const AudioPlayerComponent = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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

  const handleTrackSelect = (index: number) => {
    setCurrentTrackIndex(index);
  };

  // Convert tracks to the format expected by react-modern-audio-player
  const playList = tracks.map((track, index) => ({
    id: index + 1,
    src: track.src,
    name: track.title,
    writer: 'Unknown Artist',
    img: undefined,
  }));

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
    <div className="w-full max-w-full mx-auto mt-4 px-2 sm:px-4 sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl">
      <div className="bg-white/5 rounded-lg p-2 sm:p-3 md:p-4 backdrop-blur-sm border border-white/10 overflow-hidden">
        <div className="song-title text-center mb-3 sm:mb-4 md:mb-6 h-10 sm:h-12 md:h-16 flex items-center justify-center px-2">
          <div className="px-2 sm:px-3 md:px-4 pt-2 md:pt-3">
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
        </div>
        <div className="px-2 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-5 pb-2 sm:pb-3 overflow-hidden">
          <AudioPlayer
            playList={playList}
            audioInitialState={{
              isPlaying: false,
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
