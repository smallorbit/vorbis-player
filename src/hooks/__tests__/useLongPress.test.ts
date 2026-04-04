import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from '../useLongPress';

const createPointerEvent = (x: number, y: number): React.PointerEvent => ({
  clientX: x,
  clientY: y,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
} as unknown as React.PointerEvent);

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onLongPress after 500ms', () => {
    // #given
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    // #when
    act(() => {
      result.current.onPointerDown(createPointerEvent(100, 100));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // #then
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onLongPress if pointer is released before 500ms', () => {
    // #given
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    // #when
    act(() => {
      result.current.onPointerDown(createPointerEvent(100, 100));
    });
    act(() => {
      vi.advanceTimersByTime(300);
      result.current.onPointerUp(createPointerEvent(100, 100));
    });

    // #then
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('calls onShortPress on short tap', () => {
    // #given
    const onLongPress = vi.fn();
    const onShortPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onShortPress }));

    // #when
    act(() => {
      result.current.onPointerDown(createPointerEvent(100, 100));
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.onPointerUp(createPointerEvent(100, 100));
    });

    // #then
    expect(onShortPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels long-press when pointer moves beyond threshold', () => {
    // #given
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    // #when
    act(() => {
      result.current.onPointerDown(createPointerEvent(100, 100));
    });
    act(() => {
      result.current.onPointerMove(createPointerEvent(115, 100));
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // #then
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does not cancel long-press on small pointer movement within threshold', () => {
    // #given
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    // #when
    act(() => {
      result.current.onPointerDown(createPointerEvent(100, 100));
    });
    act(() => {
      result.current.onPointerMove(createPointerEvent(105, 102));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // #then
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('cancels long-press on pointer cancel', () => {
    // #given
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    // #when
    act(() => {
      result.current.onPointerDown(createPointerEvent(100, 100));
    });
    act(() => {
      result.current.onPointerCancel(createPointerEvent(100, 100));
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // #then
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does nothing when enabled is false', () => {
    // #given
    const onLongPress = vi.fn();
    const onShortPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ onLongPress, onShortPress, enabled: false })
    );

    // #when
    act(() => {
      result.current.onPointerDown(createPointerEvent(100, 100));
    });
    act(() => {
      vi.advanceTimersByTime(600);
      result.current.onPointerUp(createPointerEvent(100, 100));
    });

    // #then
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onShortPress).not.toHaveBeenCalled();
  });
});
