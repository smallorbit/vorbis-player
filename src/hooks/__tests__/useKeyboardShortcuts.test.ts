import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

// Helper to create keyboard event with proper target
const createKeyboardEvent = (code: string, target: EventTarget = document.body) => {
  const event = new KeyboardEvent('keydown', { code, bubbles: true });
  Object.defineProperty(event, 'target', { value: target, enumerable: true });
  return event;
};

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

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
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

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
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

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
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

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
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

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('KeyG');

    // #when
    handler(event);

    // #then
    expect(onToggleGlow).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onToggleBackgroundVisualizer when KeyV is pressed', () => {
    // #given
    const onToggleBackgroundVisualizer = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onToggleBackgroundVisualizer }));

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('KeyV');

    // #when
    handler(event);

    // #then
    expect(onToggleBackgroundVisualizer).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onToggleShuffle when KeyS is pressed', () => {
    // #given
    const onToggleShuffle = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts({ onToggleShuffle }));

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
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

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
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

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
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

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
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

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
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

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
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

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('KeyL');

    // #when / #then - should not throw
    expect(() => handler(event)).not.toThrow();
    addEventListenerSpy.mockRestore();
  });
});
