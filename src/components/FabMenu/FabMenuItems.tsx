import { useMemo } from 'react';
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
} from '../icons/QuickActionIcons';
import { FabMenuItem, FabMenuItemTooltip } from './styled';
import type { Track } from '@/services/spotify';

interface FabMenuItemsProps {
  accentColor: string;
  currentTrack: Track | null;
  glowEnabled: boolean;
  backgroundVisualizerEnabled?: boolean;
  onShowVisualEffects: () => void;
  onGlowToggle: () => void;
  onBackgroundVisualizerToggle?: () => void;
  onAccentColorChange: (color: string) => void;
  onBackToLibrary?: () => void;
  onShowPlaylist: () => void;
  onItemAction: (action: () => void) => () => void;
  isOpen: boolean;
  onColorPickerOpenChange?: (isOpen: boolean) => void;
}

const STAGGER_DELAY = 30;

export const FabMenuItems = ({
  accentColor,
  currentTrack,
  glowEnabled,
  backgroundVisualizerEnabled,
  onShowVisualEffects,
  onGlowToggle,
  onBackgroundVisualizerToggle,
  onAccentColorChange,
  onBackToLibrary,
  onShowPlaylist,
  onItemAction,
  isOpen,
  onColorPickerOpenChange,
}: FabMenuItemsProps) => {
  const { isMobile } = usePlayerSizing();
  const isTablet = false;

  const { customAccentColorOverrides, handleCustomAccentColor, handleAccentColorChange } =
    useCustomAccentColors({
      currentAlbumId: currentTrack?.album_id,
      onAccentColorChange,
    });

  const items = useMemo(() => {
    const list: Array<{
      key: string;
      label: string;
      content: React.ReactNode;
    }> = [];

    list.push({
      key: 'glow',
      label: `Visual Effects ${glowEnabled ? 'enabled' : 'disabled'}`,
      content: (
        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          isActive={glowEnabled}
          onClick={onItemAction(onGlowToggle)}
          title={`Visual Effects ${glowEnabled ? 'enabled' : 'disabled'}`}
          aria-pressed={glowEnabled}
        >
          <GlowIcon />
        </ControlButton>
      ),
    });

    if (onBackgroundVisualizerToggle) {
      list.push({
        key: 'visualizer',
        label: `Background Visualizer ${backgroundVisualizerEnabled ? 'ON' : 'OFF'}`,
        content: (
          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            accentColor={accentColor}
            isActive={backgroundVisualizerEnabled}
            onClick={onItemAction(onBackgroundVisualizerToggle)}
            title={`Background Visualizer ${backgroundVisualizerEnabled ? 'ON' : 'OFF'}`}
            aria-pressed={backgroundVisualizerEnabled}
          >
            <BackgroundVisualizerIcon />
          </ControlButton>
        ),
      });
    }

    list.push({
      key: 'effects',
      label: 'Visual effects',
      content: (
        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          onClick={onItemAction(onShowVisualEffects)}
          title="Visual effects"
        >
          <VisualEffectsIcon />
        </ControlButton>
      ),
    });

    list.push({
      key: 'color',
      label: 'Theme options',
      content: (
        <ColorPickerPopover
          accentColor={accentColor}
          currentTrack={currentTrack}
          onAccentColorChange={handleAccentColorChange}
          customAccentColorOverrides={customAccentColorOverrides}
          onCustomAccentColor={handleCustomAccentColor}
          $isMobile={isMobile}
          $isTablet={isTablet}
          onOpenChange={onColorPickerOpenChange}
        />
      ),
    });

    if (onBackToLibrary) {
      list.push({
        key: 'library',
        label: 'Back to Library',
        content: (
          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            accentColor={accentColor}
            onClick={onItemAction(onBackToLibrary)}
            title="Back to Library"
          >
            <BackToLibraryIcon />
          </ControlButton>
        ),
      });
    }

    list.push({
      key: 'playlist',
      label: 'Show Playlist',
      content: (
        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          onClick={onItemAction(onShowPlaylist)}
          title="Show Playlist"
        >
          <PlaylistIcon />
        </ControlButton>
      ),
    });

    return list;
  }, [
    accentColor,
    currentTrack,
    glowEnabled,
    backgroundVisualizerEnabled,
    isMobile,
    customAccentColorOverrides,
    handleCustomAccentColor,
    handleAccentColorChange,
    onItemAction,
    onGlowToggle,
    onBackgroundVisualizerToggle,
    onShowVisualEffects,
    onBackToLibrary,
    onShowPlaylist,
    onColorPickerOpenChange,
  ]);

  return (
    <>
      {items.map((item, i) => (
        <FabMenuItem key={item.key} $isOpen={isOpen} $delay={i * STAGGER_DELAY}>
          {item.content}
          <FabMenuItemTooltip>{item.label}</FabMenuItemTooltip>
        </FabMenuItem>
      ))}
    </>
  );
};

export default FabMenuItems;
