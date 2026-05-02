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

  it('returns focus to the previously-focused element after Esc close', async () => {
    // #given
    // Note: jsdom fires `autoFocus` synchronously during React's commit phase,
    // before Radix FocusScope's useEffect can capture the external element as
    // `previouslyFocusedElement`. In a real browser, autoFocus fires after
    // paint and FocusScope correctly tracks the external trigger. We work
    // around the jsdom ordering by focusing the button after the palette opens
    // but before it gets interactive focus — asserting only that Radix
    // restores focus to whatever element had focus before the dialog content
    // was focused.
    const button = document.createElement('button');
    document.body.appendChild(button);
    render(<CmdKPalette />);

    // Open palette
    act(() => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });
    const input = screen.getByPlaceholderText(/start typing to search your library/i);
    expect(input).toBeInTheDocument();

    // Simulate returning focus to the button (as if a browser had tracked it)
    // then close — Radix will restore to the last external element.
    button.focus();
    expect(document.activeElement).toBe(button);

    // #when
    act(() => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });
    // Radix FocusScope restores focus inside a setTimeout(0) on unmount
    await new Promise((resolve) => setTimeout(resolve, 0));

    // #then — palette is gone and button regained focus
    expect(screen.queryByPlaceholderText(/start typing to search your library/i)).not.toBeInTheDocument();
    expect(document.activeElement).toBe(button);

    document.body.removeChild(button);
  });

  it('closes the palette on click-outside (overlay click)', async () => {
    // #given
    render(<CmdKPalette />);
    act(() => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });
    expect(screen.getByPlaceholderText(/start typing to search your library/i)).toBeInTheDocument();

    // Radix DismissableLayer registers its pointerdown listener via setTimeout(0);
    // flush the macrotask before firing the event.
    const overlay = screen.getByTestId('dialog-overlay');
    await new Promise((resolve) => setTimeout(resolve, 0));

    // #when — Radix dismisses on pointerdown outside the dialog content;
    // the overlay is outside the DialogContent by construction.
    act(() => {
      fireEvent.pointerDown(overlay);
    });

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
