import React from 'react';
import styled from 'styled-components';
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon } from '@/components/icons/PlaybackIcons';

const ZEN_CLICK_ZONE_Z = 5;

interface ZenClickZoneOverlayProps {
  isPlaying: boolean;
  visible: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onPlayPause: () => void;
}

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: ${ZEN_CLICK_ZONE_Z};
  border-radius: ${({ theme }) => theme.borderRadius['3xl']};
  overflow: hidden;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 2%;
  container-type: size;
`;

const IconButton = styled.button`
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.4);
  border: none;
  border-radius: 50%;
  width: clamp(72px, 20cqmin, 224px);
  height: clamp(72px, 20cqmin, 224px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 150ms ease;
  padding: 0;

  &:hover {
    opacity: 1;
  }
`;

const CenterIconButton = styled(IconButton)`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
`;

const zenIconStyle = { width: '60%', height: '60%' };

export const ZenClickZoneOverlay: React.FC<ZenClickZoneOverlayProps> = React.memo(({
  isPlaying,
  visible,
  onPrevious,
  onNext,
  onPlayPause,
}) => {
  if (!visible) return null;

  return (
    <Overlay>
      <IconButton
        onClick={(e) => { e.stopPropagation(); onPrevious(); }}
        aria-label="Previous track"
        data-testid="zen-prev-zone"
      >
        <PreviousIcon fill="white" style={zenIconStyle} />
      </IconButton>
      <CenterIconButton
        onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        data-testid="zen-playpause-zone"
      >
        {isPlaying
          ? <PauseIcon fill="white" style={zenIconStyle} />
          : <PlayIcon fill="white" style={zenIconStyle} />
        }
      </CenterIconButton>
      <IconButton
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        aria-label="Next track"
        data-testid="zen-next-zone"
      >
        <NextIcon fill="white" style={zenIconStyle} />
      </IconButton>
    </Overlay>
  );
});

ZenClickZoneOverlay.displayName = 'ZenClickZoneOverlay';
