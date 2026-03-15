import React, { memo, useRef, useEffect } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { Card, CardHeader, CardContent, CardDescription } from '../components/styled';
import { ScrollArea } from '../components/styled';
import { Avatar } from '../components/styled';
import ProviderIcon from './ProviderIcon';

// Styled components
const PlaylistContainer = styled.div`
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const PlaylistCard = styled(Card)`
  background: ${({ theme }) => theme.colors.muted.background};
  backdrop-filter: blur(12px);
  border: 1px solid ${({ theme }) => theme.colors.control.border};
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
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;

  ${({ theme, isSelected }) => isSelected ? `
    background: color-mix(in srgb, var(--accent-color) 20%, transparent);
    border-color: var(--accent-color);
  ` : `
    &:hover {
      background: ${theme.colors.control.backgroundHover};
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
  background: ${({ theme }) => theme.colors.overlay.light};
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
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected: boolean }>`
  font-size: ${({ theme }) => theme.fontSize.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ isSelected, theme }) => isSelected ? 'var(--accent-color)' : theme.colors.gray[400]};
`;

const Duration = styled.span.withConfig({
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected: boolean }>`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-family: monospace;
  color: ${({ isSelected, theme }) => isSelected ? 'var(--accent-color)' : theme.colors.gray[400]};
  flex-shrink: 0;
`;

interface PlaylistProps {
  tracks: Track[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
  isOpen?: boolean;
  showProviderIcons?: boolean;
}

interface PlaylistItemProps {
  track: Track;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  itemRef?: React.RefObject<HTMLDivElement>;
  showProviderIcon?: boolean;
}

const PlaylistItem = memo<PlaylistItemProps>(({
  track,
  index,
  isSelected,
  onSelect,
  itemRef,
  showProviderIcon
}) => {
  return (
    <PlaylistItemContainer
      ref={itemRef}
      onClick={() => onSelect(index)}
      isSelected={isSelected}
    >
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
        {showProviderIcon && track.provider && (
          <div style={{ position: 'absolute', bottom: -2, right: -2, zIndex: 2 }}>
            <ProviderIcon provider={track.provider} size={16} />
          </div>
        )}
      </AlbumArtContainer>

      <TrackInfo>
        <TrackName isSelected={isSelected}>
          {track.name}
        </TrackName>
        <TrackArtist isSelected={isSelected}>
          {track.artists}
        </TrackArtist>
      </TrackInfo>

      <Duration isSelected={isSelected}>
        {track.duration_ms ? `${Math.floor(track.duration_ms / 60000)}:${Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0')}` : '--:--'}
      </Duration>
    </PlaylistItemContainer>
  );
});

const Playlist = memo<PlaylistProps>(({ tracks, currentTrackIndex, onTrackSelect, isOpen = false, showProviderIcons = false }) => {
  const currentTrackRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current track when playlist opens
  useEffect(() => {
    if (isOpen && currentTrackRef.current && currentTrackIndex >= 0) {
      const timeoutId = setTimeout(() => {
        currentTrackRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, currentTrackIndex]);

  return (
    <PlaylistContainer>
      <PlaylistCard>
        <PlaylistHeader>
          <PlaylistDescription>{tracks.length} tracks</PlaylistDescription>
        </PlaylistHeader>

        <PlaylistContent>
          <PlaylistScrollArea>
            <PlaylistItems>
              {tracks.map((track: Track, index: number) => (
                <PlaylistItem
                  key={`${track.name}-${track.id}`}
                  track={track}
                  index={index}
                  isSelected={index === currentTrackIndex}
                  onSelect={onTrackSelect}
                  itemRef={index === currentTrackIndex ? currentTrackRef : undefined}
                  showProviderIcon={showProviderIcons}
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