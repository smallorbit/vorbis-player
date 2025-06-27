import { memo, useMemo, useCallback, useState } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/styled';
import { ScrollArea } from '../components/styled';
import { Button } from '../components/styled';
import { Avatar, AvatarImage, AvatarFallback } from '../components/styled';

// Styled components
const PlaylistContainer = styled.div`
  width: 100%;
  max-width: 56rem;
  margin: 0 auto;
  margin-top: 0; /* Remove the mt-6 gap */
`;

const PlaylistCard = styled(Card)`
  background: rgba(38, 38, 38, 0.5);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(115, 115, 115, 0.5);
`;

const PlaylistHeader = styled(CardHeader)`
  border-bottom: 1px solid rgba(115, 115, 115, 0.5);
`;

const PlaylistTitle = styled(CardTitle)`
  font-size: ${({ theme }) => theme.fontSize.lg};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.white};
`;

const PlaylistDescription = styled(CardDescription)`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray[400]};
`;

const PlaylistContent = styled(CardContent)`
  padding: 0;
`;

const PlaylistScrollArea = styled(ScrollArea)`
  max-height: 24rem;
`;

const PlaylistItems = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const PlaylistItemContainer = styled.div<{ isSelected: boolean; isDragging: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  
  ${({ isSelected }) => isSelected ? `
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.3);
  ` : `
    &:hover {
      background: rgba(115, 115, 115, 0.3);
    }
  `}
  
  ${({ isDragging }) => isDragging && `
    opacity: 0.5;
    transform: scale(0.95);
  `}
  
  &:hover .drag-handle {
    opacity: 1;
  }
  
  &:hover .menu-button {
    opacity: 1;
  }
`;

const DragHandle = styled.div`
  opacity: 0;
  transition: opacity 0.2s ease;
  cursor: grab;
  color: ${({ theme }) => theme.colors.gray[500]};
  
  &:active {
    cursor: grabbing;
  }
`;

const AlbumArtContainer = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const PlayIcon = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.white};
`;

const TrackInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const TrackName = styled.div<{ isSelected: boolean }>`
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  font-size: ${({ theme }) => theme.fontSize.base};
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ isSelected, theme }) => isSelected ? theme.colors.white : '#f5f5f5'};
`;

const TrackArtist = styled.div<{ isSelected: boolean }>`
  font-size: ${({ theme }) => theme.fontSize.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ isSelected, theme }) => isSelected ? '#bbf7d0' : theme.colors.gray[400]};
`;

const TrackMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  flex-shrink: 0;
`;

const Duration = styled.span<{ isSelected: boolean }>`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-family: monospace;
  color: ${({ isSelected, theme }) => isSelected ? '#bbf7d0' : theme.colors.gray[400]};
`;

const MenuButton = styled(Button)`
  opacity: 0;
  transition: opacity 0.2s ease;
  padding: ${({ theme }) => theme.spacing.xs};
  height: 2rem;
  width: 2rem;
  color: ${({ theme }) => theme.colors.gray[400]};
  
  .menu-button & {
    opacity: 1;
  }
`;

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
    <PlaylistItemContainer
      onClick={() => onSelect(index)}
      isSelected={isSelected}
      isDragging={isDragging}
      draggable={true}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
    >
      {/* Drag Handle */}
      <DragHandle className="drag-handle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
      </DragHandle>

      {/* Album Artwork */}
      <AlbumArtContainer>
        <Avatar style={{ width: '3rem', height: '3rem' }}>
          <AvatarImage 
            src={track.image || '/api/placeholder/56/56'} 
            alt={track.album}
            style={{ objectFit: 'cover' }}
          />
          <AvatarFallback style={{ backgroundColor: '#374151', color: '#9ca3af' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7zm0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" fill="currentColor"/>
            </svg>
          </AvatarFallback>
        </Avatar>
        {isSelected && (
          <PlayIcon>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </PlayIcon>
        )}
      </AlbumArtContainer>

      {/* Track Info */}
      <TrackInfo>
        <TrackName isSelected={isSelected}>
          {track.name}
        </TrackName>
        <TrackArtist isSelected={isSelected}>
          {track.artists}
        </TrackArtist>
      </TrackInfo>

      {/* Duration and Menu */}
      <TrackMeta>
        <Duration isSelected={isSelected}>
          {track.duration_ms ? `${Math.floor(track.duration_ms / 60000)}:${Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0')}` : '--:--'}
        </Duration>
        
        {/* Menu Button */}
        <MenuButton 
          variant="ghost" 
          size="sm"
          className="menu-button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="5" r="2" fill="currentColor"/>
            <circle cx="12" cy="12" r="2" fill="currentColor"/>
            <circle cx="12" cy="19" r="2" fill="currentColor"/>
          </svg>
        </MenuButton>
      </TrackMeta>
    </PlaylistItemContainer>
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
    <PlaylistContainer>
      <PlaylistCard>
        <PlaylistHeader>
          <PlaylistTitle>Up Next</PlaylistTitle>
          <PlaylistDescription>{sortedTracks.length} tracks</PlaylistDescription>
        </PlaylistHeader>
        
        <PlaylistContent>
          <PlaylistScrollArea>
            <PlaylistItems>
              {sortedTracks.map((track: Track, index: number) => (
                <PlaylistItem
                  key={`${track.name}-${track.id}`}
                  track={track}
                  index={index}
                  isSelected={index === sortedCurrentTrackIndex}
                  onSelect={handleTrackSelect}
                />
              ))}
            </PlaylistItems>
          </PlaylistScrollArea>
        </PlaylistContent>
      </PlaylistCard>
    </PlaylistContainer>
  );
});

export default Playlist; 