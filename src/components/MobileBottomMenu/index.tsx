import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useVerticalSwipeGesture } from '@/hooks/useVerticalSwipeGesture';
import type { Track } from '@/services/spotify';
import { MenuWrapper, HandleArea, PillIndicator, ContentArea } from './styled';
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
}: MobileBottomMenuProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const { ref: handleRef, isDragging, dragOffset } = useVerticalSwipeGesture({
    onSwipeUp: () => setIsExpanded(true),
    onSwipeDown: () => setIsExpanded(false),
    enabled: true,
  });

  // Measure content height with ResizeObserver
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContentHeight(entry.contentRect.height);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute drag transform offset
  const getDragOffset = (): number => {
    if (!isDragging) return 0;

    if (isExpanded) {
      // Dragging down from expanded: allow positive offset (push down), clamp to contentHeight
      return Math.max(0, Math.min(dragOffset, contentHeight));
    } else {
      // Dragging up from collapsed: allow negative offset (pull up), clamp to -contentHeight
      return Math.max(-contentHeight, Math.min(0, dragOffset));
    }
  };

  const computedDragOffset = getDragOffset();

  const handleTap = useCallback(() => {
    if (!isDragging) {
      setIsExpanded((prev) => !prev);
    }
  }, [isDragging]);

  // Auto-collapse wrappers: collapse menu then call the handler
  const handleShowPlaylist = useCallback(() => {
    setIsExpanded(false);
    onShowPlaylist();
  }, [onShowPlaylist]);

  const handleShowVisualEffects = useCallback(() => {
    setIsExpanded(false);
    onShowVisualEffects();
  }, [onShowVisualEffects]);

  return createPortal(
    <MenuWrapper
      role="toolbar"
      aria-label="Quick actions"
      $isExpanded={isExpanded}
      $isDragging={isDragging}
      $dragOffset={computedDragOffset}
      $transitionDuration={transitionDuration}
      $transitionEasing={transitionEasing}
    >
      <HandleArea
        ref={handleRef}
        role="button"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse quick actions' : 'Expand quick actions'}
        onClick={handleTap}
      >
        <PillIndicator />
      </HandleArea>

      <ContentArea ref={contentRef} aria-hidden={!isExpanded}>
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
