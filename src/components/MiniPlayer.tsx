import React from 'react';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import type { Track } from '@/services/spotify';

interface MiniPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onClose: () => void;
}

const MiniPlayerContainer = styled.div`
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(${theme.drawer.backdropBlur});
  border-top: 1px solid ${theme.colors.popover.border};
  padding: ${theme.spacing.md};
  z-index: 10;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
`;

const TrackImage = styled.div<{ $imageUrl?: string }>`
  width: 48px;
  height: 48px;
  border-radius: ${theme.borderRadius.md};
  background: ${({ $imageUrl }) => 
    $imageUrl 
      ? `url(${$imageUrl}) center/cover` 
      : 'linear-gradient(135deg, #333, #555)'};
  flex-shrink: 0;
`;

const TrackInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
`;

const TrackName = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${theme.colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TrackArtist = styled.div`
  font-size: 0.75rem;
  color: ${theme.colors.muted.foreground};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 2px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 1px;
  overflow: hidden;
  cursor: pointer;
`;

const ProgressFill = styled.div<{ $progress: number }>`
  height: 100%;
  width: ${({ $progress }) => $progress}%;
  background: ${theme.colors.accent};
  transition: width 0.1s linear;
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
`;

const PlayPauseButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${theme.colors.white};
  border: none;
  color: ${theme.colors.black};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;

  &:hover {
    transform: scale(1.05);
    opacity: 0.9;
  }

  &:active {
    transform: scale(0.95);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: ${theme.borderRadius.md};
  background: transparent;
  border: 1px solid ${theme.colors.popover.border};
  color: ${theme.colors.muted.foreground};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${theme.colors.muted.background};
    color: ${theme.colors.white};
    border-color: ${theme.colors.accent};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentTrack,
  isPlaying,
  onPlayPause,
  onClose
}) => {
  if (!currentTrack) {
    return null;
  }

  // Simple progress calculation (could be enhanced with actual playback position)
  const progress = 0; // Placeholder - would need playback position from state

  return (
    <MiniPlayerContainer>
      <TrackImage $imageUrl={currentTrack.image} />
      
      <TrackInfo>
        <TrackName>{currentTrack.name}</TrackName>
        <TrackArtist>{currentTrack.artists}</TrackArtist>
        <ProgressBar>
          <ProgressFill $progress={progress} />
        </ProgressBar>
      </TrackInfo>

      <Controls>
        <PlayPauseButton onClick={onPlayPause} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </PlayPauseButton>
        
        <CloseButton onClick={onClose} title="Close drawer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </CloseButton>
      </Controls>
    </MiniPlayerContainer>
  );
};

export default MiniPlayer;
