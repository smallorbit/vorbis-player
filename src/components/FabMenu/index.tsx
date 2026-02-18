import { useState, useCallback, useRef, useEffect } from 'react';
import { ToolbarContainer } from './styled';
import FabMenuItems from './FabMenuItems';
import type { Track } from '@/services/spotify';

interface FabMenuProps {
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

export default function FabMenu({
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
}: FabMenuProps) {
  const [colorPickerActive, setColorPickerActive] = useState(false);
  const prevColorPickerActive = useRef(false);
  const [colorPickerJustClosed, setColorPickerJustClosed] = useState(false);

  useEffect(() => {
    if (prevColorPickerActive.current && !colorPickerActive) {
      setColorPickerJustClosed(true);
      const timer = setTimeout(() => setColorPickerJustClosed(false), 100);
      return () => clearTimeout(timer);
    }
    prevColorPickerActive.current = colorPickerActive;
  }, [colorPickerActive]);

  const handleItemAction = useCallback(
    (action: () => void) => {
      return () => {
        if (colorPickerJustClosed) return;
        action();
      };
    },
    [colorPickerJustClosed]
  );

  return (
    <ToolbarContainer>
      <FabMenuItems
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
        onItemAction={handleItemAction}
        onColorPickerOpenChange={setColorPickerActive}
      />
    </ToolbarContainer>
  );
}
