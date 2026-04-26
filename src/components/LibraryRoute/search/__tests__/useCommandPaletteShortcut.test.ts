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

describe('useCommandPaletteShortcut', () => {
  afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  });

  it('fires onOpen on Cmd+K', () => {
    // #given
    const onOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(onOpen));

    // #when
    fireKeydown({ key: 'k', metaKey: true });

    // #then
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('fires onOpen on Ctrl+K', () => {
    // #given
    const onOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(onOpen));

    // #when
    fireKeydown({ key: 'k', ctrlKey: true });

    // #then
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('does not fire on plain K', () => {
    // #given
    const onOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(onOpen));

    // #when
    fireKeydown({ key: 'k' });

    // #then
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('skips when active element is an input', () => {
    // #given
    const onOpen = vi.fn();
    const input = document.createElement('input');
    document.body.appendChild(input);
    renderHook(() => useCommandPaletteShortcut(onOpen));

    // #when
    fireKeydown({ key: 'k', metaKey: true, target: input });

    // #then
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not fire when enabled=false', () => {
    // #given
    const onOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(onOpen, false));

    // #when
    fireKeydown({ key: 'k', metaKey: true });

    // #then
    expect(onOpen).not.toHaveBeenCalled();
  });
});
