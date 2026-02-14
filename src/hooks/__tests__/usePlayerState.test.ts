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
    // Clear store and mocks before each test
    store = {};
    vi.clearAllMocks();
    
    // Mock localStorage with a real store that persists during the test
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
      const { result } = renderHook(() => usePlayerState());
      
      expect(result.current.color.overrides).toEqual({});
    });

    it('should load accent color overrides from localStorage on mount', () => {
      const mockOverrides = {
        'album-1': '#ff0000',
        'album-2': '#00ff00'
      };
      store['vorbis-player-accent-color-overrides'] = JSON.stringify(mockOverrides);

      const { result } = renderHook(() => usePlayerState());

      expect(result.current.color.overrides).toEqual(mockOverrides);
      expect(localStorage.getItem).toHaveBeenCalledWith('vorbis-player-accent-color-overrides');
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      store['vorbis-player-accent-color-overrides'] = 'invalid-json';
      
      const { result } = renderHook(() => usePlayerState());
      
      expect(result.current.color.overrides).toEqual({});
    });

    it('should save accent color overrides to localStorage when state changes', () => {
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'vorbis-player-accent-color-overrides',
        JSON.stringify({ 'album-1': '#ff0000' })
      );
    });
  });

  describe('Accent Color Helper Methods', () => {
    it('should set accent color override for an album', () => {
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
      });

      expect(result.current.color.overrides).toEqual({
        'album-1': '#ff0000'
      });
    });

    it('should update existing accent color override for an album', () => {
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
      });

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#00ff00');
      });

      expect(result.current.color.overrides).toEqual({
        'album-1': '#00ff00'
      });
    });

    it('should remove accent color override for an album', () => {
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
      });

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-2', '#00ff00');
      });

      expect(result.current.color.overrides).toHaveProperty('album-1');
      expect(result.current.color.overrides).toHaveProperty('album-2');

      act(() => {
        result.current.actions.color.handleRemoveAccentColorOverride('album-1');
      });

      expect(result.current.color.overrides).not.toHaveProperty('album-1');
      expect(result.current.color.overrides).toHaveProperty('album-2');
      expect(result.current.color.overrides['album-2']).toBe('#00ff00');
    });

    it('should handle removing non-existent override gracefully', () => {
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleRemoveAccentColorOverride('non-existent-album');
      });

      expect(result.current.color.overrides).toEqual({});
    });

    it('should reset accent color override for an album', () => {
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
      });

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-2', '#00ff00');
      });

      expect(result.current.color.overrides).toHaveProperty('album-1');
      expect(result.current.color.overrides).toHaveProperty('album-2');

      act(() => {
        result.current.actions.color.handleResetAccentColorOverride('album-1');
      });

      expect(result.current.color.overrides).not.toHaveProperty('album-1');
      expect(result.current.color.overrides).toHaveProperty('album-2');
      expect(result.current.color.overrides['album-2']).toBe('#00ff00');
    });

    it('should maintain multiple album overrides independently', () => {
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
      });

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-2', '#00ff00');
      });

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-3', '#0000ff');
      });

      expect(result.current.color.overrides['album-1']).toBe('#ff0000');
      expect(result.current.color.overrides['album-2']).toBe('#00ff00');
      expect(result.current.color.overrides['album-3']).toBe('#0000ff');
    });
  });

  describe('localStorage Integration', () => {
    it('should persist overrides across multiple state changes', () => {
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'vorbis-player-accent-color-overrides',
        JSON.stringify({ 'album-1': '#ff0000' })
      );

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-2', '#00ff00');
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'vorbis-player-accent-color-overrides',
        JSON.stringify({ 'album-1': '#ff0000', 'album-2': '#00ff00' })
      );
    });
  });

  describe('Performance and Optimization', () => {
    it('should use useCallback for helper methods', () => {
      const { result } = renderHook(() => usePlayerState());

      const firstRender = result.current.actions.color.handleSetAccentColorOverride;

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '#ff0000');
      });
      
      const secondRender = result.current.actions.color.handleSetAccentColorOverride;
      
      // Functions should be the same reference (memoized)
      expect(firstRender).toBe(secondRender);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string color values', () => {
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-1', '');
      });

      expect(result.current.color.overrides).toEqual({
        'album-1': ''
      });
    });

    it('should handle special characters in album IDs', () => {
      const { result } = renderHook(() => usePlayerState());

      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('album-with-special-chars-!@#$%', '#ff0000');
      });

      expect(result.current.color.overrides).toEqual({
        'album-with-special-chars-!@#$%': '#ff0000'
      });
    });
  });
});
