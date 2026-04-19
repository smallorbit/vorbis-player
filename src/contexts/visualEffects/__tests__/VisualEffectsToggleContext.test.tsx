import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  VisualEffectsToggleProvider,
  useVisualEffectsToggle,
} from '@/contexts/visualEffects/VisualEffectsToggleContext';
import { STORAGE_KEYS } from '@/constants/storage';

function wrapper({ children }: { children: React.ReactNode }) {
  return <VisualEffectsToggleProvider>{children}</VisualEffectsToggleProvider>;
}

describe('VisualEffectsToggleContext', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    vi.mocked(window.localStorage.setItem).mockClear();
    vi.mocked(window.localStorage.removeItem).mockClear();
  });

  describe('defaults', () => {
    it('exposes default visualEffectsEnabled of true', () => {
      // #when
      const { result } = renderHook(() => useVisualEffectsToggle(), { wrapper });

      // #then
      expect(result.current.visualEffectsEnabled).toBe(true);
    });

    it('exposes default showVisualEffects of false', () => {
      // #when
      const { result } = renderHook(() => useVisualEffectsToggle(), { wrapper });

      // #then
      expect(result.current.showVisualEffects).toBe(false);
    });
  });

  describe('setters', () => {
    it('updates visualEffectsEnabled and persists to localStorage', () => {
      // #given
      const { result } = renderHook(() => useVisualEffectsToggle(), { wrapper });

      // #when
      act(() => {
        result.current.setVisualEffectsEnabled(false);
      });

      // #then
      expect(result.current.visualEffectsEnabled).toBe(false);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.VISUAL_EFFECTS_ENABLED,
        'false',
      );
    });

    it('updates showVisualEffects without persisting (UI-only state)', () => {
      // #given
      const { result } = renderHook(() => useVisualEffectsToggle(), { wrapper });

      // #when
      act(() => {
        result.current.setShowVisualEffects(true);
      });

      // #then
      expect(result.current.showVisualEffects).toBe(true);
    });
  });

  describe('guard', () => {
    it('throws when used outside VisualEffectsToggleProvider', () => {
      // #when / #then
      expect(() => renderHook(() => useVisualEffectsToggle())).toThrow(
        'useVisualEffectsToggle must be used within VisualEffectsToggleProvider',
      );
    });
  });
});
