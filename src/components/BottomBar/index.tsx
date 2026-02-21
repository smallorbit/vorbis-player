import { createPortal } from 'react-dom';
import { BottomBarContainer, BottomBarInner } from './styled';
import { ControlButton } from '../controls/styled';
import ColorPickerPopover from '../ColorPickerPopover';
import { useCustomAccentColors } from '@/hooks/useCustomAccentColors';
import { usePlayerSizing } from '@/hooks/usePlayerSizing';
import {
  GlowIcon,
  BackgroundVisualizerIcon,
  VisualEffectsIcon,
  BackToLibraryIcon,
  PlaylistIcon,
  ZenModeIcon,
} from '../icons/QuickActionIcons';
import type { Track } from '@/services/spotify';

interface BottomBarProps {
  accentColor: string;
  currentTrack: Track | null;
  glowEnabled: boolean;
  backgroundVisualizerEnabled?: boolean;
  zenModeEnabled?: boolean;
  onShowVisualEffects: () => void;
  onGlowToggle: () => void;
  onBackgroundVisualizerToggle?: () => void;
  onAccentColorChange: (color: string) => void;
  onBackToLibrary?: () => void;
  onShowPlaylist: () => void;
  onZenModeToggle?: () => void;
}

export default function BottomBar({
  accentColor,
  currentTrack,
  glowEnabled,
  backgroundVisualizerEnabled,
  zenModeEnabled,
  onShowVisualEffects,
  onGlowToggle,
  onBackgroundVisualizerToggle,
  onAccentColorChange,
  onBackToLibrary,
  onShowPlaylist,
  onZenModeToggle,
}: BottomBarProps) {
  const { isMobile, isTablet } = usePlayerSizing();

  const { customAccentColorOverrides, handleCustomAccentColor, handleAccentColorChange } =
    useCustomAccentColors({
      currentAlbumId: currentTrack?.album_id,
      onAccentColorChange,
    });

  return createPortal(
    <BottomBarContainer>
      <BottomBarInner>
        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          isActive={glowEnabled}
          onClick={onGlowToggle}
          title={`Visual Effects ${glowEnabled ? 'enabled' : 'disabled'}`}
          aria-pressed={glowEnabled}
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
            aria-pressed={backgroundVisualizerEnabled}
          >
            <BackgroundVisualizerIcon />
          </ControlButton>
        )}

        <ColorPickerPopover
          accentColor={accentColor}
          currentTrack={currentTrack}
          onAccentColorChange={handleAccentColorChange}
          customAccentColorOverrides={customAccentColorOverrides}
          onCustomAccentColor={handleCustomAccentColor}
          $isMobile={isMobile}
          $isTablet={isTablet}
        />

        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          onClick={onShowVisualEffects}
          title="Visual effects"
        >
          <VisualEffectsIcon />
        </ControlButton>

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

        {onZenModeToggle && (
          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            accentColor={accentColor}
            isActive={zenModeEnabled}
            onClick={onZenModeToggle}
            title={`Zen Mode ${zenModeEnabled ? 'ON' : 'OFF'}`}
            aria-pressed={zenModeEnabled}
          >
            <ZenModeIcon />
          </ControlButton>
        )}
      </BottomBarInner>
    </BottomBarContainer>,
    document.body
  );
}
