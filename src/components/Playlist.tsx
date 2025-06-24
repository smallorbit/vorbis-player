import { memo, useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import type { Track } from '../services/dropbox';
import { sortTracksByNumber } from '../lib/utils';

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

  const handleTrackSelect = useCallback((sortedIndex: number) => {
    const selectedTrack = sortedTracks[sortedIndex];
    const originalIndex = tracks.findIndex(track => track === selectedTrack);
    if (originalIndex !== -1) {
      onTrackSelect(originalIndex);
    }
  }, [sortedTracks, tracks, onTrackSelect]);

  // Virtual list row renderer
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const track = sortedTracks[index];
    return (
      <div style={style}>
        <PlaylistItem
          track={track}
          index={index}
          isSelected={index === sortedCurrentTrackIndex}
          onSelect={handleTrackSelect}
        />
      </div>
    );
  }, [sortedTracks, sortedCurrentTrackIndex, handleTrackSelect]);

  // If track list is small, render normally. If large, use virtualization
  const shouldVirtualize = sortedTracks.length > 50;

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
              {shouldVirtualize ? (
                <tr>
                  <td colSpan={2} className="p-0">
                    <List
                      height={Math.min(400, sortedTracks.length * 60)} // Max height of 400px
                      itemCount={sortedTracks.length}
                      itemSize={60}
                      width="100%"
                    >
                      {Row}
                    </List>
                  </td>
                </tr>
              ) : (
                sortedTracks.map((track, index) => (
                  <PlaylistItem
                    key={`${track.title}-${track.src}`}
                    track={track}
                    index={index}
                    isSelected={index === sortedCurrentTrackIndex}
                    onSelect={handleTrackSelect}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export default Playlist; 