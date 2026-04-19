import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { GlowProvider, useGlow } from '@/contexts/visualEffects/GlowContext';
import { STORAGE_KEYS } from '@/constants/storage';

function wrapper({ children }: { children: React.ReactNode }) {
  return <GlowProvider>{children}</GlowProvider>;
}

describe('GlowContext', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    vi.mocked(window.localStorage.setItem).mockClear();
  });

  describe('defaults', () => {
    it('exposes default perAlbumGlow of an empty record', () => {
      // #when
      const { result } = renderHook(() => useGlow(), { wrapper });

      // #then
      expect(result.current.perAlbumGlow).toEqual({});
    });
  });

  describe('setters', () => {
    it('updates perAlbumGlow and persists to localStorage', () => {
      // #given
      const { result } = renderHook(() => useGlow(), { wrapper });
      const nextValue = { 'album-1': { intensity: 50, rate: 2 } };

      // #when
      act(() => {
        result.current.setPerAlbumGlow(nextValue);
      });

      // #then
      expect(result.current.perAlbumGlow).toEqual(nextValue);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.PER_ALBUM_GLOW,
        JSON.stringify(nextValue),
      );
    });
  });

  describe('guard', () => {
    it('throws when used outside GlowProvider', () => {
      // #when / #then
      expect(() => renderHook(() => useGlow())).toThrow(
        'useGlow must be used within GlowProvider',
      );
    });
  });
});
