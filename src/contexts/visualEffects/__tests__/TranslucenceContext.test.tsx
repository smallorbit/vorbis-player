import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  TranslucenceProvider,
  useTranslucence,
} from '@/contexts/visualEffects/TranslucenceContext';
import { STORAGE_KEYS } from '@/constants/storage';

function wrapper({ children }: { children: React.ReactNode }) {
  return <TranslucenceProvider>{children}</TranslucenceProvider>;
}

describe('TranslucenceContext', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    vi.mocked(window.localStorage.setItem).mockClear();
  });

  describe('defaults', () => {
    it('exposes default translucenceEnabled of true', () => {
      // #when
      const { result } = renderHook(() => useTranslucence(), { wrapper });

      // #then
      expect(result.current.translucenceEnabled).toBe(true);
    });

    it('exposes default translucenceOpacity of 0.8', () => {
      // #when
      const { result } = renderHook(() => useTranslucence(), { wrapper });

      // #then
      expect(result.current.translucenceOpacity).toBe(0.8);
    });
  });

  describe('setters', () => {
    it('updates translucenceEnabled and persists to localStorage', () => {
      // #given
      const { result } = renderHook(() => useTranslucence(), { wrapper });

      // #when
      act(() => {
        result.current.setTranslucenceEnabled(false);
      });

      // #then
      expect(result.current.translucenceEnabled).toBe(false);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.TRANSLUCENCE_ENABLED,
        'false',
      );
    });

    it('updates translucenceOpacity and persists to localStorage', () => {
      // #given
      const { result } = renderHook(() => useTranslucence(), { wrapper });

      // #when
      act(() => {
        result.current.setTranslucenceOpacity(0.5);
      });

      // #then
      expect(result.current.translucenceOpacity).toBe(0.5);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.TRANSLUCENCE_OPACITY,
        '0.5',
      );
    });
  });

  describe('guard', () => {
    it('throws when used outside TranslucenceProvider', () => {
      // #when / #then
      expect(() => renderHook(() => useTranslucence())).toThrow(
        'useTranslucence must be used within TranslucenceProvider',
      );
    });
  });
});
