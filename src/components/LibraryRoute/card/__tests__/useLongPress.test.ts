import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from '../useLongPress';

function makeEvent(overrides: Partial<{ clientX: number; clientY: number }> = {}): React.PointerEvent<HTMLElement> {
  const target = document.createElement('div');
  return {
    clientX: overrides.clientX ?? 0,
    clientY: overrides.clientY ?? 0,
    currentTarget: target,
  } as unknown as React.PointerEvent<HTMLElement>;
}

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onLongPress after 500ms hold without movement', () => {
    // #given
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    // #when
    act(() => {
      result.current.onPointerDown(makeEvent({ clientX: 10, clientY: 10 }));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // #then
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('cancels long-press when pointer moves more than 8px', () => {
    // #given
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    // #when
    act(() => {
      result.current.onPointerDown(makeEvent({ clientX: 0, clientY: 0 }));
      result.current.onPointerMove(makeEvent({ clientX: 20, clientY: 0 }));
      vi.advanceTimersByTime(600);
    });

    // #then
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('fires onTap when pointer up before timer without long-press', () => {
    // #given
    const onLongPress = vi.fn();
    const onTap = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onTap }));

    // #when
    act(() => {
      result.current.onPointerDown(makeEvent({ clientX: 0, clientY: 0 }));
      result.current.onPointerUp(makeEvent());
    });

    // #then
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('suppresses onTap when long-press has fired', () => {
    // #given
    const onLongPress = vi.fn();
    const onTap = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onTap }));

    // #when
    act(() => {
      result.current.onPointerDown(makeEvent({ clientX: 0, clientY: 0 }));
      vi.advanceTimersByTime(500);
      result.current.onPointerUp(makeEvent());
    });

    // #then
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('does not fire when disabled', () => {
    // #given
    const onLongPress = vi.fn();
    const onTap = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onTap, enabled: false }));

    // #when
    act(() => {
      result.current.onPointerDown(makeEvent({ clientX: 0, clientY: 0 }));
      vi.advanceTimersByTime(500);
      result.current.onPointerUp(makeEvent());
    });

    // #then
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('cancels long-press on pointer cancel', () => {
    // #given
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    // #when
    act(() => {
      result.current.onPointerDown(makeEvent());
      result.current.onPointerCancel(makeEvent());
      vi.advanceTimersByTime(600);
    });

    // #then
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
