import { memo, useMemo } from 'react';
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

const PlaylistItem = memo<PlaylistItemProps>(({ 
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
      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
        isSelected ? 'text-white' : 'text-neutral-400'
      }`}>
        {track.duration || '--:--'}
      </td>
    </tr>
  );
});

const Playlist = memo<PlaylistProps>(({ tracks, currentTrackIndex, onTrackSelect }) => {
  const sortedTracks = useMemo(() => sortTracksByNumber(tracks), [tracks]);
  
  const currentTrack = tracks[currentTrackIndex];
  const sortedCurrentTrackIndex = useMemo(() => {
    if (!currentTrack) return -1;
    return sortedTracks.findIndex(track => track === currentTrack);
  }, [sortedTracks, currentTrack]);

  const handleTrackSelect = (sortedIndex: number) => {
    const selectedTrack = sortedTracks[sortedIndex];
    const originalIndex = tracks.findIndex(track => track === selectedTrack);
    if (originalIndex !== -1) {
      onTrackSelect(originalIndex);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <div className="bg-neutral-800 rounded-lg overflow-hidden border border-neutral-700 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-700">
            <thead className="bg-neutral-900">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Title
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="bg-neutral-800 divide-y divide-neutral-700">
              {sortedTracks.map((track, index) => (
                <PlaylistItem
                  key={`${track.title}-${track.src}`}
                  track={track}
                  index={index}
                  isSelected={index === sortedCurrentTrackIndex}
                  onSelect={handleTrackSelect}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export default Playlist; 