import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import { defined } from '@/test/defined';

// Helper to create keyboard event with proper target
const createKeyboardEvent = (code: string, target: EventTarget = document.body) => {
  const event = new KeyboardEvent('keydown', { code, bubbles: true });
  Object.defineProperty(event, 'target', { value: target, enumerable: true });
  return event;
};

function getKeydownHandler(spy: { mock: { calls: unknown[][] } }): (event: Event) => void {
  const listener = defined(defined(spy.mock.calls[0])[1]);
  if (typeof listener !== 'function') {
    throw new Error('expected function keydown listener');
  }
  return (event: Event) => {
    listener(event);
  };
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register keydown event listener on mount', () => {
    // #when
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({}));

    // #then
    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    addEventListenerSpy.mockRestore();
  });

  it('should remove keydown event listener on unmount', () => {
    // #given
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    // #when
    const { unmount } = renderHook(() => useKeyboardShortcuts({}));
    unmount();

    // #then
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  it('should call onPlayPause when Space is pressed', () => {
    // #given
    const onPlayPause = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onPlayPause }));

    const handler = getKeydownHandler(addEventListenerSpy);
    const event = createKeyboardEvent('Space');

    // #when
    handler(event);

    // #then
    expect(onPlayPause).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onNext when ArrowRight is pressed', () => {
    // #given
    const onNext = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onNext }));

    const handler = getKeydownHandler(addEventListenerSpy);
    const event = createKeyboardEvent('ArrowRight');

    // #when
    handler(event);

    // #then
    expect(onNext).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onPrevious when ArrowLeft is pressed', () => {
    // #given
    const onPrevious = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onPrevious }));

    const handler = getKeydownHandler(addEventListenerSpy);
    const event = createKeyboardEvent('ArrowLeft');

    // #when
    handler(event);

    // #then
    expect(onPrevious).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });



  it('should call onMute when KeyM is pressed', () => {
    // #given
    const onMute = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onMute }));

    const handler = getKeydownHandler(addEventListenerSpy);
    const event = createKeyboardEvent('KeyM');

    // #when
    handler(event);

    // #then
    expect(onMute).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onToggleGlow when KeyG is pressed', () => {
    // #given
    const onToggleGlow = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onToggleGlow }));

    const handler = getKeydownHandler(addEventListenerSpy);
    const event = createKeyboardEvent('KeyG');

    // #when
    handler(event);

    // #then
    expect(onToggleGlow).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onCycleVisualizerStyle when KeyV is pressed', () => {
    // #given
    const onCycleVisualizerStyle = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onCycleVisualizerStyle }));

    const handler = getKeydownHandler(addEventListenerSpy);
    const event = createKeyboardEvent('KeyV');

    // #when
    handler(event);

    // #then
    expect(onCycleVisualizerStyle).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onToggleShuffle when KeyS is pressed', () => {
    // #given
    const onToggleShuffle = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onToggleShuffle }));

    const handler = getKeydownHandler(addEventListenerSpy);
    const event = new KeyboardEvent('keydown', { code: 'KeyS', bubbles: true });
    Object.defineProperty(event, 'target', { value: document.body, enumerable: true });

    // #when
    handler(event);

    // #then
    expect(onToggleShuffle).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onToggleVisualEffectsMenu when Shift+S is pressed', () => {
    // #given
    const onToggleVisualEffectsMenu = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onToggleVisualEffectsMenu }));

    const handler = getKeydownHandler(addEventListenerSpy);
    const event = new KeyboardEvent('keydown', { code: 'KeyS', shiftKey: true, bubbles: true });
    Object.defineProperty(event, 'target', { value: document.body, enumerable: true });

    // #when
    handler(event);

    // #then
    expect(onToggleVisualEffectsMenu).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onToggleHelp when Slash is pressed', () => {
    // #given
    const onToggleHelp = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onToggleHelp }));

    const handler = getKeydownHandler(addEventListenerSpy);
    const event = createKeyboardEvent('Slash');

    // #when
    handler(event);

    // #then
    expect(onToggleHelp).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should not intercept keys when typing in input field', () => {
    // #given
    const onPlayPause = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onPlayPause }));

    const handler = getKeydownHandler(addEventListenerSpy);
    const input = document.createElement('input');
    const event = createKeyboardEvent('Space', input);

    // #when
    handler(event);

    // #then
    expect(onPlayPause).not.toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should not intercept keys when typing in textarea', () => {
    // #given
    const onPlayPause = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onPlayPause }));

    const handler = getKeydownHandler(addEventListenerSpy);
    const textarea = document.createElement('textarea');
    const event = createKeyboardEvent('Space', textarea);

    // #when
    handler(event);

    // #then
    expect(onPlayPause).not.toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should prevent default behavior for Space key', () => {
    // #given
    const onPlayPause = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onPlayPause }));

    const handler = getKeydownHandler(addEventListenerSpy);
    const event = createKeyboardEvent('Space');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    // #when
    handler(event);

    // #then
    expect(preventDefaultSpy).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should not call handler if no callback provided', () => {
    // #given
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({}));

    const handler = getKeydownHandler(addEventListenerSpy);
    const event = createKeyboardEvent('KeyL');

    // #when / #then - should not throw
    expect(() => handler(event)).not.toThrow();
    addEventListenerSpy.mockRestore();
  });

  describe('focused interactive controls (#1726)', () => {
    function dispatchKeyFrom(element: HTMLElement, code: string) {
      document.body.appendChild(element);
      element.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
      element.remove();
    }

    it('does not toggle playback when Space is pressed on a focused button', () => {
      // #given
      const onPlayPause = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onPlayPause }));

      // #when
      dispatchKeyFrom(document.createElement('button'), 'Space');

      // #then
      expect(onPlayPause).not.toHaveBeenCalled();
    });

    it('does not skip tracks when arrows are pressed on a focused slider', () => {
      // #given
      const onNext = vi.fn();
      const onPrevious = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onNext, onPrevious }));
      const slider = document.createElement('div');
      slider.setAttribute('role', 'slider');

      // #when
      dispatchKeyFrom(slider, 'ArrowRight');
      dispatchKeyFrom(slider, 'ArrowLeft');

      // #then
      expect(onNext).not.toHaveBeenCalled();
      expect(onPrevious).not.toHaveBeenCalled();
    });

    it('exempts keys pressed on content nested inside a role=button element', () => {
      // #given
      const onPlayPause = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onPlayPause }));
      const row = document.createElement('div');
      row.setAttribute('role', 'button');
      const label = document.createElement('span');
      row.appendChild(label);
      document.body.appendChild(row);

      // #when
      label.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
      row.remove();

      // #then
      expect(onPlayPause).not.toHaveBeenCalled();
    });

    it('still fires letter shortcuts from a focused button', () => {
      // #given
      const onMute = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onMute }));

      // #when
      dispatchKeyFrom(document.createElement('button'), 'KeyM');

      // #then
      expect(onMute).toHaveBeenCalledTimes(1);
    });

    it('still closes overlays on Escape from a focused button', () => {
      // #given
      const onCloseQueue = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onCloseQueue }));

      // #when
      dispatchKeyFrom(document.createElement('button'), 'Escape');

      // #then
      expect(onCloseQueue).toHaveBeenCalledTimes(1);
    });

    it('ignores events a focused control already handled', () => {
      // #given
      const onPlayPause = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onPlayPause }));
      const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
      event.preventDefault();

      // #when
      document.body.dispatchEvent(event);

      // #then
      expect(onPlayPause).not.toHaveBeenCalled();
    });

    it('still toggles playback on Space when nothing interactive is focused', () => {
      // #given
      const onPlayPause = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onPlayPause }));

      // #when
      document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));

      // #then
      expect(onPlayPause).toHaveBeenCalledTimes(1);
    });
  });
});
