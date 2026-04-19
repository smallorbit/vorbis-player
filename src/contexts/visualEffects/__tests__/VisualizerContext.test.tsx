import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  VisualizerProvider,
  useVisualizer,
} from '@/contexts/visualEffects/VisualizerContext';
import { STORAGE_KEYS } from '@/constants/storage';

function wrapper({ children }: { children: React.ReactNode }) {
  return <VisualizerProvider>{children}</VisualizerProvider>;
}

describe('VisualizerContext', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    vi.mocked(window.localStorage.setItem).mockClear();
  });

  describe('defaults', () => {
    it('exposes default backgroundVisualizerEnabled of true', () => {
      // #when
      const { result } = renderHook(() => useVisualizer(), { wrapper });

      // #then
      expect(result.current.backgroundVisualizerEnabled).toBe(true);
    });

    it('exposes default backgroundVisualizerStyle of fireflies', () => {
      // #when
      const { result } = renderHook(() => useVisualizer(), { wrapper });

      // #then
      expect(result.current.backgroundVisualizerStyle).toBe('fireflies');
    });

    it('exposes default backgroundVisualizerIntensity of 40', () => {
      // #when
      const { result } = renderHook(() => useVisualizer(), { wrapper });

      // #then
      expect(result.current.backgroundVisualizerIntensity).toBe(40);
    });

    it('exposes default backgroundVisualizerSpeed of 1.0', () => {
      // #when
      const { result } = renderHook(() => useVisualizer(), { wrapper });

      // #then
      expect(result.current.backgroundVisualizerSpeed).toBe(1.0);
    });
  });

  describe('setters', () => {
    it('updates backgroundVisualizerStyle and persists to localStorage', () => {
      // #given
      const { result } = renderHook(() => useVisualizer(), { wrapper });

      // #when
      act(() => {
        result.current.setBackgroundVisualizerStyle('wave');
      });

      // #then
      expect(result.current.backgroundVisualizerStyle).toBe('wave');
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BG_VISUALIZER_STYLE,
        '"wave"',
      );
    });

    it('updates backgroundVisualizerIntensity and persists to localStorage', () => {
      // #given
      const { result } = renderHook(() => useVisualizer(), { wrapper });

      // #when
      act(() => {
        result.current.setBackgroundVisualizerIntensity(75);
      });

      // #then
      expect(result.current.backgroundVisualizerIntensity).toBe(75);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BG_VISUALIZER_INTENSITY,
        '75',
      );
    });
  });

  describe('visualizer style migration', () => {
    it("migrates legacy 'particles' to 'fireflies' on mount", () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.BG_VISUALIZER_STYLE) return 'particles';
        return null;
      });

      // #when
      const { result } = renderHook(() => useVisualizer(), { wrapper });

      // #then
      expect(result.current.backgroundVisualizerStyle).toBe('fireflies');
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BG_VISUALIZER_STYLE,
        '"fireflies"',
      );
    });

    it("migrates legacy 'trail' to 'comet' on mount", () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.BG_VISUALIZER_STYLE) return 'trail';
        return null;
      });

      // #when
      const { result } = renderHook(() => useVisualizer(), { wrapper });

      // #then
      expect(result.current.backgroundVisualizerStyle).toBe('comet');
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BG_VISUALIZER_STYLE,
        '"comet"',
      );
    });

    it("migrates legacy 'geometric' to 'fireflies' on mount", () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.BG_VISUALIZER_STYLE) return 'geometric';
        return null;
      });

      // #when
      const { result } = renderHook(() => useVisualizer(), { wrapper });

      // #then
      expect(result.current.backgroundVisualizerStyle).toBe('fireflies');
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BG_VISUALIZER_STYLE,
        '"fireflies"',
      );
    });

    it("leaves a valid 'fireflies' value unchanged", () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.BG_VISUALIZER_STYLE) return '"fireflies"';
        return null;
      });

      // #when
      renderHook(() => useVisualizer(), { wrapper });

      // #then
      const styleSetCalls = vi.mocked(window.localStorage.setItem).mock.calls.filter(
        ([key]) => key === STORAGE_KEYS.BG_VISUALIZER_STYLE,
      );
      expect(styleSetCalls).toHaveLength(0);
    });

    it("leaves a valid 'comet' value unchanged", () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.BG_VISUALIZER_STYLE) return '"comet"';
        return null;
      });

      // #when
      renderHook(() => useVisualizer(), { wrapper });

      // #then
      const styleSetCalls = vi.mocked(window.localStorage.setItem).mock.calls.filter(
        ([key]) => key === STORAGE_KEYS.BG_VISUALIZER_STYLE,
      );
      expect(styleSetCalls).toHaveLength(0);
    });
  });

  describe('guard', () => {
    it('throws when used outside VisualizerProvider', () => {
      // #when / #then
      expect(() => renderHook(() => useVisualizer())).toThrow(
        'useVisualizer must be used within VisualizerProvider',
      );
    });
  });
});
