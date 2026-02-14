import styled from 'styled-components';
import { theme } from '@/styles/theme';
import { usePlayerSizing } from '@/hooks/usePlayerSizing';
import { ControlButton } from './controls/styled';
import { GlowIcon, BackgroundVisualizerIcon } from './icons/QuickActionIcons';

interface LeftQuickActionsPanelProps {
  accentColor: string;
  glowEnabled: boolean;
  onGlowToggle: () => void;
  onBackgroundVisualizerToggle?: () => void;
  backgroundVisualizerEnabled?: boolean;
  isVisible?: boolean;
}

const PanelWrapper = styled.div<{ $transitionDuration: number; $transitionEasing: string }>`
  position: absolute;
  top: 50%;
  right: 100%;
  transform: translateY(-50%);
  transition: transform ${({ $transitionDuration }) => $transitionDuration}ms ${({ $transitionEasing }) => $transitionEasing};
  z-index: ${theme.zIndex.uiOverlay};
  isolation: isolate;
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

export const LeftQuickActionsPanel = ({
  accentColor,
  glowEnabled,
  onGlowToggle,
  onBackgroundVisualizerToggle,
  backgroundVisualizerEnabled,
  isVisible = true
}: LeftQuickActionsPanelProps) => {
  const { isMobile, isTablet, transitionDuration, transitionEasing } = usePlayerSizing();

  if (!isVisible) return null;

  return (
    <PanelWrapper $transitionDuration={transitionDuration} $transitionEasing={transitionEasing} onClick={(e) => e.stopPropagation()}>
      <PanelContainer>
        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          isActive={glowEnabled}
          onClick={onGlowToggle}
          title={`Visual Effects ${glowEnabled ? 'enabled' : 'disabled'}`}
        >
          <GlowIcon />
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
            <BackgroundVisualizerIcon />
          </ControlButton>
        )}
      </PanelContainer>
    </PanelWrapper>
  );
};

export default LeftQuickActionsPanel;

