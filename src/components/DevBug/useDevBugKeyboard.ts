import { useEffect } from 'react';
import { useDevBug } from '@/contexts/DevBugContext';
import type { DevBugMode } from '@/contexts/DevBugContext';

const MODE_KEYS: Record<string, DevBugMode> = {
  '1': 'inspect',
  '2': 'area',
  '3': 'annotate',
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

export function useDevBugKeyboard(
  isFeedbackPanelOpen: boolean,
  hasSelection: boolean,
  onCancelSelection: () => void,
  onCloseFeedbackPanel: () => void,
): void {
  const { isActive, deactivate, setMode } = useDevBug();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (isFeedbackPanelOpen) {
          onCloseFeedbackPanel();
          return;
        }
        if (hasSelection) {
          onCancelSelection();
          return;
        }
        if (isActive) {
          deactivate();
        }
        return;
      }

      if (!isActive) return;

      const mode = MODE_KEYS[e.key];
      if (mode) {
        e.preventDefault();
        setMode(mode);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isFeedbackPanelOpen, hasSelection, deactivate, setMode, onCancelSelection, onCloseFeedbackPanel]);
}
