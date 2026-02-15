import { ControlButton } from '../controls/styled';
import ColorPickerPopover from '../ColorPickerPopover';
import { useCustomAccentColors } from '@/hooks/useCustomAccentColors';
import type { Track } from '@/services/spotify';
import {
  GlowIcon,
  BackgroundVisualizerIcon,
  PlaylistIcon,
  VisualEffectsIcon,
  BackToLibraryIcon,
} from '../icons/QuickActionIcons';
import { DebugSection, DebugLabel } from '../styled/DebugComponents';

interface MenuContentProps {
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
}

export const MenuContent = ({
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
}: MenuContentProps) => {
  const isMobile = true;
  const isTablet = false;

  const { customAccentColorOverrides, handleCustomAccentColor, handleAccentColorChange } = useCustomAccentColors({
    currentAlbumId: currentTrack?.album_id,
    onAccentColorChange,
  });

  return (
    <>
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
    </>
  );
};

export default MenuContent;
