import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwipeGesture } from '../useSwipeGesture';

// Helper to create a synthetic React TouchEvent-like object
const createTouchEvent = (x: number, y: number, timestamp?: number) => {
  const touch = { clientX: x, clientY: y };
  const event = {
    touches: [touch],
    changedTouches: [touch],
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    timeStamp: timestamp ?? performance.now(),
  } as unknown as React.TouchEvent;
  return event;
};

describe('useSwipeGesture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Mock requestAnimationFrame to execute callback synchronously
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(vi.fn());

    // Mock window.innerWidth for consistent dampening calculations
    Object.defineProperty(window, 'innerWidth', {
      value: 375,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return initial state with gesture handlers', () => {
    const { result } = renderHook(() => useSwipeGesture({}));

    expect(result.current.offsetX).toBe(0);
    expect(result.current.isSwiping).toBe(false);
    expect(result.current.isAnimating).toBe(false);
    expect(result.current.gestureHandlers).toBeDefined();
    expect(typeof result.current.gestureHandlers.onTouchStart).toBe('function');
    expect(typeof result.current.gestureHandlers.onTouchMove).toBe('function');
    expect(typeof result.current.gestureHandlers.onTouchEnd).toBe('function');
  });

  it('tap triggers onTap, not swipe handlers', () => {
    // #given
    const onTap = vi.fn();
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();

    const { result } = renderHook(() =>
      useSwipeGesture({ onTap, onSwipeLeft, onSwipeRight })
    );

    // #when
    act(() => {
      result.current.gestureHandlers.onTouchStart(createTouchEvent(100, 100, 0));
    });

    act(() => {
      vi.advanceTimersByTime(100);
      result.current.gestureHandlers.onTouchEnd(createTouchEvent(102, 102, 100));
    });

    // #then
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('swipe left past threshold triggers onSwipeLeft', () => {
    // #given
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const onTap = vi.fn();

    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeLeft, onSwipeRight, onTap })
    );

    // #when - start, move left -100px, end
    act(() => {
      result.current.gestureHandlers.onTouchStart(createTouchEvent(200, 100, 0));
    });

    act(() => {
      result.current.gestureHandlers.onTouchMove(createTouchEvent(100, 100, 200));
    });

    act(() => {
      vi.advanceTimersByTime(200);
      result.current.gestureHandlers.onTouchEnd(createTouchEvent(100, 100, 200));
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // #then
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('swipe right past threshold triggers onSwipeRight', () => {
    // #given
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const onTap = vi.fn();

    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeLeft, onSwipeRight, onTap })
    );

    // #when - start, move right +100px, end
    act(() => {
      result.current.gestureHandlers.onTouchStart(createTouchEvent(100, 100, 0));
    });

    act(() => {
      result.current.gestureHandlers.onTouchMove(createTouchEvent(200, 100, 200));
    });

    act(() => {
      vi.advanceTimersByTime(200);
      result.current.gestureHandlers.onTouchEnd(createTouchEvent(200, 100, 200));
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // #then
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('fast flick below distance but above velocity threshold triggers swipe', () => {
    // #given
    const onSwipeLeft = vi.fn();

    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeLeft })
    );

    // #when - 30px in 50ms = velocity 0.6 px/ms, exceeds 0.3 threshold
    act(() => {
      result.current.gestureHandlers.onTouchStart(createTouchEvent(200, 100, 0));
    });

    act(() => {
      result.current.gestureHandlers.onTouchMove(createTouchEvent(170, 100, 30));
    });

    act(() => {
      vi.advanceTimersByTime(50);
      result.current.gestureHandlers.onTouchEnd(createTouchEvent(170, 100, 50));
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // #then
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('vertical gesture does not trigger swipe or tap', () => {
    // #given
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const onTap = vi.fn();

    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeLeft, onSwipeRight, onTap })
    );

    // #when - touchstart at (100, 100), move primarily vertically: small deltaX (5px), large deltaY (100px)
    act(() => {
      result.current.gestureHandlers.onTouchStart(createTouchEvent(100, 100, 0));
    });

    act(() => {
      result.current.gestureHandlers.onTouchMove(createTouchEvent(105, 200, 200));
    });

    act(() => {
      vi.advanceTimersByTime(200);
      result.current.gestureHandlers.onTouchEnd(createTouchEvent(105, 200, 200));
    });

    // #then
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('below-threshold horizontal gesture snaps back without triggering swipe', () => {
    // #given
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();

    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeLeft, onSwipeRight })
    );

    // #when - touchstart at (100, 100), move only 20px right (below 50px threshold), end slowly (500ms)
    act(() => {
      result.current.gestureHandlers.onTouchStart(createTouchEvent(100, 100, 0));
    });

    act(() => {
      result.current.gestureHandlers.onTouchMove(createTouchEvent(120, 100, 500));
    });

    act(() => {
      vi.advanceTimersByTime(500);
      result.current.gestureHandlers.onTouchEnd(createTouchEvent(120, 100, 500));
    });

    // #then
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();

    // After animation completes, offsetX should return to 0 (snap back)
    act(() => {
      vi.advanceTimersByTime(300); // default animationDuration
    });

    expect(result.current.offsetX).toBe(0);
  });

  it('enabled: false disables all gesture handling', () => {
    // #given
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const onTap = vi.fn();

    const { result } = renderHook(() =>
      useSwipeGesture(
        { onSwipeLeft, onSwipeRight, onTap },
        { enabled: false }
      )
    );

    // #when - attempt a swipe while disabled
    act(() => {
      result.current.gestureHandlers.onTouchStart(createTouchEvent(200, 100, 0));
    });

    act(() => {
      result.current.gestureHandlers.onTouchMove(createTouchEvent(100, 100, 200));
    });

    act(() => {
      vi.advanceTimersByTime(200);
      result.current.gestureHandlers.onTouchEnd(createTouchEvent(100, 100, 200));
    });

    // #then
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
    expect(result.current.offsetX).toBe(0);
    expect(result.current.isSwiping).toBe(false);
  });

  it('offsetX updates during touchmove with dampening factor', () => {
    // #given
    const { result } = renderHook(() => useSwipeGesture({}));

    // #when - touchstart at (200, 100), move 100px to the left
    act(() => {
      result.current.gestureHandlers.onTouchStart(createTouchEvent(200, 100, 0));
    });

    act(() => {
      result.current.gestureHandlers.onTouchMove(createTouchEvent(100, 100, 100));
    });

    // #then - with dampening factor of 0.8, a -100px move should yield -80px offsetX
    expect(result.current.offsetX).toBe(-80);
    expect(result.current.isSwiping).toBe(true);
  });
});
