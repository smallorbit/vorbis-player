import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

interface ModalOverlay<T extends HTMLElement> {
  containerRef: React.RefObject<T>;
  dialogProps: {
    role: 'dialog';
    'aria-modal': true;
    tabIndex: -1;
    onKeyDown: (event: React.KeyboardEvent) => void;
  };
}

/**
 * Dialog semantics for a custom overlay that stays mounted while closed:
 * moves focus in on open, traps Tab inside, restores focus to the opener on
 * close, and marks the container `inert` while closed so it leaves the tab order.
 */
export function useModalOverlay<T extends HTMLElement>(isOpen: boolean): ModalOverlay<T> {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.toggleAttribute('inert', !isOpen);
    if (!isOpen) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initialFocus = getFocusableElements(container)[0] ?? container;
    initialFocus.focus({ preventScroll: true });

    return () => {
      const focusIsInsideOrLost =
        container.contains(document.activeElement) || document.activeElement === document.body;
      if (opener?.isConnected && focusIsInsideOrLost) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const container = containerRef.current;
    if (!container) return;

    const focusables = getFocusableElements(container);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }

    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === container)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  return {
    containerRef,
    dialogProps: { role: 'dialog', 'aria-modal': true, tabIndex: -1, onKeyDown },
  };
}
