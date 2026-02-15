import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Track } from '@/services/spotify';
import { MenuWrapper, ContentArea } from './styled';
import { MenuContent } from './MenuContent';

interface MobileBottomMenuProps {
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
  transitionDuration: number;
  transitionEasing: string;
  isExpanded: boolean;
  onCollapse: () => void;
}

export const MobileBottomMenu = ({
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
  transitionDuration,
  transitionEasing,
  isExpanded,
  onCollapse,
}: MobileBottomMenuProps) => {
  // Auto-collapse wrappers: collapse menu then call the handler
  const handleShowPlaylist = useCallback(() => {
    onCollapse();
    onShowPlaylist();
  }, [onCollapse, onShowPlaylist]);

  const handleShowVisualEffects = useCallback(() => {
    onCollapse();
    onShowVisualEffects();
  }, [onCollapse, onShowVisualEffects]);

  return createPortal(
    <MenuWrapper
      role="toolbar"
      aria-label="Quick actions"
      $isExpanded={isExpanded}
      $transitionDuration={transitionDuration}
      $transitionEasing={transitionEasing}
    >
      <ContentArea aria-hidden={!isExpanded}>
        <MenuContent
          accentColor={accentColor}
          currentTrack={currentTrack}
          glowEnabled={glowEnabled}
          backgroundVisualizerEnabled={backgroundVisualizerEnabled}
          onShowPlaylist={handleShowPlaylist}
          onShowVisualEffects={handleShowVisualEffects}
          onGlowToggle={onGlowToggle}
          onBackgroundVisualizerToggle={onBackgroundVisualizerToggle}
          onAccentColorChange={onAccentColorChange}
          onBackToLibrary={onBackToLibrary}
          debugModeEnabled={debugModeEnabled}
        />
      </ContentArea>
    </MenuWrapper>,
    document.body
  );
};

export default MobileBottomMenu;
