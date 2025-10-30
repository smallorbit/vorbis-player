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
  beforeEach(() => {
    // Clear localStorage mock before each test
    vi.clearAllMocks();
    localStorage.getItem.mockClear();
    localStorage.setItem.mockClear();
    localStorage.removeItem.mockClear();
    
    // Mock localStorage.getItem to return null by default for all keys
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'accentColorOverrides') return null;
      if (key === 'vorbis-player-visual-effects-enabled') return null;
      if (key === 'vorbis-player-per-album-glow') return null;
      if (key === 'vorbis-player-album-filters') return null;
      return null;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Accent Color Overrides State Management', () => {
    it('should initialize with empty accent color overrides', () => {
      const { result } = renderHook(() => usePlayerState());
      
      expect(result.current.color.overrides).toEqual({});
    });

    it('should load accent color overrides from localStorage on mount', () => {
      const mockOverrides = {
        'track-1': '#ff0000',
        'track-2': '#00ff00'
      };
      localStorage.getItem.mockImplementation((key) => {
        if (key === 'accentColorOverrides') return JSON.stringify(mockOverrides);
        return null;
      });
      
      const { result } = renderHook(() => usePlayerState());
      
      expect(result.current.color.overrides).toEqual(mockOverrides);
      expect(localStorage.getItem).toHaveBeenCalledWith('accentColorOverrides');
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      localStorage.getItem.mockImplementation((key) => {
        if (key === 'accentColorOverrides') return 'invalid-json';
        return null;
      });
      
      const { result } = renderHook(() => usePlayerState());
      
      expect(result.current.color.overrides).toEqual({});
    });

    it('should save accent color overrides to localStorage when state changes', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.handleSetAccentColorOverride('track-1', '#ff0000');
      });
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'accentColorOverrides',
        JSON.stringify({ 'track-1': '#ff0000' })
      );
    });
  });

  describe('Accent Color Helper Methods', () => {
    it('should set accent color override for a track', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.handleSetAccentColorOverride('track-1', '#ff0000');
      });
      
      expect(result.current.color.overrides).toEqual({
        'track-1': '#ff0000'
      });
    });

    it('should update existing accent color override for a track', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.handleSetAccentColorOverride('track-1', '#ff0000');
      });
      
      act(() => {
        result.current.handleSetAccentColorOverride('track-1', '#00ff00');
      });
      
      expect(result.current.color.overrides).toEqual({
        'track-1': '#00ff00'
      });
    });

    it('should remove accent color override for a track', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.handleSetAccentColorOverride('track-1', '#ff0000');
        result.current.handleSetAccentColorOverride('track-2', '#00ff00');
      });
      
      act(() => {
        result.current.handleRemoveAccentColorOverride('track-1');
      });
      
      expect(result.current.color.overrides).toEqual({
        'track-2': '#00ff00'
      });
    });

    it('should handle removing non-existent override gracefully', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.handleRemoveAccentColorOverride('non-existent-track');
      });
      
      expect(result.current.color.overrides).toEqual({});
    });

    it('should reset accent color override for a track', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.handleSetAccentColorOverride('track-1', '#ff0000');
        result.current.handleSetAccentColorOverride('track-2', '#00ff00');
      });
      
      act(() => {
        result.current.handleResetAccentColorOverride('track-1');
      });
      
      expect(result.current.color.overrides).toEqual({
        'track-2': '#00ff00'
      });
    });

    it('should maintain multiple track overrides independently', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.handleSetAccentColorOverride('track-1', '#ff0000');
        result.current.handleSetAccentColorOverride('track-2', '#00ff00');
        result.current.handleSetAccentColorOverride('track-3', '#0000ff');
      });
      
      expect(result.current.color.overrides).toEqual({
        'track-1': '#ff0000',
        'track-2': '#00ff00',
        'track-3': '#0000ff'
      });
    });
  });

  describe('localStorage Integration', () => {
    it('should persist overrides across multiple state changes', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.handleSetAccentColorOverride('track-1', '#ff0000');
      });
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'accentColorOverrides',
        JSON.stringify({ 'track-1': '#ff0000' })
      );
      
      act(() => {
        result.current.handleSetAccentColorOverride('track-2', '#00ff00');
      });
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'accentColorOverrides',
        JSON.stringify({ 'track-1': '#ff0000', 'track-2': '#00ff00' })
      );
    });
  });

  describe('Performance and Optimization', () => {
    it('should use useCallback for helper methods', () => {
      const { result } = renderHook(() => usePlayerState());
      
      const firstRender = result.current.handleSetAccentColorOverride;
      
      // Trigger a re-render
      act(() => {
        result.current.handleSetAccentColorOverride('track-1', '#ff0000');
      });
      
      const secondRender = result.current.handleSetAccentColorOverride;
      
      // Functions should be the same reference (memoized)
      expect(firstRender).toBe(secondRender);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string color values', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.handleSetAccentColorOverride('track-1', '');
      });
      
      expect(result.current.color.overrides).toEqual({
        'track-1': ''
      });
    });

    it('should handle special characters in track IDs', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.handleSetAccentColorOverride('track-with-special-chars-!@#$%', '#ff0000');
      });
      
      expect(result.current.color.overrides).toEqual({
        'track-with-special-chars-!@#$%': '#ff0000'
      });
    });
  });
});
