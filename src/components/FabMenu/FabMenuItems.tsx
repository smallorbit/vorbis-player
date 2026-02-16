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

const ARC_START = (100 * Math.PI) / 180;
const ARC_END = (210 * Math.PI) / 180;
const RADIUS_DESKTOP = 80;
const RADIUS_MOBILE = 70;
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
  const radius = isMobile ? RADIUS_MOBILE : RADIUS_DESKTOP;

  const { customAccentColorOverrides, handleCustomAccentColor, handleAccentColorChange } =
    useCustomAccentColors({
      currentAlbumId: currentTrack?.album_id,
      onAccentColorChange,
    });

  const items = useMemo(() => {
    const list: Array<{
      key: string;
      label: string;
      render: (angle: number, radius: number, delay: number) => React.ReactNode;
    }> = [];

    list.push({
      key: 'glow',
      label: `Visual Effects ${glowEnabled ? 'enabled' : 'disabled'}`,
      render: (angle, r, delay) => (
        <FabMenuItem $angle={angle} $radius={r} $isOpen={isOpen} $delay={delay}>
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
          <FabMenuItemTooltip>{`Visual Effects ${glowEnabled ? 'enabled' : 'disabled'}`}</FabMenuItemTooltip>
        </FabMenuItem>
      ),
    });

    if (onBackgroundVisualizerToggle) {
      list.push({
        key: 'visualizer',
        label: `Background Visualizer ${backgroundVisualizerEnabled ? 'ON' : 'OFF'}`,
        render: (angle, r, delay) => (
          <FabMenuItem $angle={angle} $radius={r} $isOpen={isOpen} $delay={delay}>
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
            <FabMenuItemTooltip>{`Background Visualizer ${backgroundVisualizerEnabled ? 'ON' : 'OFF'}`}</FabMenuItemTooltip>
          </FabMenuItem>
        ),
      });
    }

    list.push({
      key: 'effects',
      label: 'Visual effects',
      render: (angle, r, delay) => (
        <FabMenuItem $angle={angle} $radius={r} $isOpen={isOpen} $delay={delay}>
          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            accentColor={accentColor}
            onClick={onItemAction(onShowVisualEffects)}
            title="Visual effects"
          >
            <VisualEffectsIcon />
          </ControlButton>
          <FabMenuItemTooltip>Visual effects</FabMenuItemTooltip>
        </FabMenuItem>
      ),
    });

    list.push({
      key: 'color',
      label: 'Theme options',
      render: (angle, r, delay) => (
        <FabMenuItem $angle={angle} $radius={r} $isOpen={isOpen} $delay={delay}>
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
          <FabMenuItemTooltip>Theme options</FabMenuItemTooltip>
        </FabMenuItem>
      ),
    });

    if (onBackToLibrary) {
      list.push({
        key: 'library',
        label: 'Back to Library',
        render: (angle, r, delay) => (
          <FabMenuItem $angle={angle} $radius={r} $isOpen={isOpen} $delay={delay}>
            <ControlButton
              $isMobile={isMobile}
              $isTablet={isTablet}
              accentColor={accentColor}
              onClick={onItemAction(onBackToLibrary)}
              title="Back to Library"
            >
              <BackToLibraryIcon />
            </ControlButton>
            <FabMenuItemTooltip>Back to Library</FabMenuItemTooltip>
          </FabMenuItem>
        ),
      });
    }

    list.push({
      key: 'playlist',
      label: 'Show Playlist',
      render: (angle, r, delay) => (
        <FabMenuItem $angle={angle} $radius={r} $isOpen={isOpen} $delay={delay}>
          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            accentColor={accentColor}
            onClick={onItemAction(onShowPlaylist)}
            title="Show Playlist"
          >
            <PlaylistIcon />
          </ControlButton>
          <FabMenuItemTooltip>Show Playlist</FabMenuItemTooltip>
        </FabMenuItem>
      ),
    });

    return list;
  }, [
    accentColor,
    currentTrack,
    glowEnabled,
    backgroundVisualizerEnabled,
    isMobile,
    isOpen,
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

  const arcSpan = ARC_END - ARC_START;
  const step = items.length > 1 ? arcSpan / (items.length - 1) : 0;

  return (
    <>
      {items.map((item, i) => {
        const angle = ARC_START + step * i;
        const delay = i * STAGGER_DELAY;
        return (
          <div key={item.key}>
            {item.render(angle, radius, delay)}
          </div>
        );
      })}
    </>
  );
};

export default FabMenuItems;
