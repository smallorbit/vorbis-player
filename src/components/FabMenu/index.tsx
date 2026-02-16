import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FabOverlay, FabContainer, FabButton } from './styled';
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
  const [isOpen, setIsOpen] = useState(false);
  const [colorPickerActive, setColorPickerActive] = useState(false);
  const prevColorPickerActive = useRef(false);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const collapse = useCallback(() => {
    if (!colorPickerActive) {
      setIsOpen(false);
    }
  }, [colorPickerActive]);

  const handleItemAction = useCallback(
    (action: () => void) => {
      return () => {
        action();
        collapse();
      };
    },
    [collapse]
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (prevColorPickerActive.current && !colorPickerActive && isOpen) {
      setIsOpen(false);
    }
    prevColorPickerActive.current = colorPickerActive;
  }, [colorPickerActive, isOpen]);

  return createPortal(
    <>
      {isOpen && <FabOverlay onClick={collapse} />}
      <FabContainer>
        <FabMenuItems
          isOpen={isOpen}
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
        <FabButton
          $isOpen={isOpen}
          $accentColor={accentColor}
          onClick={toggle}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </FabButton>
      </FabContainer>
    </>,
    document.body
  );
}
