import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { usePlayerState } from '../usePlayerState';

// Mock the theme module
vi.mock('../../styles/theme', () => ({
  theme: {
    colors: {
      accent: '#ff6b6b'
    }
  }
}));

describe('usePlayerState - Accent Color Management', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.clearAllMocks();

    localStorage.getItem.mockImplementation((key) => store[key] || null);
    localStorage.setItem.mockImplementation((key, value) => {
      store[key] = value;
    });
    localStorage.removeItem.mockImplementation((key) => {
      delete store[key];
    });
    localStorage.clear.mockImplementation(() => {
      store = {};
    });
  });

  afterEach(() => {
    store = {};
    vi.clearAllMocks();
  });

  describe('Accent Color Overrides State Management', () => {
    it('should initialize with empty accent color overrides', () => {
      // #when
      const { result } = renderHook(() => usePlayerState());

      // #then
      expect(result.current.color.overrides).toEqual({});
    });

    it('should load accent color overrides from localStorage on mount', () => {
      // #given
      const mockOverrides = {
        'album-1': '#ff0000',
        'album-2': '#00ff00'
      };
      store['vorbis-player-accent-color-overrides'] = JSON.stringify(mockOverrides);

      // #when
      const { result } = renderHook(() => usePlayerState());

      // #then
      expect(result.current.color.overrides).toEqual(mockOverrides);
      expect(localStorage.getItem).toHaveBeenCalledWith('vorbis-player-accent-color-overrides');
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      // #given
      store['vorbis-player-accent-color-overrides'] = 'invalid-json';

      // #when
      const { result } = renderHook(() => usePlayerState());

      // #then
      expect(result.current.color.overrides).toEqual({});
    });

    it('should save accent color overrides to localStorage when state changes', () => {
      // #when
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
      });

      // #then
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'vorbis-player-accent-color-overrides',
        JSON.stringify({ 'album-1': '#ff0000' })
      );
    });
  });

  describe('Accent Color Helper Methods', () => {
    it('should set accent color override for an album', () => {
      // #when
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
      });

      // #then
      expect(result.current.color.overrides).toEqual({
        'album-1': '#ff0000'
      });
    });

    it('should update existing accent color override for an album', () => {
      // #given
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
      });

      // #when
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#00ff00');
      });

      // #then
      expect(result.current.color.overrides).toEqual({
        'album-1': '#00ff00'
      });
    });

    it('should remove accent color override for an album via handleRemoveAccentColorOverride and handleResetAccentColorOverride', () => {
      // #given
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
        result.current.actions.color.handleSetAccentColorOverride('album-2', '#00ff00');
        result.current.actions.color.handleSetAccentColorOverride('album-3', '#0000ff');
      });

      expect(result.current.color.overrides).toHaveProperty('album-1');
      expect(result.current.color.overrides).toHaveProperty('album-2');
      expect(result.current.color.overrides).toHaveProperty('album-3');

      // #when — handleRemoveAccentColorOverride removes album-1
      act(() => {
        result.current.actions.color.handleRemoveAccentColorOverride('album-1');
      });

      // #then
      expect(result.current.color.overrides).not.toHaveProperty('album-1');
      expect(result.current.color.overrides).toHaveProperty('album-2');
      expect(result.current.color.overrides).toHaveProperty('album-3');

      // #when — handleResetAccentColorOverride (alias) removes album-2
      act(() => {
        result.current.actions.color.handleResetAccentColorOverride('album-2');
      });

      // #then
      expect(result.current.color.overrides).not.toHaveProperty('album-2');
      expect(result.current.color.overrides).toHaveProperty('album-3');
      expect(result.current.color.overrides['album-3']).toBe('#0000ff');
    });

    it('should handle removing non-existent override gracefully', () => {
      // #given
      const { result } = renderHook(() => usePlayerState());

      // #when
      act(() => {
        result.current.actions.color.handleRemoveAccentColorOverride('non-existent-album');
      });

      // #then
      expect(result.current.color.overrides).toEqual({});
    });

    it('should maintain multiple album overrides independently', () => {
      // #when
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
        result.current.actions.color.handleSetAccentColorOverride('album-2', '#00ff00');
        result.current.actions.color.handleSetAccentColorOverride('album-3', '#0000ff');
      });

      // #then
      expect(result.current.color.overrides['album-1']).toBe('#ff0000');
      expect(result.current.color.overrides['album-2']).toBe('#00ff00');
      expect(result.current.color.overrides['album-3']).toBe('#0000ff');
    });

    it('should use useCallback for helper methods', () => {
      // #given
      const { result } = renderHook(() => usePlayerState());
      const firstRender = result.current.actions.color.handleSetAccentColorOverride;

      // #when
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
      });

      const secondRender = result.current.actions.color.handleSetAccentColorOverride;

      // #then
      expect(firstRender).toBe(secondRender);
    });
  });

  describe('localStorage Integration', () => {
    it('should persist overrides across multiple state changes', () => {
      // #when
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
      });

      // #then
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'vorbis-player-accent-color-overrides',
        JSON.stringify({ 'album-1': '#ff0000' })
      );

      // #when
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-2', '#00ff00');
      });

      // #then
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'vorbis-player-accent-color-overrides',
        JSON.stringify({ 'album-1': '#ff0000', 'album-2': '#00ff00' })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string color values', () => {
      // #when
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '');
      });

      // #then
      expect(result.current.color.overrides).toEqual({
        'album-1': ''
      });
    });

    it('should handle special characters in album IDs', () => {
      // #when
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-with-special-chars-!@#$%', '#ff0000');
      });

      // #then
      expect(result.current.color.overrides).toEqual({
        'album-with-special-chars-!@#$%': '#ff0000'
      });
    });
  });
});
