import React from 'react';
import type { Track } from '../services/dropbox';

interface PlaylistProps {
  tracks: Track[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
}

const Playlist: React.FC<PlaylistProps> = ({ tracks, currentTrackIndex, onTrackSelect }) => {
  return (
    <div className="w-full max-w-md mx-auto mt-6">
      <h3 className="text-lg font-semibold mb-4 text-center">Playlist</h3>
      <div className="bg-neutral-800 rounded-lg overflow-hidden">
        {tracks.map((track, index) => (
          <div
            key={index}
            onClick={() => onTrackSelect(index)}
            className={`px-4 py-3 cursor-pointer transition-colors duration-200 hover:bg-neutral-700 ${
              index === currentTrackIndex 
                ? 'bg-neutral-600 text-white' 
                : 'text-neutral-300 hover:text-white'
            } ${index !== tracks.length - 1 ? 'border-b border-neutral-700' : ''}`}
          >
            <div className="grid grid-cols-[3rem_1fr_auto] items-center gap-4">
              <div className="text-neutral-400 text-center">{index + 1}</div>
              <div className={`truncate ${
                  index === currentTrackIndex ? 'text-white' : 'text-neutral-200'
                }`}>
                {track.title}
              </div>
              {index === currentTrackIndex && (
                <div className="text-white">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Playlist; 