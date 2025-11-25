/**
 * Centralized keyboard shortcuts hook for the player
 * Consolidates all keyboard event handling in one place
 * 
 * Supported shortcuts:
 * - Space: Play/Pause
 * - ArrowRight: Next track
 * - ArrowLeft: Previous track
 * - P: Toggle playlist
 * - V: Toggle visual effects menu
 * - Ctrl+V: Toggle visual effects (visual effects container compatibility)
 * - Ctrl+E: Close visual effects menu
 * - Ctrl+R: Reset filters
 * - Escape: Close menus
 * - M: Mute (placeholder)
 * - ArrowUp: Volume up (placeholder)
 * - ArrowDown: Volume down (placeholder)
 * - D: Toggle debug mode
 * - Ctrl+Shift+P: Toggle performance monitor visibility
 */

import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  // Playback controls
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  
  // Menu toggles
  onTogglePlaylist?: () => void;
  onToggleVisualEffects?: () => void;
  
  // Visual effects menu
  onCloseVisualEffects?: () => void;
  onResetFilters?: () => void;
  
  // Debug/monitoring
  onToggleDebugMode?: () => void;
  onTogglePerformanceMonitor?: () => void;
  
  // Other
  onMute?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
}

interface UseKeyboardShortcutsOptions {
  enableDebugMode?: boolean;
  enablePerformanceMonitor?: boolean;
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
    onToggleVisualEffects,
    onCloseVisualEffects,
    onResetFilters,
    onToggleDebugMode,
    onTogglePerformanceMonitor,
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
      if (target.isContentEditable) {
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
          // Check if this is for performance monitor (Ctrl+Shift+P) first
          if (event.ctrlKey && event.shiftKey && options.enablePerformanceMonitor) {
            event.preventDefault();
            onTogglePerformanceMonitor?.();
          } else if (!event.ctrlKey && !event.shiftKey) {
            // Regular P for playlist toggle
            event.preventDefault();
            onTogglePlaylist?.();
          }
          break;

        case 'KeyV':
          // Handle both plain V and Ctrl+V
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onToggleVisualEffects?.();
          } else if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onToggleVisualEffects?.();
          }
          break;

        // Visual effects menu
        case 'KeyE':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onCloseVisualEffects?.();
          }
          break;

        case 'KeyR':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onResetFilters?.();
          }
          break;

        // Close menus
        case 'Escape':
          event.preventDefault();
          onCloseVisualEffects?.();
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
    onToggleVisualEffects,
    onCloseVisualEffects,
    onResetFilters,
    onToggleDebugMode,
    onTogglePerformanceMonitor,
    onMute,
    onVolumeUp,
    onVolumeDown,
    options.enableDebugMode,
    options.enablePerformanceMonitor,
  ]);
};
