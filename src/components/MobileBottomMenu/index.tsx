import { createPortal } from 'react-dom';
import type { Track } from '@/services/spotify';
import { MenuWrapper, ContentArea } from './styled';
import { MenuContent } from './MenuContent';

interface MobileBottomMenuProps {
  accentColor: string;
  currentTrack: Track | null;
  glowEnabled: boolean;
  onShowVisualEffects: () => void;
  onGlowToggle: () => void;
  onAccentColorChange: (color: string) => void;
  onBackToLibrary?: () => void;
  onShowPlaylist: () => void;
  debugModeEnabled?: boolean;
}

export const MobileBottomMenu = ({
  accentColor,
  currentTrack,
  glowEnabled,
  onShowVisualEffects,
  onGlowToggle,
  onAccentColorChange,
  onBackToLibrary,
  onShowPlaylist,
  debugModeEnabled = false,
}: MobileBottomMenuProps) => {
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
          onShowVisualEffects={onShowVisualEffects}
          onGlowToggle={onGlowToggle}
          onAccentColorChange={onAccentColorChange}
          onBackToLibrary={onBackToLibrary}
          onShowPlaylist={onShowPlaylist}
          debugModeEnabled={debugModeEnabled}
        />
      </ContentArea>
    </MenuWrapper>,
    document.body
  );
};

export default MobileBottomMenu;
