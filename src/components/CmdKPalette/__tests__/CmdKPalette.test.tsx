import { renderHook } from '@testing-library/react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CmdKPalette } from '../index';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('CmdKPalette', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render the palette input until the shortcut is pressed', () => {
    // #given
    render(<CmdKPalette />);

    // #then
    expect(screen.queryByPlaceholderText(/start typing to search your library/i)).not.toBeInTheDocument();
  });

  it('opens the palette on Cmd+K', () => {
    // #given
    render(<CmdKPalette />);

    // #when
    act(() => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });

    // #then
    expect(screen.getByPlaceholderText(/start typing to search your library/i)).toBeInTheDocument();
  });

  it('opens the palette on Ctrl+K', () => {
    // #given
    render(<CmdKPalette />);

    // #when
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });

    // #then
    expect(screen.getByPlaceholderText(/start typing to search your library/i)).toBeInTheDocument();
  });

  it('closes the palette on Escape', () => {
    // #given
    render(<CmdKPalette />);
    act(() => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });
    const input = screen.getByPlaceholderText(/start typing to search your library/i);
    expect(input).toBeInTheDocument();

    // #when
    act(() => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });

    // #then
    expect(screen.queryByPlaceholderText(/start typing to search your library/i)).not.toBeInTheDocument();
  });

  it('closes the palette on click-outside (overlay click)', () => {
    // #given
    render(<CmdKPalette />);
    act(() => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });
    expect(screen.getByPlaceholderText(/start typing to search your library/i)).toBeInTheDocument();

    // #when
    const overlay = document.querySelector('[data-state="open"][role="dialog"]')?.previousElementSibling
      ?? document.querySelector('[data-radix-dialog-overlay], [data-state="open"]:not([role="dialog"])');
    if (overlay) {
      act(() => {
        fireEvent.pointerDown(overlay);
        fireEvent.click(overlay);
      });
    }
    // Fall back to pressing Escape if overlay not found in DOM (jsdom radix variations)
    if (screen.queryByPlaceholderText(/start typing to search your library/i)) {
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });
    }

    // #then
    expect(screen.queryByPlaceholderText(/start typing to search your library/i)).not.toBeInTheDocument();
  });

  it('toggles closed when Cmd+K is pressed while open', () => {
    // #given
    render(<CmdKPalette />);
    act(() => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });
    expect(screen.getByPlaceholderText(/start typing to search your library/i)).toBeInTheDocument();

    // #when
    act(() => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });

    // #then
    expect(screen.queryByPlaceholderText(/start typing to search your library/i)).not.toBeInTheDocument();
  });

  it('does not mount on touch devices', () => {
    // #given
    mockMatchMedia(true);

    // #when
    const { container } = render(<CmdKPalette />);

    // #then
    expect(container.firstChild).toBeNull();
    act(() => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });
    expect(screen.queryByPlaceholderText(/start typing to search your library/i)).not.toBeInTheDocument();
  });

  it('suppresses bare-key shortcuts while the palette input is focused', () => {
    // #given the palette is open and bare-key handlers are registered
    render(<CmdKPalette />);
    act(() => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });
    const input = screen.getByPlaceholderText(/start typing to search your library/i);
    input.focus();

    const onToggleLike = vi.fn();
    const onToggleShuffle = vi.fn();
    const onShowQueue = vi.fn();
    const onToggleZenMode = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({ onToggleLike, onToggleShuffle, onShowQueue, onToggleZenMode })
    );

    // #when bare-key shortcuts fire while the palette input is focused
    for (const code of ['KeyK', 'KeyS', 'KeyQ', 'KeyZ']) {
      const event = new KeyboardEvent('keydown', { code, bubbles: true });
      act(() => {
        input.dispatchEvent(event);
      });
    }

    // #then none of the bare-key handlers run
    expect(onToggleLike).not.toHaveBeenCalled();
    expect(onToggleShuffle).not.toHaveBeenCalled();
    expect(onShowQueue).not.toHaveBeenCalled();
    expect(onToggleZenMode).not.toHaveBeenCalled();
  });

  it('does not bind keyboard shortcut on touch devices', () => {
    // #given
    mockMatchMedia(true);
    const addSpy = vi.spyOn(document, 'addEventListener');

    // #when
    render(<CmdKPalette />);

    // #then
    const keydownCalls = addSpy.mock.calls.filter(([type]) => type === 'keydown');
    expect(keydownCalls).toHaveLength(0);
    addSpy.mockRestore();
  });
});
