import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useQueueBundlePrefetch } from '../useQueueBundlePrefetch';

describe('useQueueBundlePrefetch', () => {
  let ricMock: ReturnType<typeof vi.fn>;
  let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();

    ricMock = vi.fn().mockImplementation((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });

    Object.defineProperty(window, 'requestIdleCallback', {
      value: ricMock,
      writable: true,
      configurable: true,
    });

    setTimeoutSpy = vi.spyOn(window, 'setTimeout');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('fires once on first play', () => {
    it('schedules prefetch via requestIdleCallback when isPlaying flips false → true', () => {
      // #given
      const { rerender } = renderHook(
        ({ isPlaying }: { isPlaying: boolean }) => useQueueBundlePrefetch(isPlaying),
        { initialProps: { isPlaying: false } },
      );

      // #when
      rerender({ isPlaying: true });

      // #then
      expect(ricMock).toHaveBeenCalledTimes(1);
    });

    it('does not schedule prefetch when initially rendered with isPlaying false', () => {
      // #when
      renderHook(() => useQueueBundlePrefetch(false));

      // #then
      expect(ricMock).not.toHaveBeenCalled();
    });

    it('schedules prefetch immediately when initially rendered with isPlaying true', () => {
      // #when
      renderHook(() => useQueueBundlePrefetch(true));

      // #then
      expect(ricMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('does not re-fire on subsequent toggles', () => {
    it('schedules prefetch only once across multiple play/pause cycles', () => {
      // #given
      const { rerender } = renderHook(
        ({ isPlaying }: { isPlaying: boolean }) => useQueueBundlePrefetch(isPlaying),
        { initialProps: { isPlaying: false } },
      );

      // #when — three play/pause cycles
      rerender({ isPlaying: true });
      rerender({ isPlaying: false });
      rerender({ isPlaying: true });
      rerender({ isPlaying: false });
      rerender({ isPlaying: true });

      // #then
      expect(ricMock).toHaveBeenCalledTimes(1);
    });

    it('does not re-schedule when toggled back to false then true again', () => {
      // #given
      const { rerender } = renderHook(
        ({ isPlaying }: { isPlaying: boolean }) => useQueueBundlePrefetch(isPlaying),
        { initialProps: { isPlaying: true } },
      );

      // #when
      rerender({ isPlaying: false });
      rerender({ isPlaying: true });

      // #then
      expect(ricMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('does not re-fire on track changes', () => {
    it('schedules prefetch only once even when the current track changes while playing', () => {
      // #given
      const { rerender } = renderHook(
        ({ isPlaying, trackId }: { isPlaying: boolean; trackId: string }) =>
          useQueueBundlePrefetch(isPlaying, trackId),
        { initialProps: { isPlaying: true, trackId: 'track-1' } },
      );

      // #when — track advances while still playing
      rerender({ isPlaying: true, trackId: 'track-2' });
      rerender({ isPlaying: true, trackId: 'track-3' });

      // #then
      expect(ricMock).toHaveBeenCalledTimes(1);
    });

    it('does not re-fire when a track change causes a brief isPlaying interruption', () => {
      // #given
      const { rerender } = renderHook(
        ({ isPlaying, trackId }: { isPlaying: boolean; trackId: string }) =>
          useQueueBundlePrefetch(isPlaying, trackId),
        { initialProps: { isPlaying: false, trackId: 'track-1' } },
      );

      rerender({ isPlaying: true, trackId: 'track-1' });

      // #when — new track starts: brief pause then play again
      rerender({ isPlaying: false, trackId: 'track-2' });
      rerender({ isPlaying: true, trackId: 'track-2' });

      // #then — still only one prefetch scheduled
      expect(ricMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('setTimeout fallback', () => {
    it('uses setTimeout when requestIdleCallback is not available', () => {
      // #given
      Object.defineProperty(window, 'requestIdleCallback', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { rerender } = renderHook(
        ({ isPlaying }: { isPlaying: boolean }) => useQueueBundlePrefetch(isPlaying),
        { initialProps: { isPlaying: false } },
      );

      // #when
      rerender({ isPlaying: true });

      // #then
      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(ricMock).not.toHaveBeenCalled();
    });

    it('fires the prefetch callback after the setTimeout delay elapses', () => {
      // #given
      Object.defineProperty(window, 'requestIdleCallback', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { rerender } = renderHook(
        ({ isPlaying }: { isPlaying: boolean }) => useQueueBundlePrefetch(isPlaying),
        { initialProps: { isPlaying: false } },
      );

      // #when
      rerender({ isPlaying: true });
      vi.runAllTimers();

      // #then — no exception thrown means the deferred callback executed successfully
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    });

    it('does not re-schedule via setTimeout on subsequent play/pause toggles', () => {
      // #given
      Object.defineProperty(window, 'requestIdleCallback', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { rerender } = renderHook(
        ({ isPlaying }: { isPlaying: boolean }) => useQueueBundlePrefetch(isPlaying),
        { initialProps: { isPlaying: false } },
      );

      // #when
      rerender({ isPlaying: true });
      vi.runAllTimers();
      rerender({ isPlaying: false });
      rerender({ isPlaying: true });

      // #then
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    });
  });
});
