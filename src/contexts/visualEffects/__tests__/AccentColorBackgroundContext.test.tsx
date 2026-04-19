import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  AccentColorBackgroundProvider,
  useAccentColorBackground,
} from '@/contexts/visualEffects/AccentColorBackgroundContext';
import {
  VisualEffectsToggleProvider,
  useVisualEffectsToggle,
} from '@/contexts/visualEffects/VisualEffectsToggleContext';
import { STORAGE_KEYS } from '@/constants/storage';

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <VisualEffectsToggleProvider>
      <AccentColorBackgroundProvider>{children}</AccentColorBackgroundProvider>
    </VisualEffectsToggleProvider>
  );
}

describe('AccentColorBackgroundContext', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    vi.mocked(window.localStorage.setItem).mockClear();
    vi.mocked(window.localStorage.removeItem).mockClear();
  });

  describe('defaults', () => {
    it('exposes default accentColorBackgroundPreferred of false', () => {
      // #when
      const { result } = renderHook(() => useAccentColorBackground(), { wrapper });

      // #then
      expect(result.current.accentColorBackgroundPreferred).toBe(false);
    });

    it('derives accentColorBackgroundEnabled to false when preferred is false', () => {
      // #when
      const { result } = renderHook(() => useAccentColorBackground(), { wrapper });

      // #then
      expect(result.current.accentColorBackgroundEnabled).toBe(false);
    });
  });

  describe('derived accentColorBackgroundEnabled', () => {
    it('derives true when master toggle is on and preferred is true', () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.VISUAL_EFFECTS_ENABLED) return 'true';
        if (key === STORAGE_KEYS.ACCENT_COLOR_BG_PREFERRED) return 'true';
        return null;
      });

      // #when
      const { result } = renderHook(() => useAccentColorBackground(), { wrapper });

      // #then
      expect(result.current.accentColorBackgroundEnabled).toBe(true);
    });

    it('derives false when master toggle is off even if preferred is true', () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.VISUAL_EFFECTS_ENABLED) return 'false';
        if (key === STORAGE_KEYS.ACCENT_COLOR_BG_PREFERRED) return 'true';
        return null;
      });

      // #when
      const { result } = renderHook(() => useAccentColorBackground(), { wrapper });

      // #then
      expect(result.current.accentColorBackgroundEnabled).toBe(false);
    });

    it('flips accentColorBackgroundEnabled when master toggle changes', () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.VISUAL_EFFECTS_ENABLED) return 'true';
        if (key === STORAGE_KEYS.ACCENT_COLOR_BG_PREFERRED) return 'true';
        return null;
      });
      const { result } = renderHook(
        () => ({
          accent: useAccentColorBackground(),
          toggle: useVisualEffectsToggle(),
        }),
        { wrapper },
      );
      expect(result.current.accent.accentColorBackgroundEnabled).toBe(true);

      // #when
      act(() => {
        result.current.toggle.setVisualEffectsEnabled(false);
      });

      // #then
      expect(result.current.accent.accentColorBackgroundEnabled).toBe(false);

      // #when master toggle turns back on
      act(() => {
        result.current.toggle.setVisualEffectsEnabled(true);
      });

      // #then derivation tracks the master toggle without a state/effect cycle
      expect(result.current.accent.accentColorBackgroundEnabled).toBe(true);
    });
  });

  describe('setters', () => {
    it('updates accentColorBackgroundPreferred and persists to localStorage', () => {
      // #given
      const { result } = renderHook(() => useAccentColorBackground(), { wrapper });

      // #when
      act(() => {
        result.current.setAccentColorBackgroundPreferred(true);
      });

      // #then
      expect(result.current.accentColorBackgroundPreferred).toBe(true);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ACCENT_COLOR_BG_PREFERRED,
        'true',
      );
    });
  });

  describe('guard', () => {
    it('throws when used outside AccentColorBackgroundProvider', () => {
      // #when / #then
      expect(() =>
        renderHook(() => useAccentColorBackground(), {
          wrapper: ({ children }) => (
            <VisualEffectsToggleProvider>{children}</VisualEffectsToggleProvider>
          ),
        }),
      ).toThrow('useAccentColorBackground must be used within AccentColorBackgroundProvider');
    });
  });
});
