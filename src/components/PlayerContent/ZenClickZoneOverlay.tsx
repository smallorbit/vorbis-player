import React from 'react';
import styled from 'styled-components';

type Zone = 'left' | 'center' | 'right';

interface ZenClickZoneOverlayProps {
  isPlaying: boolean;
  hoveredZone: Zone | null;
  visible: boolean;
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
  container-type: size;
`;

const ZoneDiv = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$hovered'].includes(prop),
})<{ $hovered: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;

  .zone-icon {
    opacity: ${({ $hovered }) => ($hovered ? 1 : 0)};
    transition: opacity 150ms ease;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 50%;
    width: 16cqw;
    height: 16cqw;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const LeftZone = styled(ZoneDiv)`
  width: 25%;
`;

const CenterZone = styled(ZoneDiv)`
  width: 50%;
`;

const RightZone = styled(ZoneDiv)`
  width: 25%;
`;

const Icon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="white" style={{ width: '60%', height: '60%' }}>
    {children}
  </svg>
);

export const ZenClickZoneOverlay: React.FC<ZenClickZoneOverlayProps> = React.memo(({
  isPlaying,
  hoveredZone,
  visible,
}) => {
  if (!visible) return null;

  return (
    <Overlay>
      <LeftZone $hovered={hoveredZone === 'left'}>
        <div className="zone-icon">
          <Icon>
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </Icon>
        </div>
      </LeftZone>
      <CenterZone $hovered={hoveredZone === 'center'}>
        <div className="zone-icon">
          <Icon>
            {isPlaying
              ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              : <path d="M8 5v14l11-7z" />
            }
          </Icon>
        </div>
      </CenterZone>
      <RightZone $hovered={hoveredZone === 'right'}>
        <div className="zone-icon">
          <Icon>
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </Icon>
        </div>
      </RightZone>
    </Overlay>
  );
});

ZenClickZoneOverlay.displayName = 'ZenClickZoneOverlay';
