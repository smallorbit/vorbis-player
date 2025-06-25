import { memo, useMemo, useCallback, useState } from 'react';
import type { Track } from '../services/spotify';

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
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      onClick={() => onSelect(index)}
      className={`group flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'bg-green-600/20 border border-green-500/30' 
          : 'hover:bg-neutral-700/30 border border-transparent'
      } ${isDragging ? 'opacity-50 scale-95' : ''}`}
      draggable={true}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
    >
      {/* Drag Handle */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-grab active:cursor-grabbing">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-neutral-500">
          <rect x="3" y="4" width="3" height="3" fill="currentColor"/>
          <rect x="10" y="4" width="3" height="3" fill="currentColor"/>
          <rect x="17" y="4" width="3" height="3" fill="currentColor"/>
          <rect x="3" y="10" width="3" height="3" fill="currentColor"/>
          <rect x="10" y="10" width="3" height="3" fill="currentColor"/>
          <rect x="17" y="10" width="3" height="3" fill="currentColor"/>
          <rect x="3" y="16" width="3" height="3" fill="currentColor"/>
          <rect x="10" y="16" width="3" height="3" fill="currentColor"/>
          <rect x="17" y="16" width="3" height="3" fill="currentColor"/>
        </svg>
      </div>

      {/* Album Artwork */}
      <div className="relative flex-shrink-0">
        <img 
          src={track.image || '/api/placeholder/56/56'} 
          alt={track.album}
          className="w-12 h-12 sm:w-14 sm:h-14 max-h-12 sm:max-h-14 max-w-full object-cover shadow-md"
          style={{ width: 48, height: 48, maxWidth: 56, maxHeight: 56 }}
          onError={(e) => {
            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTYiIGhlaWdodD0iNTYiIHZpZXdCb3g9IjAgMCA1NiA1NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiBmaWxsPSIjNDA0MDQwIi8+CjxwYXRoIGQ9Ik0yOCAzNkMzMC4yMDkxIDM2IDMyIDM0LjIwOTEgMzIgMzJDMzIgMjkuNzkwOSAzMC4yMDkxIDI4IDI4IDI4QzI1Ljc5MDkgMjggMjQgMjkuNzkwOSAyNCAzMkMyNCAzNC4yMDkxIDI1Ljc5MDkgMzYgMjggMzZaIiBmaWxsPSIjNzA3MDcwIi8+CjxwYXRoIGQ9Ik0yOCA0NEMzNi44MzY2IDQ0IDQ0IDM2LjgzNjYgNDQgMjhDNDQgMTkuMTYzNCAzNi44MzY2IDEyIDI4IDEyQzE5LjE2MzQgMTIgMTIgMTkuMTYzNCAxMiAyOEMxMiAzNi44MzY2IDE5LjE2MzQgNDQgMjggNDRaTTI4IDQwQzM0LjYyNzQgNDAgNDAgMzQuNjI3NCA0MCAyOEM0MCAyMS4zNzI2IDM0LjYyNzQgMTYgMjggMTZDMjEuMzcyNiAxNiAxNiAyMS4zNzI2IDE2IDI4QzE2IDM0LjYyNzQgMjEuMzcyNiA0MCAyOCA0MFoiIGZpbGw9IiM3MDcwNzAiLz4KPC9zdmc+';
          }}
        />
        {isSelected && (
          <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        )}
      </div>

      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-base leading-tight truncate ${
          isSelected ? 'text-white' : 'text-neutral-100'
        }`}>
          {track.name}
        </div>
        <div className={`text-sm mt-1 truncate ${
          isSelected ? 'text-green-100' : 'text-neutral-400'
        }`}>
          {track.artists}
        </div>
      </div>

      {/* Duration and Menu */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className={`text-sm font-mono tabular-nums ${
          isSelected ? 'text-green-100' : 'text-neutral-400'
        }`}>
          {track.duration_ms ? `${Math.floor(track.duration_ms / 60000)}:${Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0')}` : '--:--'}
        </span>
        
        {/* Menu Button */}
        <button className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-neutral-600 rounded">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-neutral-400">
            <circle cx="12" cy="5" r="2" fill="currentColor"/>
            <circle cx="12" cy="12" r="2" fill="currentColor"/>
            <circle cx="12" cy="19" r="2" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
});

const Playlist = memo<PlaylistProps>(({ tracks, currentTrackIndex, onTrackSelect }) => {
  const sortedTracks = useMemo(() => tracks, [tracks]);
  
  const currentTrack = tracks[currentTrackIndex];
  const sortedCurrentTrackIndex = useMemo(() => {
    if (!currentTrack) return -1;
    return sortedTracks.findIndex((track: Track) => track === currentTrack);
  }, [sortedTracks, currentTrack]);

  const handleTrackSelect = useCallback((sortedIndex: number) => {
    const selectedTrack = sortedTracks[sortedIndex];
    const originalIndex = tracks.findIndex((track: Track) => track === selectedTrack);
    if (originalIndex !== -1) {
      onTrackSelect(originalIndex);
    }
  }, [sortedTracks, tracks, onTrackSelect]);

  // Virtualization disabled to maintain proper table structure
  // If needed for large playlists, implement with div-based layout instead of table

  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <div className="bg-neutral-800/50 rounded-lg backdrop-blur-sm border border-neutral-700/50">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-700/50">
          <h3 className="text-lg font-semibold text-white">Up Next</h3>
          <p className="text-sm text-neutral-400 mt-1">{sortedTracks.length} tracks</p>
        </div>
        
        {/* Playlist Items */}
        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
          {sortedTracks.map((track: Track, index: number) => (
            <PlaylistItem
              key={`${track.name}-${track.id}`}
              track={track}
              index={index}
              isSelected={index === sortedCurrentTrackIndex}
              onSelect={handleTrackSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export default Playlist; 