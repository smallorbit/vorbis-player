/**
  * Centralized keyboard shortcuts hook for the player
  * Consolidates all keyboard event handling in one place
  * 
  * Supported shortcuts:
  * - Space: Play/Pause
  * - ArrowRight: Next track
  * - ArrowLeft: Previous track
 * - V: Toggle background visualizations
  * - O: Toggle visual effects menu
  * - G: Toggle glow effect
  * - ?: Show keyboard shortcuts help
  * - Escape: Close menus (playlist drawer and visual effects)
  * - M: Mute
 * - ArrowUp: (Pointer device) Toggle playlist drawer; (Touch) Volume up
 * - ArrowDown: (Pointer device) Toggle library drawer; (Touch) Volume down
  * - L: Like/Unlike track
  */

import { useEffect } from 'react';

interface KeyboardShortcutOptions {
  /** When true, ArrowUp/ArrowDown open drawers (set when user has pointer input, not touch-only) */
  prefersPointerInput?: boolean;
}

interface KeyboardShortcutHandlers {
  // Playback controls
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  
  // Menu toggles
  onClosePlaylist?: () => void;
  onToggleVisualEffectsMenu?: () => void;
  onCloseVisualEffects?: () => void;
  
  // Background visualizer
  onToggleBackgroundVisualizer?: () => void;
  
  // Glow effect
  onToggleGlow?: () => void;
  
  // Help
  onToggleHelp?: () => void;
  
  // Other
  onMute?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onToggleLike?: () => void;
  onCloseMobileMenu?: () => void;
  /** Open playlist drawer (desktop: ArrowUp) */
  onShowPlaylist?: () => void;
  /** Open library drawer (desktop: ArrowDown) */
  onOpenLibraryDrawer?: () => void;
  /** Toggle zen mode */
  onToggleZenMode?: () => void;
}

/**
 * Central keyboard shortcuts management hook
 * Prevents handler duplication across multiple components
 * 
 * @param handlers - Object containing callback functions for each shortcut
 * @param options - Configuration options (e.g. prefersPointerInput for drawer shortcuts)
 */
export const useKeyboardShortcuts = (
  handlers: KeyboardShortcutHandlers,
  options?: KeyboardShortcutOptions
) => {
  const prefersPointerInput = options?.prefersPointerInput ?? false;

  // Destructure handlers to avoid capturing entire object
  const {
    onPlayPause,
    onNext,
    onPrevious,
    onClosePlaylist,
    onToggleVisualEffectsMenu,
    onCloseVisualEffects,
    onToggleBackgroundVisualizer,
    onToggleGlow,
    onToggleHelp,
    onMute,
    onVolumeUp,
    onVolumeDown,
    onToggleLike,
    onCloseMobileMenu,
    onShowPlaylist,
    onOpenLibraryDrawer,
    onToggleZenMode,
  } = handlers;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't intercept keyboard events when typing in input fields
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Check if target is contentEditable
      const target = event.target as HTMLElement;
      if (target && target.isContentEditable) {
        return;
      }

      // Handle different key combinations
      switch (event.code) {
        // Playback controls
        case 'Space':
          event.preventDefault();
          onPlayPause?.();
          break;

        case 'ArrowRight':
          event.preventDefault();
          onNext?.();
          break;

        case 'ArrowLeft':
          event.preventDefault();
          onPrevious?.();
          break;

        // Menu toggles
        case 'KeyV':
          // V toggles background visualizations
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onToggleBackgroundVisualizer?.();
          }
          break;

        case 'KeyO':
          // O toggles visual effects menu
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onToggleVisualEffectsMenu?.();
          }
          break;

        case 'KeyG':
          // G toggles glow effect
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onToggleGlow?.();
          }
          break;

        case 'Slash':
          // / or ? (Shift+/) shows help modal
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onToggleHelp?.();
          }
          break;

        // Close menus
        case 'Escape':
          event.preventDefault();
          onCloseVisualEffects?.();
          onClosePlaylist?.();
          onCloseMobileMenu?.();
          break;

        // Volume controls
        case 'KeyM':
          event.preventDefault();
          onMute?.();
          break;

        case 'KeyL':
          // L toggles like/unlike
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onToggleLike?.();
          }
          break;

        case 'KeyZ':
          // Z toggles zen mode
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onToggleZenMode?.();
          }
          break;

        case 'ArrowUp':
          if (prefersPointerInput && onShowPlaylist) {
            event.preventDefault();
            onShowPlaylist();
          } else if (onVolumeUp) {
            event.preventDefault();
            onVolumeUp();
          }
          break;

        case 'ArrowDown':
          if (prefersPointerInput && onOpenLibraryDrawer) {
            event.preventDefault();
            onOpenLibraryDrawer();
          } else if (onVolumeDown) {
            event.preventDefault();
            onVolumeDown();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    onPlayPause,
    onNext,
    onPrevious,
    onClosePlaylist,
    onToggleVisualEffectsMenu,
    onCloseVisualEffects,
    onToggleBackgroundVisualizer,
    onToggleGlow,
    onToggleHelp,
    onMute,
    onVolumeUp,
    onVolumeDown,
    onToggleLike,
    onCloseMobileMenu,
    onShowPlaylist,
    onOpenLibraryDrawer,
    onToggleZenMode,
    prefersPointerInput,
  ]);
};
