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
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({}));
    
    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    addEventListenerSpy.mockRestore();
  });

  it('should remove keydown event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    
    const { unmount } = renderHook(() => useKeyboardShortcuts({}));
    unmount();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  it('should call onPlayPause when Space is pressed', () => {
    const onPlayPause = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({ onPlayPause }));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('Space');
    handler(event);
    
    expect(onPlayPause).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onNext when ArrowRight is pressed', () => {
    const onNext = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({ onNext }));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('ArrowRight');
    handler(event);
    
    expect(onNext).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onPrevious when ArrowLeft is pressed', () => {
    const onPrevious = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({ onPrevious }));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('ArrowLeft');
    handler(event);
    
    expect(onPrevious).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });



  it('should call onMute when KeyM is pressed', () => {
    const onMute = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({ onMute }));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('KeyM');
    handler(event);
    
    expect(onMute).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onTogglePlaylist when KeyP is pressed', () => {
    const onTogglePlaylist = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({ onTogglePlaylist }));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('KeyP');
    handler(event);
    
    expect(onTogglePlaylist).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onToggleGlow when KeyG is pressed', () => {
    const onToggleGlow = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({ onToggleGlow }));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('KeyG');
    handler(event);
    
    expect(onToggleGlow).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onToggleBackgroundVisualizer when KeyV is pressed', () => {
    const onToggleBackgroundVisualizer = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({ onToggleBackgroundVisualizer }));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('KeyV');
    handler(event);
    
    expect(onToggleBackgroundVisualizer).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onToggleVisualEffectsMenu when KeyO is pressed', () => {
    const onToggleVisualEffectsMenu = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({ onToggleVisualEffectsMenu }));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('KeyO');
    handler(event);
    
    expect(onToggleVisualEffectsMenu).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should call onToggleHelp when Slash is pressed', () => {
    const onToggleHelp = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({ onToggleHelp }));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('Slash');
    handler(event);
    
    expect(onToggleHelp).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should not intercept keys when typing in input field', () => {
    const onPlayPause = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({ onPlayPause }));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const input = document.createElement('input');
    const event = createKeyboardEvent('Space', input);
    handler(event);
    
    expect(onPlayPause).not.toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should not intercept keys when typing in textarea', () => {
    const onPlayPause = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({ onPlayPause }));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const textarea = document.createElement('textarea');
    const event = createKeyboardEvent('Space', textarea);
    handler(event);
    
    expect(onPlayPause).not.toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should prevent default behavior for Space key', () => {
    const onPlayPause = vi.fn();
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({ onPlayPause }));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('Space');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    
    handler(event);
    
    expect(preventDefaultSpy).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  it('should not call handler if no callback provided', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts({}));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    const event = createKeyboardEvent('KeyL');
    
    // Should not throw
    expect(() => handler(event)).not.toThrow();
    addEventListenerSpy.mockRestore();
  });
});
