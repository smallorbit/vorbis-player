import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { Card, CardHeader, CardContent, CardDescription } from '../components/styled';
import { ScrollArea } from '../components/styled';
import { Avatar } from '../components/styled';
import { getTransparentVariant } from '../utils/colorExtractor';

// Styled components
const PlaylistContainer = styled.div`
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const PlaylistCard = styled(Card)`
  background: rgba(38, 38, 38, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(115, 115, 115, 0.5);
  border-radius: 1.25rem;
  overflow: hidden;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const PlaylistHeader = styled(CardHeader)`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.sm};
  flex-shrink: 0;
`;

const PlaylistDescription = styled(CardDescription)`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray[400]};
  margin: 0;
`;

const PlaylistContent = styled(CardContent)`
  padding: 0;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const PlaylistScrollArea = styled(ScrollArea)`
  flex: 1;
  min-height: 0;
`;

const PlaylistItems = styled.div`
  padding: 1rem ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const PlaylistItemContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isSelected', 'accentColor'].includes(prop),
})<{ isSelected: boolean; accentColor: string }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  
  ${({ isSelected, accentColor }) => isSelected ? `
    background: ${getTransparentVariant(accentColor, 0.2)};
    border-color: ${accentColor};
  ` : `
    &:hover {
      background: rgba(115, 115, 115, 0.3);
    }
  `}
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

const TrackName = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected: boolean }>`
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  font-size: ${({ theme }) => theme.fontSize.base};
  line-height: 1.25;
  color: ${({ isSelected, theme }) => isSelected ? theme.colors.white : '#f5f5f5'};
  
  /* Allow up to 2 lines with ellipsis on overflow */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
`;

const TrackArtist = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isSelected', 'accentColor'].includes(prop),
})<{ isSelected: boolean; accentColor: string }>`
  font-size: ${({ theme }) => theme.fontSize.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ isSelected, accentColor, theme }) => isSelected ? accentColor : theme.colors.gray[400]};
`;

const Duration = styled.span.withConfig({
  shouldForwardProp: (prop) => !['isSelected', 'accentColor'].includes(prop),
})<{ isSelected: boolean; accentColor: string }>`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-family: monospace;
  color: ${({ isSelected, accentColor, theme }) => isSelected ? accentColor : theme.colors.gray[400]};
  flex-shrink: 0;
`;

interface PlaylistProps {
  tracks: Track[];
  currentTrackIndex: number;
  accentColor: string;
  onTrackSelect: (index: number) => void;
  isOpen?: boolean; // Add isOpen prop to trigger scrolling
}

interface PlaylistItemProps {
  track: Track;
  index: number;
  isSelected: boolean;
  accentColor: string;
  onSelect: (index: number) => void;
  itemRef?: React.RefObject<HTMLDivElement>; // Add ref prop
}

const PlaylistItem = memo<PlaylistItemProps>(({ 
  track, 
  index, 
  isSelected, 
  accentColor,
  onSelect,
  itemRef
}) => {
  return (
    <PlaylistItemContainer
      ref={itemRef}
      onClick={() => onSelect(index)}
      isSelected={isSelected}
      accentColor={accentColor}
    >
      {/* Album Artwork */}
      <AlbumArtContainer>
        <Avatar 
          src={track.image} 
          alt={track.album}
          style={{ width: '3rem', height: '3rem' }}
          fallback={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7zm0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" fill="currentColor"/>
            </svg>
          }
        />
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
        <TrackArtist isSelected={isSelected} accentColor={accentColor}>
          {track.artists}
        </TrackArtist>
      </TrackInfo>

      {/* Duration */}
      <Duration isSelected={isSelected} accentColor={accentColor}>
        {track.duration_ms ? `${Math.floor(track.duration_ms / 60000)}:${Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0')}` : '--:--'}
      </Duration>
    </PlaylistItemContainer>
  );
});

const Playlist = memo<PlaylistProps>(({ tracks, currentTrackIndex, accentColor, onTrackSelect, isOpen = false }) => {
  const sortedTracks = useMemo(() => tracks, [tracks]);
  const currentTrackRef = useRef<HTMLDivElement>(null);
  
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

  // Auto-scroll to current track when playlist opens
  useEffect(() => {
    if (isOpen && currentTrackRef.current && sortedCurrentTrackIndex >= 0) {
      // Add a slight delay to ensure the playlist is fully rendered
      const timeoutId = setTimeout(() => {
        currentTrackRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, sortedCurrentTrackIndex]);

  return (
    <PlaylistContainer>
      <PlaylistCard>
        <PlaylistHeader>
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
                  accentColor={accentColor}
                  onSelect={handleTrackSelect}
                  itemRef={index === sortedCurrentTrackIndex ? currentTrackRef : undefined}
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