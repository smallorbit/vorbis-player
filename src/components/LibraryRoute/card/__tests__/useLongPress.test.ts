import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from '../useLongPress';

function makeEvent(
  overrides: Partial<{ clientX: number; clientY: number; pointerType: string; button: number }> = {},
): React.PointerEvent<HTMLElement> {
  const target = document.createElement('div');
  return {
    clientX: overrides.clientX ?? 0,
    clientY: overrides.clientY ?? 0,
    pointerType: overrides.pointerType ?? 'touch',
    button: overrides.button ?? 0,
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

  it('does not invoke onTap on right-click (mouse button 2)', () => {
    // #given
    const onLongPress = vi.fn();
    const onTap = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onTap }));

    // #when
    act(() => {
      result.current.onPointerDown(makeEvent({ pointerType: 'mouse', button: 2 }));
      result.current.onPointerUp(makeEvent({ pointerType: 'mouse', button: 2 }));
    });

    // #then
    expect(onTap).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does not start long-press timer on right-click (mouse button 2)', () => {
    // #given
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    // #when
    act(() => {
      result.current.onPointerDown(makeEvent({ pointerType: 'mouse', button: 2 }));
      vi.advanceTimersByTime(600);
    });

    // #then
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('still fires onTap on primary mouse button (button 0)', () => {
    // #given
    const onLongPress = vi.fn();
    const onTap = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onTap }));

    // #when
    act(() => {
      result.current.onPointerDown(makeEvent({ pointerType: 'mouse', button: 0 }));
      result.current.onPointerUp(makeEvent({ pointerType: 'mouse', button: 0 }));
    });

    // #then
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('still fires onTap on touch (pointerType touch, button 0)', () => {
    // #given
    const onLongPress = vi.fn();
    const onTap = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onTap }));

    // #when
    act(() => {
      result.current.onPointerDown(makeEvent({ pointerType: 'touch', button: 0 }));
      result.current.onPointerUp(makeEvent({ pointerType: 'touch', button: 0 }));
    });

    // #then
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('ignores secondary-button pointerup during an active primary-button long-press', () => {
    // #given
    const onLongPress = vi.fn();
    const onTap = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onTap }));

    // #when — start a primary-button long-press
    act(() => {
      result.current.onPointerDown(makeEvent({ pointerType: 'mouse', button: 0 }));
    });
    // stray right-button pointerup fires before the primary button is released
    act(() => {
      result.current.onPointerUp(makeEvent({ pointerType: 'mouse', button: 2 }));
    });

    // #then — secondary-button release must not abort the long-press or fire onTap
    expect(onTap).not.toHaveBeenCalled();

    // primary button released — long-press window still intact, tap fires
    act(() => {
      result.current.onPointerUp(makeEvent({ pointerType: 'mouse', button: 0 }));
    });
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
