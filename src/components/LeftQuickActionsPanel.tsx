import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import { usePlayerSizing } from '@/hooks/usePlayerSizing';
import { ControlButton } from './controls/styled';

interface LeftQuickActionsPanelProps {
  accentColor: string;
  glowEnabled: boolean;
  onGlowToggle: () => void;
  onBackgroundVisualizerToggle?: () => void;
  backgroundVisualizerEnabled?: boolean;
  isVisible?: boolean;
}

const PanelWrapper = styled.div<{ $isOpen: boolean; $transitionDuration: number; $transitionEasing: string }>`
  position: absolute;
  top: 50%;
  right: 100%;
  transform: translateY(-50%) translateX(${({ $isOpen }) => ($isOpen ? '0' : '12px')});
  transition: transform ${({ $transitionDuration }) => $transitionDuration}ms ${({ $transitionEasing }) => $transitionEasing};
  z-index: ${theme.zIndex.popover};
`;

const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs};
  background: ${theme.colors.overlay.dark};
  border: 1px solid ${theme.colors.popover.border};
  border-left: none;
  border-top-left-radius: ${theme.borderRadius.lg};
  border-bottom-left-radius: ${theme.borderRadius.lg};
  border-top-right-radius: ${theme.borderRadius.lg};
  border-bottom-right-radius: ${theme.borderRadius.lg};
  box-shadow: 0 4px 20px rgba(0,0,0,0.35);
  backdrop-filter: blur(${theme.drawer.backdropBlur});
`;

const ToggleHandle = styled.button<{ $accentColor: string }>`
  position: absolute;
  top: 50%;
  right: -12px;
  transform: translateY(-50%);
  width: 12px;
  height: 48px;
  border: none;
  border-top-right-radius: ${theme.borderRadius.md};
  border-bottom-right-radius: ${theme.borderRadius.md};
  background: ${({ $accentColor }) => $accentColor};
  cursor: pointer;
`;

export const LeftQuickActionsPanel: React.FC<LeftQuickActionsPanelProps> = ({
  accentColor,
  glowEnabled,
  onGlowToggle,
  onBackgroundVisualizerToggle,
  backgroundVisualizerEnabled,
  isVisible = true
}) => {
  const { isMobile, isTablet, transitionDuration, transitionEasing } = usePlayerSizing();

  const defaultOpen = useMemo(() => !isMobile, [isMobile]);
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  if (!isVisible) return null;

  return (
    <PanelWrapper $isOpen={isOpen} $transitionDuration={transitionDuration} $transitionEasing={transitionEasing} onClick={(e) => e.stopPropagation()}>
      <PanelContainer>
        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          isActive={glowEnabled}
          onClick={onGlowToggle}
          title={`Visual Effects ${glowEnabled ? 'enabled' : 'disabled'}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v4m0 10v4m9-9h-4m-10 0H3" />
          </svg>
        </ControlButton>

        {onBackgroundVisualizerToggle && (
          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            accentColor={accentColor}
            isActive={backgroundVisualizerEnabled}
            onClick={onBackgroundVisualizerToggle}
            title={`Background Visualizer ${backgroundVisualizerEnabled ? 'ON' : 'OFF'}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </ControlButton>
        )}
      </PanelContainer>

      <ToggleHandle $accentColor={accentColor} aria-label={isOpen ? 'Collapse quick actions' : 'Expand quick actions'} onClick={() => setIsOpen(v => !v)} />
    </PanelWrapper>
  );
};

export default LeftQuickActionsPanel;

