import React from 'react';
import type { Track } from '../services/dropbox';


interface PlaylistProps {
  tracks: Track[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
}

interface PlaylistItemProps {
  track: Track;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
}

const PlaylistItem: React.FC<PlaylistItemProps> = ({ 
  track, 
  index, 
  isSelected, 
  onSelect 
}) => {
  return (
    <tr
      onClick={() => onSelect(index)}
      className={`cursor-pointer transition-colors duration-200 hover:bg-neutral-700 ${
        isSelected 
          ? 'bg-neutral-600 text-white' 
          : 'text-neutral-300'
      }`}
    >
      <td className={`px-6 py-4 whitespace-nowrap text-sm ${
        isSelected ? 'text-white font-medium' : 'text-neutral-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="truncate">
            {track.title}
          </div>
          {isSelected && (
            <div className="text-white flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-400">
        --
      </td>
    </tr>
  );
};

const Playlist: React.FC<PlaylistProps> = ({ tracks, currentTrackIndex, onTrackSelect }) => {
  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <h3 className="text-lg font-semibold mb-4 text-center text-white">Playlist</h3>
      <div className="bg-neutral-800 rounded-lg overflow-hidden border border-neutral-700 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-700">
            <thead className="bg-neutral-900">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Title
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="bg-neutral-800 divide-y divide-neutral-700">
              {tracks.map((track, index) => (
                <PlaylistItem
                  key={index}
                  track={track}
                  index={index}
                  isSelected={index === currentTrackIndex}
                  onSelect={onTrackSelect}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Playlist; 