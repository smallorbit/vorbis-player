/**
  * Centralized keyboard shortcuts hook for the player
  * Consolidates all keyboard event handling in one place
  * 
  * Supported shortcuts:
  * - Space: Play/Pause
  * - ArrowRight: Next track
  * - ArrowLeft: Previous track
  * - P: Toggle playlist
  * - V: Toggle background visualizations
  * - O: Toggle visual effects menu
  * - G: Toggle glow effect
  * - ?: Show keyboard shortcuts help
  * - Escape: Close menus (playlist drawer and visual effects)
  * - M: Mute (placeholder)
  * - ArrowUp: Volume up (placeholder)
  * - ArrowDown: Volume down (placeholder)
  * - D: Toggle debug mode
  */

import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  // Playback controls
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  
  // Menu toggles
  onTogglePlaylist?: () => void;
  onClosePlaylist?: () => void;
  onToggleVisualEffectsMenu?: () => void;
  onCloseVisualEffects?: () => void;
  
  // Background visualizer
  onToggleBackgroundVisualizer?: () => void;
  
  // Glow effect
  onToggleGlow?: () => void;
  
  // Help
  onToggleHelp?: () => void;
  
  // Debug/monitoring
  onToggleDebugMode?: () => void;
  
  // Other
  onMute?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
}

interface UseKeyboardShortcutsOptions {
  enableDebugMode?: boolean;
}

/**
 * Central keyboard shortcuts management hook
 * Prevents handler duplication across multiple components
 * 
 * @param handlers - Object containing callback functions for each shortcut
 * @param options - Configuration options
 */
export const useKeyboardShortcuts = (
  handlers: KeyboardShortcutHandlers,
  options: UseKeyboardShortcutsOptions = {}
) => {
  // Destructure handlers to avoid capturing entire object
  const {
    onPlayPause,
    onNext,
    onPrevious,
    onTogglePlaylist,
    onClosePlaylist,
    onToggleVisualEffectsMenu,
    onCloseVisualEffects,
    onToggleBackgroundVisualizer,
    onToggleGlow,
    onToggleHelp,
    onToggleDebugMode,
    onMute,
    onVolumeUp,
    onVolumeDown,
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
        case 'KeyP':
          if (!event.ctrlKey && !event.shiftKey && !event.metaKey) {
            event.preventDefault();
            onTogglePlaylist?.();
          }
          break;

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
          break;

        // Volume controls
        case 'KeyM':
          event.preventDefault();
          onMute?.();
          break;

        case 'ArrowUp':
          // Prevent default only if we have a handler
          if (onVolumeUp) {
            event.preventDefault();
            onVolumeUp();
          }
          break;

        case 'ArrowDown':
          // Prevent default only if we have a handler
          if (onVolumeDown) {
            event.preventDefault();
            onVolumeDown();
          }
          break;

        // Debug mode
        case 'KeyD':
          if (options.enableDebugMode) {
            event.preventDefault();
            onToggleDebugMode?.();
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
    onTogglePlaylist,
    onClosePlaylist,
    onToggleVisualEffectsMenu,
    onCloseVisualEffects,
    onToggleBackgroundVisualizer,
    onToggleGlow,
    onToggleHelp,
    onToggleDebugMode,
    onMute,
    onVolumeUp,
    onVolumeDown,
    options.enableDebugMode,
  ]);
};
