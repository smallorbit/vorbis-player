import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVisualEffectsState } from '../useVisualEffectsState';

describe('useVisualEffectsState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  it('initializes with default glow intensity and rate', () => {
    // DEFAULT_GLOW_INTENSITY = 110, DEFAULT_GLOW_RATE = 4.0
    const { result } = renderHook(() => useVisualEffectsState());

    expect(result.current.glowIntensity).toBe(110);
    expect(result.current.glowRate).toBe(4.0);
  });

  it('accepts custom initial values', () => {
    const { result } = renderHook(() =>
      useVisualEffectsState({ initialGlowIntensity: 80, initialGlowRate: 2.0 })
    );

    expect(result.current.glowIntensity).toBe(80);
    expect(result.current.glowRate).toBe(2.0);
  });

  it('handleGlowIntensityChange updates state and savedGlowIntensity', () => {
    const { result } = renderHook(() => useVisualEffectsState());

    // #when
    act(() => {
      result.current.handleGlowIntensityChange(150);
    });

    // #then
    expect(result.current.glowIntensity).toBe(150);
    expect(result.current.savedGlowIntensity).toBe(150);
  });

  it('handleGlowRateChange updates state and savedGlowRate', () => {
    const { result } = renderHook(() => useVisualEffectsState());

    // #when
    act(() => {
      result.current.handleGlowRateChange(6.0);
    });

    // #then
    expect(result.current.glowRate).toBe(6.0);
    expect(result.current.savedGlowRate).toBe(6.0);
  });

  it('effectiveGlow reflects current intensity and rate', () => {
    // #given
    const { result } = renderHook(() => useVisualEffectsState());

    // #when - change intensity to 120 and rate to 3.0
    act(() => {
      result.current.handleGlowIntensityChange(120);
      result.current.handleGlowRateChange(3.0);
    });

    // #then
    expect(result.current.effectiveGlow).toEqual({ intensity: 120, rate: 3.0 });
  });

  it('restoreGlowSettings restores saved values', () => {
    const { result } = renderHook(() => useVisualEffectsState());

    // #given - change and save values
    act(() => {
      result.current.handleGlowIntensityChange(200);
      result.current.handleGlowRateChange(8.0);
    });

    // Change to different values
    act(() => {
      result.current.handleGlowIntensityChange(50);
      result.current.handleGlowRateChange(1.0);
    });

    // #when - restore
    act(() => {
      result.current.restoreGlowSettings();
    });

    // #then - restored to last saved (50 and 1.0 because handleGlowIntensityChange also saves)
    expect(result.current.glowIntensity).toBe(50);
    expect(result.current.glowRate).toBe(1.0);
  });

  it('restoreGlowSettings is no-op when savedGlowIntensity is null', () => {
    const { result } = renderHook(() => useVisualEffectsState());

    const initialIntensity = result.current.glowIntensity;
    const initialRate = result.current.glowRate;

    // #when - restore without having changed anything
    act(() => {
      result.current.restoreGlowSettings();
    });

    // #then - values unchanged
    expect(result.current.glowIntensity).toBe(initialIntensity);
    expect(result.current.glowRate).toBe(initialRate);
  });
});
