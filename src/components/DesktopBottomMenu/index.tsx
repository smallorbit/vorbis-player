import { createPortal } from 'react-dom';
import type { Track } from '@/services/spotify';
import { MenuWrapper, ContentArea } from './styled';
import { MenuContent } from './MenuContent';

interface DesktopBottomMenuProps {
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
}

export const DesktopBottomMenu = ({
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
}: DesktopBottomMenuProps) => {
  return createPortal(
    <MenuWrapper
      role="toolbar"
      aria-label="Quick actions"
    >
      <ContentArea>
        <MenuContent
          accentColor={accentColor}
          currentTrack={currentTrack}
          glowEnabled={glowEnabled}
          backgroundVisualizerEnabled={backgroundVisualizerEnabled}
          onShowVisualEffects={onShowVisualEffects}
          onGlowToggle={onGlowToggle}
          onBackgroundVisualizerToggle={onBackgroundVisualizerToggle}
          onAccentColorChange={onAccentColorChange}
          onBackToLibrary={onBackToLibrary}
          onShowPlaylist={onShowPlaylist}
        />
      </ContentArea>
    </MenuWrapper>,
    document.body
  );
};

export default DesktopBottomMenu;
