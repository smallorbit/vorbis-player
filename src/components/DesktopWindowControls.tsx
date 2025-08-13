import React from 'react';
import styled from 'styled-components';
import { X, Minus, Square, Maximize2 } from 'lucide-react';
import { useDesktopIntegration } from '../hooks/useDesktopIntegration';

const ControlsContainer = styled.div<{ isMac: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: ${({ isMac }) => isMac ? 'flex-start' : 'flex-end'};
  padding: ${({ isMac }) => isMac ? '0 12px' : '0 8px'};
  gap: 8px;
  z-index: 1000;
  pointer-events: none;
  
  /* Prevent dragging from controls */
  -webkit-app-region: no-drag;
`;

const ControlButton = styled.button<{ 
  variant: 'close' | 'minimize' | 'maximize';
  isMac: boolean;
  isHovered: boolean;
}>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  transition: all 0.2s ease;
  background: ${({ variant, isMac, isHovered }) => {
    if (isMac) {
      switch (variant) {
        case 'close':
          return isHovered ? '#ff5f57' : '#ff5f57';
        case 'minimize':
          return isHovered ? '#ffbd2e' : '#ffbd2e';
        case 'maximize':
          return isHovered ? '#28ca42' : '#28ca42';
        default:
          return '#ff5f57';
      }
    } else {
      // Windows/Linux style
      return isHovered 
        ? 'rgba(255, 255, 255, 0.2)' 
        : 'rgba(255, 255, 255, 0.1)';
    }
  }};
  
  &:hover {
    transform: scale(1.1);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  svg {
    width: 8px;
    height: 8px;
    color: ${({ isMac, isHovered }) => 
      isMac 
        ? (isHovered ? '#000' : 'transparent')
        : (isHovered ? '#fff' : 'rgba(255, 255, 255, 0.7)')
    };
    opacity: ${({ isMac, isHovered }) => isMac ? (isHovered ? 1 : 0) : 1};
    transition: all 0.2s ease;
  }
`;

const MacControls = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const WindowsControls = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

export const DesktopWindowControls: React.FC = () => {
  const { isElectron, isMac, minimize, maximize, close, windowState } = useDesktopIntegration();
  const [hoveredButton, setHoveredButton] = React.useState<string | null>(null);

  if (!isElectron) {
    return null;
  }

  const handleMouseEnter = (button: string) => {
    setHoveredButton(button);
  };

  const handleMouseLeave = () => {
    setHoveredButton(null);
  };

  if (isMac) {
    return (
      <ControlsContainer isMac={true}>
        <MacControls>
          <ControlButton
            variant="close"
            isMac={true}
            isHovered={hoveredButton === 'close'}
            onClick={close}
            onMouseEnter={() => handleMouseEnter('close')}
            onMouseLeave={handleMouseLeave}
            aria-label="Close window"
          >
            <X />
          </ControlButton>
          <ControlButton
            variant="minimize"
            isMac={true}
            isHovered={hoveredButton === 'minimize'}
            onClick={minimize}
            onMouseEnter={() => handleMouseEnter('minimize')}
            onMouseLeave={handleMouseLeave}
            aria-label="Minimize window"
          >
            <Minus />
          </ControlButton>
          <ControlButton
            variant="maximize"
            isMac={true}
            isHovered={hoveredButton === 'maximize'}
            onClick={maximize}
            onMouseEnter={() => handleMouseEnter('maximize')}
            onMouseLeave={handleMouseLeave}
            aria-label={windowState.isMaximized ? "Restore window" : "Maximize window"}
          >
            {windowState.isMaximized ? <Square /> : <Maximize2 />}
          </ControlButton>
        </MacControls>
      </ControlsContainer>
    );
  }

  // Windows/Linux style controls
  return (
    <ControlsContainer isMac={false}>
      <WindowsControls>
        <ControlButton
          variant="minimize"
          isMac={false}
          isHovered={hoveredButton === 'minimize'}
          onClick={minimize}
          onMouseEnter={() => handleMouseEnter('minimize')}
          onMouseLeave={handleMouseLeave}
          aria-label="Minimize window"
        >
          <Minus />
        </ControlButton>
        <ControlButton
          variant="maximize"
          isMac={false}
          isHovered={hoveredButton === 'maximize'}
          onClick={maximize}
          onMouseEnter={() => handleMouseEnter('maximize')}
          onMouseLeave={handleMouseLeave}
          aria-label={windowState.isMaximized ? "Restore window" : "Maximize window"}
        >
          {windowState.isMaximized ? <Square /> : <Maximize2 />}
        </ControlButton>
        <ControlButton
          variant="close"
          isMac={false}
          isHovered={hoveredButton === 'close'}
          onClick={close}
          onMouseEnter={() => handleMouseEnter('close')}
          onMouseLeave={handleMouseLeave}
          aria-label="Close window"
        >
          <X />
        </ControlButton>
      </WindowsControls>
    </ControlsContainer>
  );
};