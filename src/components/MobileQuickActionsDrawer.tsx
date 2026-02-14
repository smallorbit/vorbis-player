import styled from 'styled-components';
import { theme } from '@/styles/theme';
import { ControlButton } from './controls/styled';
import ColorPickerPopover from './ColorPickerPopover';
import { useCustomAccentColors } from '@/hooks/useCustomAccentColors';
import type { Track } from '@/services/spotify';
import {
  GlowIcon,
  BackgroundVisualizerIcon,
  PlaylistIcon,
  VisualEffectsIcon,
  BackToLibraryIcon,
  ChevronDownIcon,
} from './icons/QuickActionIcons';
import { DebugSection, DebugLabel } from './styled/DebugComponents';

interface MobileQuickActionsDrawerProps {
  accentColor: string;
  currentTrack: Track | null;
  glowEnabled: boolean;
  backgroundVisualizerEnabled?: boolean;
  onShowPlaylist: () => void;
  onShowVisualEffects: () => void;
  onGlowToggle: () => void;
  onBackgroundVisualizerToggle?: () => void;
  onAccentColorChange: (color: string) => void;
  onBackToLibrary?: () => void;
  debugModeEnabled?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  transitionDuration: number;
  transitionEasing: string;
}

/* Sub drawer: sits below the controls panel, slides out from underneath it */
const DrawerWrapper = styled.div`
  width: 100%;
  flex-shrink: 0;
  overflow: hidden;
`;

/* Handle at the seam between controls panel and sub drawer - tap to expand/collapse */
const DrawerHandle = styled.button<{ $isExpanded: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid ${theme.colors.popover.border};
  border-top: none;
  border-radius: 0 0 ${theme.borderRadius.md} ${theme.borderRadius.md};
  cursor: pointer;
  color: ${theme.colors.gray[400]};
  transition: all 0.2s ease;

  &:hover {
    background: rgba(50, 50, 50, 0.8);
    color: ${theme.colors.white};
  }

  svg {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s ease;
    transform: ${({ $isExpanded }) => ($isExpanded ? 'rotate(180deg)' : 'rotate(0)')};
  }
`;

/* Content slides down from underneath the handle when expanded */
const DrawerContent = styled.div<{ $isExpanded: boolean; $transitionDuration: number; $transitionEasing: string }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm};
  background: ${theme.colors.overlay.dark};
  border: 1px solid ${theme.colors.popover.border};
  border-top: none;
  border-radius: 0 0 ${theme.borderRadius.lg} ${theme.borderRadius.lg};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(${theme.drawer.backdropBlur});

  max-height: ${({ $isExpanded }) => ($isExpanded ? '280px' : '0')};
  opacity: ${({ $isExpanded }) => ($isExpanded ? '1' : '0')};
  padding-top: ${({ $isExpanded }) => ($isExpanded ? theme.spacing.sm : '0')};
  padding-bottom: ${({ $isExpanded }) => ($isExpanded ? theme.spacing.sm : '0')};
  overflow: hidden;
  border-width: ${({ $isExpanded }) => ($isExpanded ? '1px' : '0')};
  border-top-width: 0;

  transition: ${({ $transitionDuration, $transitionEasing }) => {
    const timing = `${$transitionDuration}ms ${$transitionEasing}`;
    return `max-height ${timing}, opacity ${timing}, padding ${timing}, border-width ${timing}`;
  }};
`;

export const MobileQuickActionsDrawer = ({
  accentColor,
  currentTrack,
  glowEnabled,
  backgroundVisualizerEnabled,
  onShowPlaylist,
  onShowVisualEffects,
  onGlowToggle,
  onBackgroundVisualizerToggle,
  onAccentColorChange,
  onBackToLibrary,
  debugModeEnabled = false,
  isExpanded,
  onToggleExpand,
  transitionDuration,
  transitionEasing,
}: MobileQuickActionsDrawerProps) => {
  const isMobile = true;
  const isTablet = false;

  const { customAccentColorOverrides, handleCustomAccentColor, handleAccentColorChange } = useCustomAccentColors({
    currentTrackId: currentTrack?.id,
    onAccentColorChange,
  });

  return (
    <DrawerWrapper onClick={(e) => e.stopPropagation()}>
      <DrawerHandle
        $isExpanded={isExpanded}
        onClick={onToggleExpand}
        title={isExpanded ? 'Collapse quick actions' : 'Expand quick actions'}
        aria-expanded={isExpanded}
      >
        <ChevronDownIcon />
      </DrawerHandle>

      <DrawerContent
        $isExpanded={isExpanded}
        $transitionDuration={transitionDuration}
        $transitionEasing={transitionEasing}
      >
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

        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          onClick={onShowPlaylist}
          title="Show Playlist"
        >
          <PlaylistIcon />
        </ControlButton>

        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          onClick={onShowVisualEffects}
          title="Visual effects"
          data-testid="quick-visual-effects-button"
        >
          <VisualEffectsIcon />
        </ControlButton>

        <ColorPickerPopover
          accentColor={accentColor}
          currentTrack={currentTrack}
          onAccentColorChange={handleAccentColorChange}
          customAccentColorOverrides={customAccentColorOverrides}
          onCustomAccentColor={handleCustomAccentColor}
          $isMobile={isMobile}
          $isTablet={isTablet}
        />

        {onBackToLibrary && (
          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            accentColor={accentColor}
            onClick={onBackToLibrary}
            title="Back to Library"
          >
            <BackToLibraryIcon />
          </ControlButton>
        )}

        {debugModeEnabled && (
          <DebugSection>
            <DebugLabel>Debug Mode</DebugLabel>
          </DebugSection>
        )}
      </DrawerContent>
    </DrawerWrapper>
  );
};

export default MobileQuickActionsDrawer;
