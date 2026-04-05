import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useZenTouchGestures } from '../useZenTouchGestures';

const DOUBLE_TAP_THRESHOLD_MS = 300;
const LONG_PRESS_DURATION_MS = 500;
const MOVE_CANCEL_THRESHOLD = 10;

const createPointerEvent = (clientX = 100, clientY = 100): React.PointerEvent => ({
  clientX,
  clientY,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
} as unknown as React.PointerEvent);

const defaultOptions = () => ({
  enabled: true,
  isPlaying: false,
  onPlay: vi.fn(),
  onPause: vi.fn(),
  onLikeToggle: vi.fn(),
  onFlipToggle: vi.fn(),
});

describe('useZenTouchGestures', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns the four pointer event handlers', () => {
    // #when
    const { result } = renderHook(() => useZenTouchGestures(defaultOptions()));

    // #then
    expect(typeof result.current.onPointerDown).toBe('function');
    expect(typeof result.current.onPointerUp).toBe('function');
    expect(typeof result.current.onPointerCancel).toBe('function');
    expect(typeof result.current.onPointerMove).toBe('function');
  });

  describe('single tap → play/pause', () => {
    it('calls onPlay when track is paused and single tap completes', () => {
      // #given
      const opts = { ...defaultOptions(), isPlaying: false };
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when - tap down then up
      act(() => {
        result.current.onPointerDown(createPointerEvent());
      });
      act(() => {
        result.current.onPointerUp(createPointerEvent());
      });

      // advance past double-tap window — single tap timer fires
      act(() => {
        vi.advanceTimersByTime(DOUBLE_TAP_THRESHOLD_MS + 10);
      });

      // #then
      expect(opts.onPlay).toHaveBeenCalledTimes(1);
      expect(opts.onPause).not.toHaveBeenCalled();
    });

    it('calls onPause when track is playing and single tap completes', () => {
      // #given
      const opts = { ...defaultOptions(), isPlaying: true };
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when
      act(() => {
        result.current.onPointerDown(createPointerEvent());
      });
      act(() => {
        result.current.onPointerUp(createPointerEvent());
      });
      act(() => {
        vi.advanceTimersByTime(DOUBLE_TAP_THRESHOLD_MS + 10);
      });

      // #then
      expect(opts.onPause).toHaveBeenCalledTimes(1);
      expect(opts.onPlay).not.toHaveBeenCalled();
    });

    it('does not call onPlay or onPause before the double-tap window expires', () => {
      // #given
      const opts = defaultOptions();
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when - tap but do not advance time
      act(() => {
        result.current.onPointerDown(createPointerEvent());
      });
      act(() => {
        result.current.onPointerUp(createPointerEvent());
      });

      // #then - timer hasn't fired yet
      expect(opts.onPlay).not.toHaveBeenCalled();
      expect(opts.onPause).not.toHaveBeenCalled();
    });
  });

  describe('double tap → like toggle', () => {
    it('calls onLikeToggle when two taps arrive within the threshold', () => {
      // #given
      const opts = defaultOptions();
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when - first tap
      act(() => {
        result.current.onPointerDown(createPointerEvent());
        result.current.onPointerUp(createPointerEvent());
      });

      // advance less than DOUBLE_TAP_THRESHOLD_MS so it still counts as double tap
      act(() => {
        vi.advanceTimersByTime(DOUBLE_TAP_THRESHOLD_MS - 50);
      });

      // second tap
      act(() => {
        result.current.onPointerDown(createPointerEvent());
        result.current.onPointerUp(createPointerEvent());
      });

      // #then
      expect(opts.onLikeToggle).toHaveBeenCalledTimes(1);
      expect(opts.onPlay).not.toHaveBeenCalled();
      expect(opts.onPause).not.toHaveBeenCalled();
    });

    it('does not call onLikeToggle when taps are too far apart', () => {
      // #given
      const opts = defaultOptions();
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when - first tap
      act(() => {
        result.current.onPointerDown(createPointerEvent());
        result.current.onPointerUp(createPointerEvent());
      });

      // let the first single-tap timer fully expire
      act(() => {
        vi.advanceTimersByTime(DOUBLE_TAP_THRESHOLD_MS + 50);
      });

      // second tap (now treated as a new first tap)
      act(() => {
        result.current.onPointerDown(createPointerEvent());
        result.current.onPointerUp(createPointerEvent());
      });
      act(() => {
        vi.advanceTimersByTime(DOUBLE_TAP_THRESHOLD_MS + 10);
      });

      // #then - two separate single taps, not a double tap
      expect(opts.onLikeToggle).not.toHaveBeenCalled();
      expect(opts.onPlay).toHaveBeenCalledTimes(2);
    });
  });

  describe('long press → flip toggle', () => {
    it('calls onFlipToggle when pointer is held for the long-press duration', () => {
      // #given
      const opts = defaultOptions();
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when - press and hold
      act(() => {
        result.current.onPointerDown(createPointerEvent());
      });
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
      });

      // #then
      expect(opts.onFlipToggle).toHaveBeenCalledTimes(1);
    });

    it('does not call onFlipToggle if pointer is released before long-press duration', () => {
      // #given
      const opts = defaultOptions();
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when - press and release quickly
      act(() => {
        result.current.onPointerDown(createPointerEvent());
      });
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_DURATION_MS - 100);
        result.current.onPointerUp(createPointerEvent());
      });

      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
      });

      // #then
      expect(opts.onFlipToggle).not.toHaveBeenCalled();
    });

    it('does not trigger a single tap after long press fires', () => {
      // #given
      const opts = defaultOptions();
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when - full long press then release
      act(() => {
        result.current.onPointerDown(createPointerEvent());
      });
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
      });
      act(() => {
        result.current.onPointerUp(createPointerEvent());
      });
      act(() => {
        vi.advanceTimersByTime(DOUBLE_TAP_THRESHOLD_MS + 10);
      });

      // #then - only flip fired, no play/pause
      expect(opts.onFlipToggle).toHaveBeenCalledTimes(1);
      expect(opts.onPlay).not.toHaveBeenCalled();
      expect(opts.onPause).not.toHaveBeenCalled();
    });
  });

  describe('pointer move cancels long press', () => {
    it('cancels long press when pointer moves beyond the threshold', () => {
      // #given
      const opts = defaultOptions();
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when - press down, then move beyond MOVE_CANCEL_THRESHOLD
      act(() => {
        result.current.onPointerDown(createPointerEvent(100, 100));
      });
      act(() => {
        result.current.onPointerMove(createPointerEvent(100 + MOVE_CANCEL_THRESHOLD + 1, 100));
      });
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
      });

      // #then - long press timer was cancelled, flip never fires
      expect(opts.onFlipToggle).not.toHaveBeenCalled();
    });

    it('does not cancel long press when movement is within threshold', () => {
      // #given
      const opts = defaultOptions();
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when - press down, move within threshold
      act(() => {
        result.current.onPointerDown(createPointerEvent(100, 100));
      });
      act(() => {
        result.current.onPointerMove(createPointerEvent(100 + MOVE_CANCEL_THRESHOLD - 1, 100));
      });
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
      });

      // #then - long press still fires
      expect(opts.onFlipToggle).toHaveBeenCalledTimes(1);
    });

    it('cancels long press when vertical movement exceeds threshold', () => {
      // #given
      const opts = defaultOptions();
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when
      act(() => {
        result.current.onPointerDown(createPointerEvent(100, 100));
      });
      act(() => {
        result.current.onPointerMove(createPointerEvent(100, 100 + MOVE_CANCEL_THRESHOLD + 5));
      });
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
      });

      // #then
      expect(opts.onFlipToggle).not.toHaveBeenCalled();
    });
  });

  describe('pointer cancel', () => {
    it('cancels all pending timers on pointer cancel', () => {
      // #given
      const opts = defaultOptions();
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when - start a long press then cancel it
      act(() => {
        result.current.onPointerDown(createPointerEvent());
      });
      act(() => {
        result.current.onPointerCancel(createPointerEvent());
      });
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_DURATION_MS + DOUBLE_TAP_THRESHOLD_MS);
      });

      // #then - nothing fires
      expect(opts.onFlipToggle).not.toHaveBeenCalled();
      expect(opts.onPlay).not.toHaveBeenCalled();
      expect(opts.onPause).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('ignores pointer down when disabled', () => {
      // #given
      const opts = { ...defaultOptions(), enabled: false };
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when
      act(() => {
        result.current.onPointerDown(createPointerEvent());
      });
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
      });

      // #then
      expect(opts.onFlipToggle).not.toHaveBeenCalled();
    });

    it('ignores pointer up when disabled', () => {
      // #given
      const opts = { ...defaultOptions(), enabled: false };
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when - simulate down/up (down is ignored so up should also be a no-op)
      act(() => {
        result.current.onPointerDown(createPointerEvent());
        result.current.onPointerUp(createPointerEvent());
      });
      act(() => {
        vi.advanceTimersByTime(DOUBLE_TAP_THRESHOLD_MS + 10);
      });

      // #then
      expect(opts.onPlay).not.toHaveBeenCalled();
      expect(opts.onPause).not.toHaveBeenCalled();
      expect(opts.onLikeToggle).not.toHaveBeenCalled();
    });

    it('ignores pointer move when disabled', () => {
      // #given - enable for down, then simulate disabled move (move guard does nothing)
      const opts = { ...defaultOptions(), enabled: false };
      const { result } = renderHook(() => useZenTouchGestures(opts));

      // #when - move far; since down was already ignored, no timer to cancel
      act(() => {
        result.current.onPointerMove(createPointerEvent(200, 200));
      });

      // #then - no side effects
      expect(opts.onFlipToggle).not.toHaveBeenCalled();
    });
  });
});
