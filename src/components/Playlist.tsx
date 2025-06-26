import { memo, useMemo, useCallback, useState } from 'react';
import type { Track } from '../services/spotify';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';

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
        <Avatar className="w-12 h-12 sm:w-14 sm:h-14">
          <AvatarImage 
            src={track.image || '/api/placeholder/56/56'} 
            alt={track.album}
            className="object-cover"
          />
          <AvatarFallback className="bg-neutral-700 text-neutral-400">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-neutral-400">
              <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7zm0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" fill="currentColor"/>
            </svg>
          </AvatarFallback>
        </Avatar>
        {isSelected && (
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
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
        <Button 
          variant="ghost" 
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 h-8 w-8"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-neutral-400">
            <circle cx="12" cy="5" r="2" fill="currentColor"/>
            <circle cx="12" cy="12" r="2" fill="currentColor"/>
            <circle cx="12" cy="19" r="2" fill="currentColor"/>
          </svg>
        </Button>
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
      <Card className="bg-neutral-800/50 backdrop-blur-sm border-neutral-700/50">
        <CardHeader className="border-b border-neutral-700/50">
          <CardTitle className="text-lg font-semibold text-white">Up Next</CardTitle>
          <CardDescription className="text-sm text-neutral-400">{sortedTracks.length} tracks</CardDescription>
        </CardHeader>
        
        <CardContent className="p-0">
          <ScrollArea className="max-h-96">
            <div className="p-4 space-y-2">
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
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
});

export default Playlist; 