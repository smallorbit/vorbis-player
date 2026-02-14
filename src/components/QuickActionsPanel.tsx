import styled from 'styled-components';
import { theme } from '@/styles/theme';
import { usePlayerSizing } from '@/hooks/usePlayerSizing';
import { ControlButton } from './controls/styled';
import ColorPickerPopover from './ColorPickerPopover';
import { useCustomAccentColors } from '@/hooks/useCustomAccentColors';
import type { Track } from '@/services/spotify';
import { BackToLibraryIcon, PlaylistIcon, VisualEffectsIcon } from './icons/QuickActionIcons';
import { DebugSection, DebugLabel } from './styled/DebugComponents';

interface QuickActionsPanelProps {
  accentColor: string;
  currentTrack: Track | null;
  onShowPlaylist: () => void;
  onShowVisualEffects: () => void;
  onAccentColorChange: (color: string) => void;
  debugModeEnabled?: boolean;
  onBackToLibrary?: () => void;
  isVisible?: boolean;
}

const PanelWrapper = styled.div<{ $transitionDuration: number; $transitionEasing: string }>`
  position: absolute;
  top: 50%;
  left: 100%;
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
  border-right: none;
  border-top-left-radius: ${theme.borderRadius.lg};
  border-bottom-left-radius: ${theme.borderRadius.lg};
  border-top-right-radius: ${theme.borderRadius.lg};
  border-bottom-right-radius: ${theme.borderRadius.lg};
  box-shadow: 0 4px 20px rgba(0,0,0,0.35);
  backdrop-filter: blur(${theme.drawer.backdropBlur});
`;

export const QuickActionsPanel = ({
  accentColor,
  currentTrack,
  onShowPlaylist,
  onShowVisualEffects,
  onAccentColorChange,
  onBackToLibrary,
  debugModeEnabled = false,
  isVisible = true
}: QuickActionsPanelProps) => {
  const { isMobile, isTablet, transitionDuration, transitionEasing } = usePlayerSizing();

  const { customAccentColorOverrides, handleCustomAccentColor, handleAccentColorChange } = useCustomAccentColors({
    currentAlbumId: currentTrack?.album_id,
    onAccentColorChange
  });

  if (!isVisible) return null;

  return (
    <PanelWrapper $transitionDuration={transitionDuration} $transitionEasing={transitionEasing} onClick={(e) => e.stopPropagation()}>
      <PanelContainer>
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

        {debugModeEnabled && (
          <DebugSection $withBorderBottom>
            <DebugLabel>Debug Mode</DebugLabel>
          </DebugSection>
        )}
      </PanelContainer>
    </PanelWrapper>
  );
};

export default QuickActionsPanel;


