import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { VisualEffectsProvider, useVisualEffectsContext } from '@/contexts/VisualEffectsContext';
import { STORAGE_KEYS } from '@/constants/storage';

vi.mock('@/contexts/ProfilingContext', () => ({
  isProfilingEnabled: () => false,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <VisualEffectsProvider>{children}</VisualEffectsProvider>;
}

describe('VisualEffectsContext', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    vi.mocked(window.localStorage.removeItem).mockClear();
    vi.mocked(window.localStorage.setItem).mockClear();
  });

  describe('visualizer style migration', () => {
    it("migrates 'particles' to 'fireflies' on mount", () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.BG_VISUALIZER_STYLE) return 'particles';
        return null;
      });

      // #when
      renderHook(() => useVisualEffectsContext(), { wrapper });

      // #then
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BG_VISUALIZER_STYLE,
        'fireflies',
      );
    });

    it("migrates 'trail' to 'comet' on mount", () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.BG_VISUALIZER_STYLE) return 'trail';
        return null;
      });

      // #when
      renderHook(() => useVisualEffectsContext(), { wrapper });

      // #then
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BG_VISUALIZER_STYLE,
        'comet',
      );
    });

    it("migrates 'geometric' to 'fireflies' on mount", () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.BG_VISUALIZER_STYLE) return 'geometric';
        return null;
      });

      // #when
      renderHook(() => useVisualEffectsContext(), { wrapper });

      // #then
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BG_VISUALIZER_STYLE,
        'fireflies',
      );
    });

    it("leaves a valid style unchanged — 'fireflies' is not remapped", () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.BG_VISUALIZER_STYLE) return '"fireflies"';
        return null;
      });

      // #when
      renderHook(() => useVisualEffectsContext(), { wrapper });

      // #then — setItem should only have been called for ALBUM_FILTERS removal, not for BG_VISUALIZER_STYLE
      const styleSetCalls = vi.mocked(window.localStorage.setItem).mock.calls.filter(
        ([key]) => key === STORAGE_KEYS.BG_VISUALIZER_STYLE,
      );
      expect(styleSetCalls).toHaveLength(0);
    });

    it("leaves a valid style unchanged — 'comet' is not remapped", () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.BG_VISUALIZER_STYLE) return '"comet"';
        return null;
      });

      // #when
      renderHook(() => useVisualEffectsContext(), { wrapper });

      // #then
      const styleSetCalls = vi.mocked(window.localStorage.setItem).mock.calls.filter(
        ([key]) => key === STORAGE_KEYS.BG_VISUALIZER_STYLE,
      );
      expect(styleSetCalls).toHaveLength(0);
    });
  });

  describe('context defaults', () => {
    it('exposes default backgroundVisualizerStyle of fireflies when no value is stored', () => {
      // #when
      const { result } = renderHook(() => useVisualEffectsContext(), { wrapper });

      // #then
      expect(result.current.backgroundVisualizerStyle).toBe('fireflies');
    });

    it('exposes default visualEffectsEnabled of true', () => {
      // #when
      const { result } = renderHook(() => useVisualEffectsContext(), { wrapper });

      // #then
      expect(result.current.visualEffectsEnabled).toBe(true);
    });

    it('disables accentColorBackgroundEnabled when visualEffectsEnabled is false', () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.VISUAL_EFFECTS_ENABLED) return 'false';
        if (key === STORAGE_KEYS.ACCENT_COLOR_BG_PREFERRED) return 'true';
        return null;
      });

      // #when
      const { result } = renderHook(() => useVisualEffectsContext(), { wrapper });

      // #then
      expect(result.current.accentColorBackgroundEnabled).toBe(false);
    });

    it('sets accentColorBackgroundEnabled based on preference when visual effects are on', () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.VISUAL_EFFECTS_ENABLED) return 'true';
        if (key === STORAGE_KEYS.ACCENT_COLOR_BG_PREFERRED) return 'true';
        return null;
      });

      // #when
      const { result } = renderHook(() => useVisualEffectsContext(), { wrapper });

      // #then
      expect(result.current.accentColorBackgroundEnabled).toBe(true);
    });
  });

  describe('setters', () => {
    it('updates backgroundVisualizerStyle and persists to localStorage', () => {
      // #given
      const { result } = renderHook(() => useVisualEffectsContext(), { wrapper });

      // #when
      act(() => {
        result.current.setBackgroundVisualizerStyle('wave');
      });

      // #then
      expect(result.current.backgroundVisualizerStyle).toBe('wave');
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BG_VISUALIZER_STYLE,
        expect.stringContaining('wave'),
      );
    });

    it('updates zenModeEnabled and persists to localStorage', () => {
      // #given
      const { result } = renderHook(() => useVisualEffectsContext(), { wrapper });

      // #when
      act(() => {
        result.current.setZenModeEnabled(true);
      });

      // #then
      expect(result.current.zenModeEnabled).toBe(true);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ZEN_MODE_ENABLED,
        'true',
      );
    });
  });

  describe('useVisualEffectsContext guard', () => {
    it('throws when used outside VisualEffectsProvider', () => {
      // #when / #then
      expect(() => renderHook(() => useVisualEffectsContext())).toThrow(
        'useVisualEffectsContext must be used within VisualEffectsProvider',
      );
    });
  });
});
