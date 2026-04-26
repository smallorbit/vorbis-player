import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSetWelcomeSeen = vi.fn();

vi.mock('@/hooks/useWelcomeSeen', () => ({
  useWelcomeSeen: vi.fn(() => [false, mockSetWelcomeSeen]),
}));

import { useOnboardingV2 } from '../useOnboardingV2';

const STORAGE_KEY = 'vorbis-player-onboarding-v2-step';

describe('useOnboardingV2', () => {
  beforeEach(() => {
    mockSetWelcomeSeen.mockClear();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  describe('initial state (totalSteps=3)', () => {
    it('starts at step 0 with isFirst=true and isLast=false', () => {
      // #given — no persisted step in localStorage

      // #when
      const { result } = renderHook(() => useOnboardingV2(3));

      // #then
      expect(result.current.step).toBe(0);
      expect(result.current.isFirst).toBe(true);
      expect(result.current.isLast).toBe(false);
    });
  });

  describe('navigation', () => {
    it('next() advances step by 1', () => {
      // #given
      const { result } = renderHook(() => useOnboardingV2(3));
      expect(result.current.step).toBe(0);

      // #when
      act(() => { result.current.next(); });

      // #then
      expect(result.current.step).toBe(1);
    });

    it('back() retreats step by 1', () => {
      // #given
      const { result } = renderHook(() => useOnboardingV2(3));
      act(() => { result.current.next(); });
      expect(result.current.step).toBe(1);

      // #when
      act(() => { result.current.back(); });

      // #then
      expect(result.current.step).toBe(0);
    });

    it('next() is a no-op when already on the last step', () => {
      // #given — start at last step (index 2 of 3)
      vi.mocked(window.localStorage.getItem).mockImplementation((key) =>
        key === STORAGE_KEY ? JSON.stringify(2) : null,
      );
      const { result } = renderHook(() => useOnboardingV2(3));
      expect(result.current.step).toBe(2);

      // #when
      act(() => { result.current.next(); });

      // #then — step unchanged
      expect(result.current.step).toBe(2);
    });

    it('back() is a no-op when already on the first step', () => {
      // #given
      const { result } = renderHook(() => useOnboardingV2(3));
      expect(result.current.step).toBe(0);

      // #when
      act(() => { result.current.back(); });

      // #then
      expect(result.current.step).toBe(0);
    });
  });

  describe('isLast flag', () => {
    it('is true when step === totalSteps - 1', () => {
      // #given — persist step 2 for a 3-step flow
      vi.mocked(window.localStorage.getItem).mockImplementation((key) =>
        key === STORAGE_KEY ? JSON.stringify(2) : null,
      );

      // #when
      const { result } = renderHook(() => useOnboardingV2(3));

      // #then
      expect(result.current.isLast).toBe(true);
    });

    it('is false when step < totalSteps - 1', () => {
      // #given
      const { result } = renderHook(() => useOnboardingV2(3));

      // #then
      expect(result.current.isLast).toBe(false);
    });
  });

  describe('complete()', () => {
    it('calls setWelcomeSeen(true) exactly once', () => {
      // #given
      const { result } = renderHook(() => useOnboardingV2(3));

      // #when
      act(() => { result.current.complete(); });

      // #then
      expect(mockSetWelcomeSeen).toHaveBeenCalledTimes(1);
      expect(mockSetWelcomeSeen).toHaveBeenCalledWith(true);
    });

    it('resets the persisted step back to 0', () => {
      // #given — advance to step 2 first
      vi.mocked(window.localStorage.getItem).mockImplementation((key) =>
        key === STORAGE_KEY ? JSON.stringify(2) : null,
      );
      const { result } = renderHook(() => useOnboardingV2(3));

      // #when
      act(() => { result.current.complete(); });

      // #then — localStorage.setItem called with 0 for the onboarding key
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(0),
      );
    });
  });

  describe('skipAll()', () => {
    it('calls setWelcomeSeen(true) exactly once', () => {
      // #given
      const { result } = renderHook(() => useOnboardingV2(3));

      // #when
      act(() => { result.current.skipAll(); });

      // #then
      expect(mockSetWelcomeSeen).toHaveBeenCalledTimes(1);
      expect(mockSetWelcomeSeen).toHaveBeenCalledWith(true);
    });

    it('resets the persisted step back to 0', () => {
      // #given — advance to step 1 first
      vi.mocked(window.localStorage.getItem).mockImplementation((key) =>
        key === STORAGE_KEY ? JSON.stringify(1) : null,
      );
      const { result } = renderHook(() => useOnboardingV2(3));

      // #when
      act(() => { result.current.skipAll(); });

      // #then
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(0),
      );
    });

    it('is distinct from complete() — each only fires its own invocation', () => {
      // #given — two separate hook instances
      const { result: r1 } = renderHook(() => useOnboardingV2(3));
      const { result: r2 } = renderHook(() => useOnboardingV2(3));

      // #when
      act(() => { r1.current.complete(); });
      act(() => { r2.current.skipAll(); });

      // #then — two total calls, one per invocation
      expect(mockSetWelcomeSeen).toHaveBeenCalledTimes(2);
    });
  });

  describe('step clamping', () => {
    it('clamps persisted step to totalSteps-1 when the total is reduced', () => {
      // #given — step 2 was persisted but only 2 steps now exist (indices 0–1)
      vi.mocked(window.localStorage.getItem).mockImplementation((key) =>
        key === STORAGE_KEY ? JSON.stringify(2) : null,
      );

      // #when
      const { result } = renderHook(() => useOnboardingV2(2));

      // #then — clamped to index 1
      expect(result.current.step).toBe(1);
    });
  });
});
