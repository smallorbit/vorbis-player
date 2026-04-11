import React from 'react';
import styled from 'styled-components';

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
  z-index: 5;
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

const Icon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="white" style={{ width: '60%', height: '60%' }}>
    {children}
  </svg>
);

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
      >
        <Icon>
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </Icon>
      </IconButton>
      <CenterIconButton
        onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        <Icon>
          {isPlaying
            ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            : <path d="M8 5v14l11-7z" />
          }
        </Icon>
      </CenterIconButton>
      <IconButton
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        aria-label="Next track"
      >
        <Icon>
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </Icon>
      </IconButton>
    </Overlay>
  );
});

ZenClickZoneOverlay.displayName = 'ZenClickZoneOverlay';
