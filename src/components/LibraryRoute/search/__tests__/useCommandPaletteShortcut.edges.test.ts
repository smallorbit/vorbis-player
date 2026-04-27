/**
 * Edge-case tests for useCommandPaletteShortcut beyond builder-1's baseline.
 *
 * Covers:
 *  - listener cleanup on unmount (memory-leak guard)
 *  - re-binds when onOpen identity changes
 *  - skips when target is contenteditable element
 *  - skips when target is TEXTAREA / SELECT
 *  - uppercase 'K' key code path
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCommandPaletteShortcut } from '../useCommandPaletteShortcut';

function fireKeydown(opts: KeyboardEventInit & { target?: HTMLElement } = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...opts });
  if (opts.target) {
    Object.defineProperty(event, 'target', { value: opts.target });
  }
  document.dispatchEvent(event);
  return event;
}

describe('useCommandPaletteShortcut edges', () => {
  afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  });

  it('removes the keydown listener on unmount', () => {
    // #given
    const onOpen = vi.fn();
    const { unmount } = renderHook(() => useCommandPaletteShortcut(onOpen));

    // sanity: listener attached
    fireKeydown({ key: 'k', metaKey: true });
    expect(onOpen).toHaveBeenCalledTimes(1);

    // #when
    unmount();
    fireKeydown({ key: 'k', metaKey: true });

    // #then — no further calls after unmount
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('re-attaches listener when onOpen identity changes (effect dep)', () => {
    // #given
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }: { cb: () => void }) =>
      useCommandPaletteShortcut(cb), { initialProps: { cb: first } });

    fireKeydown({ key: 'k', metaKey: true });
    expect(first).toHaveBeenCalledTimes(1);

    // #when
    rerender({ cb: second });
    fireKeydown({ key: 'k', metaKey: true });

    // #then
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1); // first not re-fired
  });

  it('skips when target is a contenteditable element', () => {
    // #given — jsdom doesn't compute isContentEditable from the attribute, so
    // we override the getter to mirror the real-DOM contract.
    const onOpen = vi.fn();
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', {
      value: true,
      configurable: true,
    });
    document.body.appendChild(editable);
    renderHook(() => useCommandPaletteShortcut(onOpen));

    // #when
    fireKeydown({ key: 'k', metaKey: true, target: editable });

    // #then
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('skips when target is a TEXTAREA', () => {
    // #given
    const onOpen = vi.fn();
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    renderHook(() => useCommandPaletteShortcut(onOpen));

    // #when
    fireKeydown({ key: 'k', metaKey: true, target: textarea });

    // #then
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('skips when target is a SELECT', () => {
    // #given
    const onOpen = vi.fn();
    const select = document.createElement('select');
    document.body.appendChild(select);
    renderHook(() => useCommandPaletteShortcut(onOpen));

    // #when
    fireKeydown({ key: 'k', metaKey: true, target: select });

    // #then
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('fires on uppercase K with Cmd modifier', () => {
    // #given — Shift+Cmd+K still triggers because key === "K"
    const onOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(onOpen));

    // #when
    fireKeydown({ key: 'K', metaKey: true });

    // #then
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
