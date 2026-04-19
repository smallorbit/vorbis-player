import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ZenModeProvider, useZenMode } from '@/contexts/visualEffects/ZenModeContext';
import { STORAGE_KEYS } from '@/constants/storage';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ZenModeProvider>{children}</ZenModeProvider>;
}

describe('ZenModeContext', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    vi.mocked(window.localStorage.setItem).mockClear();
  });

  describe('defaults', () => {
    it('exposes default zenModeEnabled of false', () => {
      // #when
      const { result } = renderHook(() => useZenMode(), { wrapper });

      // #then
      expect(result.current.zenModeEnabled).toBe(false);
    });
  });

  describe('setters', () => {
    it('updates zenModeEnabled and persists to localStorage', () => {
      // #given
      const { result } = renderHook(() => useZenMode(), { wrapper });

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

  describe('guard', () => {
    it('throws when used outside ZenModeProvider', () => {
      // #when / #then
      expect(() => renderHook(() => useZenMode())).toThrow(
        'useZenMode must be used within ZenModeProvider',
      );
    });
  });
});
