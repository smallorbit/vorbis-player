import { useEffect } from 'react';

interface KeyboardShortcutOptions {
  /** When true, ArrowUp/ArrowDown open drawers (set when user has pointer input, not touch-only) */
  prefersPointerInput?: boolean;
}

interface KeyboardShortcutHandlers {
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onCloseQueue?: () => void;
  onToggleVisualEffectsMenu?: () => void;
  onCloseVisualEffects?: () => void;
  onCycleVisualizerStyle?: () => void;
  onToggleGlow?: () => void;
  onToggleTranslucence?: () => void;
  onToggleHelp?: () => void;
  onMute?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onToggleLike?: () => void;
  onToggleShuffle?: () => void;
  onCloseMobileMenu?: () => void;
  /** Open queue drawer (desktop: ArrowUp) */
  onShowQueue?: () => void;
  /** Open library drawer (desktop: ArrowDown) */
  onOpenLibrary?: () => void;
  /** Open quick access panel (desktop: ArrowDown / L) */
  onOpenQuickAccessPanel?: () => void;
  /** Toggle zen mode */
  onToggleZenMode?: () => void;
}

export const useKeyboardShortcuts = (
  handlers: KeyboardShortcutHandlers,
  options?: KeyboardShortcutOptions
) => {
  const prefersPointerInput = options?.prefersPointerInput ?? false;

  const {
    onPlayPause,
    onNext,
    onPrevious,
    onCloseQueue,
    onToggleVisualEffectsMenu,
    onCloseVisualEffects,
    onCycleVisualizerStyle,
    onToggleGlow,
    onToggleTranslucence,
    onToggleHelp,
    onMute,
    onVolumeUp,
    onVolumeDown,
    onToggleLike,
    onToggleShuffle,
    onCloseMobileMenu,
    onShowQueue,
    onOpenLibrary,
    onOpenQuickAccessPanel,
    onToggleZenMode,
  } = handlers;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't fire shortcuts when user is typing in an input field.
      // Use composedPath() to detect inputs inside Shadow DOM boundaries (e.g., DevBug panel).
      const target = (event.composedPath?.()?.[0] || event.target) as HTMLElement | null;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }

      switch (event.code) {
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

        case 'KeyV':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onCycleVisualizerStyle?.();
          }
          break;

        case 'KeyS':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            if (event.shiftKey) {
              onToggleVisualEffectsMenu?.();
            } else {
              onToggleShuffle?.();
            }
          }
          break;

        case 'KeyG':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onToggleGlow?.();
          }
          break;

        case 'KeyT':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onToggleTranslucence?.();
          }
          break;

        case 'Slash':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onToggleHelp?.();
          }
          break;

        case 'Escape':
          event.preventDefault();
          onCloseVisualEffects?.();
          onCloseQueue?.();
          onCloseMobileMenu?.();
          break;

        case 'KeyM':
          event.preventDefault();
          onMute?.();
          break;

        case 'KeyL':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onOpenQuickAccessPanel?.();
          }
          break;

        case 'KeyK':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onToggleLike?.();
          }
          break;

        case 'KeyQ':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onShowQueue?.();
          }
          break;

        case 'KeyZ':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onToggleZenMode?.();
          }
          break;

        case 'ArrowUp':
          if (prefersPointerInput && onShowQueue) {
            event.preventDefault();
            onShowQueue();
          } else if (onVolumeUp) {
            event.preventDefault();
            onVolumeUp();
          }
          break;

        case 'ArrowDown':
          if (prefersPointerInput && onOpenQuickAccessPanel) {
            event.preventDefault();
            onOpenQuickAccessPanel();
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
    onCloseQueue,
    onToggleVisualEffectsMenu,
    onCloseVisualEffects,
    onCycleVisualizerStyle,
    onToggleGlow,
    onToggleTranslucence,
    onToggleHelp,
    onMute,
    onVolumeUp,
    onVolumeDown,
    onToggleLike,
    onToggleShuffle,
    onCloseMobileMenu,
    onShowQueue,
    onOpenLibrary,
    onOpenQuickAccessPanel,
    onToggleZenMode,
    prefersPointerInput,
  ]);
};
