/**
 * Hook for managing visual effects keyboard shortcuts
 * Ctrl+V: Toggle effects
 * Ctrl+E: Close effects menu
 * Ctrl+R: Reset filters
 */
import { useEffect } from 'react';

interface VisualEffectsShortcutHandlers {
  onToggleEffects?: () => void;
  onCloseMenu?: () => void;
  onResetFilters?: () => void;
}

export const useVisualEffectsShortcuts = (handlers: VisualEffectsShortcutHandlers) => {
  useEffect(() => {
    const onToggleEffects = handlers.onToggleEffects;
    const onCloseMenu = handlers.onCloseMenu;
    const onResetFilters = handlers.onResetFilters;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;

      switch (event.code) {
        case 'KeyV':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onToggleEffects?.();
          }
          break;
        case 'KeyE':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onCloseMenu?.();
          }
          break;
        case 'KeyR':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onResetFilters?.();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlers.onToggleEffects, handlers.onCloseMenu, handlers.onResetFilters]);
};
