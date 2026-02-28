import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVerticalSwipeGesture } from '../useVerticalSwipeGesture';

function createNativeTouchEvent(
  type: string,
  x: number,
  y: number
): TouchEvent {
  const touch = { clientX: x, clientY: y, identifier: 0 } as Touch;
  return new TouchEvent(type, {
    touches: type === 'touchend' ? [] : [touch],
    changedTouches: [touch],
    cancelable: true,
  });
}

function simulateSwipe(
  element: HTMLDivElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  durationMs = 200
) {
  const startEvent = createNativeTouchEvent('touchstart', startX, startY);
  element.dispatchEvent(startEvent);

  const moveEvent = createNativeTouchEvent('touchmove', endX, endY);
  element.dispatchEvent(moveEvent);

  vi.advanceTimersByTime(durationMs);

  const endEvent = createNativeTouchEvent('touchend', endX, endY);
  element.dispatchEvent(endEvent);
}

describe('useVerticalSwipeGesture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('swipe down past threshold calls onSwipeDown', () => {
    const onSwipeDown = vi.fn();
    const { result } = renderHook(() =>
      useVerticalSwipeGesture({ onSwipeDown, threshold: 50 })
    );

    // #given - attach element
    const div = document.createElement('div');
    (result.current.ref as React.MutableRefObject<HTMLDivElement>).current = div;
    // Re-render to attach listeners
    const { result: result2 } = renderHook(() =>
      useVerticalSwipeGesture({ onSwipeDown, threshold: 50 })
    );
    (result2.current.ref as React.MutableRefObject<HTMLDivElement>).current = div;

    // Need to trigger effect by re-rendering with element attached
    const onSwipeDown2 = vi.fn();
    const { result: r } = renderHook(() =>
      useVerticalSwipeGesture({ onSwipeDown: onSwipeDown2, threshold: 50 })
    );
    const el = document.createElement('div');
    Object.defineProperty(r.current, 'ref', { value: { current: el } });

    // Direct approach: create a div, attach the hook via ref, and dispatch events
    const onDown = vi.fn();
    const hookDiv = document.createElement('div');
    document.body.appendChild(hookDiv);

    const { rerender } = renderHook(
      ({ opts }) => {
        const hook = useVerticalSwipeGesture(opts);
        (hook.ref as React.MutableRefObject<HTMLDivElement>).current = hookDiv;
        return hook;
      },
      { initialProps: { opts: { onSwipeDown: onDown, threshold: 50 } } }
    );
    // Force effect to run by re-rendering
    rerender({ opts: { onSwipeDown: onDown, threshold: 50 } });

    act(() => {
      simulateSwipe(hookDiv, 100, 100, 100, 200); // 100px down
    });

    expect(onDown).toHaveBeenCalled();
    document.body.removeChild(hookDiv);
  });

  it('swipe up past threshold calls onSwipeUp', () => {
    const onSwipeUp = vi.fn();
    const hookDiv = document.createElement('div');
    document.body.appendChild(hookDiv);

    const { rerender } = renderHook(
      ({ opts }) => {
        const hook = useVerticalSwipeGesture(opts);
        (hook.ref as React.MutableRefObject<HTMLDivElement>).current = hookDiv;
        return hook;
      },
      { initialProps: { opts: { onSwipeUp, threshold: 50 } } }
    );
    rerender({ opts: { onSwipeUp, threshold: 50 } });

    act(() => {
      simulateSwipe(hookDiv, 100, 200, 100, 100); // 100px up
    });

    expect(onSwipeUp).toHaveBeenCalled();
    document.body.removeChild(hookDiv);
  });

  it('horizontal movement locks direction and does NOT trigger callbacks', () => {
    const onSwipeUp = vi.fn();
    const onSwipeDown = vi.fn();
    const hookDiv = document.createElement('div');
    document.body.appendChild(hookDiv);

    const { rerender } = renderHook(
      ({ opts }) => {
        const hook = useVerticalSwipeGesture(opts);
        (hook.ref as React.MutableRefObject<HTMLDivElement>).current = hookDiv;
        return hook;
      },
      { initialProps: { opts: { onSwipeUp, onSwipeDown, threshold: 50 } } }
    );
    rerender({ opts: { onSwipeUp, onSwipeDown, threshold: 50 } });

    act(() => {
      // Move primarily horizontal: 100px right, only 5px down
      simulateSwipe(hookDiv, 100, 100, 200, 105);
    });

    expect(onSwipeUp).not.toHaveBeenCalled();
    expect(onSwipeDown).not.toHaveBeenCalled();
    document.body.removeChild(hookDiv);
  });

  it('short drag below threshold does nothing', () => {
    const onSwipeDown = vi.fn();
    const hookDiv = document.createElement('div');
    document.body.appendChild(hookDiv);

    const { rerender } = renderHook(
      ({ opts }) => {
        const hook = useVerticalSwipeGesture(opts);
        (hook.ref as React.MutableRefObject<HTMLDivElement>).current = hookDiv;
        return hook;
      },
      { initialProps: { opts: { onSwipeDown, threshold: 50 } } }
    );
    rerender({ opts: { onSwipeDown, threshold: 50 } });

    act(() => {
      // Only 20px movement, slow enough to not trigger velocity threshold
      simulateSwipe(hookDiv, 100, 100, 100, 120, 1000);
    });

    expect(onSwipeDown).not.toHaveBeenCalled();
    document.body.removeChild(hookDiv);
  });

  it('fast flick triggers swipe even below distance threshold', () => {
    const onSwipeDown = vi.fn();
    const hookDiv = document.createElement('div');
    document.body.appendChild(hookDiv);

    const { rerender } = renderHook(
      ({ opts }) => {
        const hook = useVerticalSwipeGesture(opts);
        (hook.ref as React.MutableRefObject<HTMLDivElement>).current = hookDiv;
        return hook;
      },
      { initialProps: { opts: { onSwipeDown, threshold: 80, velocityThreshold: 0.3 } } }
    );
    rerender({ opts: { onSwipeDown, threshold: 80, velocityThreshold: 0.3 } });

    act(() => {
      // 30px in 50ms = velocity 0.6 > 0.3 threshold
      simulateSwipe(hookDiv, 100, 100, 100, 130, 50);
    });

    expect(onSwipeDown).toHaveBeenCalled();
    document.body.removeChild(hookDiv);
  });

  it('enabled: false disables handlers', () => {
    const onSwipeDown = vi.fn();
    const hookDiv = document.createElement('div');
    document.body.appendChild(hookDiv);

    const { rerender } = renderHook(
      ({ opts }) => {
        const hook = useVerticalSwipeGesture(opts);
        (hook.ref as React.MutableRefObject<HTMLDivElement>).current = hookDiv;
        return hook;
      },
      { initialProps: { opts: { onSwipeDown, enabled: false } } }
    );
    rerender({ opts: { onSwipeDown, enabled: false } });

    act(() => {
      simulateSwipe(hookDiv, 100, 100, 100, 200);
    });

    expect(onSwipeDown).not.toHaveBeenCalled();
    document.body.removeChild(hookDiv);
  });

  it('returns initial isDragging as false and dragOffset as 0', () => {
    const { result } = renderHook(() => useVerticalSwipeGesture());

    expect(result.current.isDragging).toBe(false);
    expect(result.current.dragOffset).toBe(0);
  });

  it('isDragging becomes true mid-gesture for vertical movement', () => {
    const hookDiv = document.createElement('div');
    document.body.appendChild(hookDiv);

    const { result, rerender } = renderHook(
      ({ opts }) => {
        const hook = useVerticalSwipeGesture(opts);
        (hook.ref as React.MutableRefObject<HTMLDivElement>).current = hookDiv;
        return hook;
      },
      { initialProps: { opts: { threshold: 50 } } }
    );
    rerender({ opts: { threshold: 50 } });

    act(() => {
      hookDiv.dispatchEvent(createNativeTouchEvent('touchstart', 100, 100));
      // Move vertically past the direction lock threshold (10px)
      hookDiv.dispatchEvent(createNativeTouchEvent('touchmove', 100, 150));
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      hookDiv.dispatchEvent(createNativeTouchEvent('touchend', 100, 150));
    });

    document.body.removeChild(hookDiv);
  });

  it('removes event listeners on unmount', () => {
    const hookDiv = document.createElement('div');
    document.body.appendChild(hookDiv);
    const removeListenerSpy = vi.spyOn(hookDiv, 'removeEventListener');

    const { unmount, rerender } = renderHook(
      ({ opts }) => {
        const hook = useVerticalSwipeGesture(opts);
        (hook.ref as React.MutableRefObject<HTMLDivElement>).current = hookDiv;
        return hook;
      },
      { initialProps: { opts: { threshold: 50 } } }
    );
    rerender({ opts: { threshold: 50 } });

    // #when
    unmount();

    // #then
    const removedEvents = removeListenerSpy.mock.calls.map(c => c[0]);
    expect(removedEvents).toContain('touchstart');
    expect(removedEvents).toContain('touchmove');
    expect(removedEvents).toContain('touchend');
    document.body.removeChild(hookDiv);
  });

  it('full touch sequence: touchstart -> touchmove -> touchend triggers swipe', () => {
    const onSwipeDown = vi.fn();
    const onSwipeUp = vi.fn();
    const hookDiv = document.createElement('div');
    document.body.appendChild(hookDiv);

    const { rerender } = renderHook(
      ({ opts }) => {
        const hook = useVerticalSwipeGesture(opts);
        (hook.ref as React.MutableRefObject<HTMLDivElement>).current = hookDiv;
        return hook;
      },
      { initialProps: { opts: { onSwipeDown, onSwipeUp, threshold: 50 } } }
    );
    rerender({ opts: { onSwipeDown, onSwipeUp, threshold: 50 } });

    // #when - performing complete sequence with multiple touchmove events
    act(() => {
      hookDiv.dispatchEvent(createNativeTouchEvent('touchstart', 100, 100));
      hookDiv.dispatchEvent(createNativeTouchEvent('touchmove', 100, 130));
      hookDiv.dispatchEvent(createNativeTouchEvent('touchmove', 100, 170));
      hookDiv.dispatchEvent(createNativeTouchEvent('touchmove', 100, 220));
      hookDiv.dispatchEvent(createNativeTouchEvent('touchend', 100, 220));
    });

    // #then
    expect(onSwipeDown).toHaveBeenCalledTimes(1);
    expect(onSwipeUp).not.toHaveBeenCalled();
    document.body.removeChild(hookDiv);
  });

  it('dragOffset tracks deltaY during gesture', () => {
    const hookDiv = document.createElement('div');
    document.body.appendChild(hookDiv);

    const { result, rerender } = renderHook(
      ({ opts }) => {
        const hook = useVerticalSwipeGesture(opts);
        (hook.ref as React.MutableRefObject<HTMLDivElement>).current = hookDiv;
        return hook;
      },
      { initialProps: { opts: { threshold: 50 } } }
    );
    rerender({ opts: { threshold: 50 } });

    act(() => {
      hookDiv.dispatchEvent(createNativeTouchEvent('touchstart', 100, 100));
      hookDiv.dispatchEvent(createNativeTouchEvent('touchmove', 100, 175));
    });

    expect(result.current.dragOffset).toBe(75);

    act(() => {
      hookDiv.dispatchEvent(createNativeTouchEvent('touchend', 100, 175));
    });

    document.body.removeChild(hookDiv);
  });
});
