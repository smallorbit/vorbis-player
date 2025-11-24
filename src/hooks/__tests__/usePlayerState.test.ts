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
        'track-1': '#ff0000',
        'track-2': '#00ff00'
      };
      store['accentColorOverrides'] = JSON.stringify(mockOverrides);
      
      const { result } = renderHook(() => usePlayerState());
      
      expect(result.current.color.overrides).toEqual(mockOverrides);
      expect(localStorage.getItem).toHaveBeenCalledWith('accentColorOverrides');
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      store['accentColorOverrides'] = 'invalid-json';
      
      const { result } = renderHook(() => usePlayerState());
      
      expect(result.current.color.overrides).toEqual({});
    });

    it('should save accent color overrides to localStorage when state changes', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-1', '#ff0000');
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
        result.current.actions.color.handleSetAccentColorOverride('track-1', '#ff0000');
      });
      
      expect(result.current.color.overrides).toEqual({
        'track-1': '#ff0000'
      });
    });

    it('should update existing accent color override for a track', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-1', '#ff0000');
      });
      
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-1', '#00ff00');
      });
      
      expect(result.current.color.overrides).toEqual({
        'track-1': '#00ff00'
      });
    });

    it('should remove accent color override for a track', () => {
      const { result } = renderHook(() => usePlayerState());
      
      // Set multiple overrides
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-1', '#ff0000');
      });
      
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-2', '#00ff00');
      });
      
      // Verify both are set
      expect(result.current.color.overrides).toHaveProperty('track-1');
      expect(result.current.color.overrides).toHaveProperty('track-2');
      
      // Remove one
      act(() => {
        result.current.actions.color.handleRemoveAccentColorOverride('track-1');
      });
      
      // Verify track-1 is removed and track-2 remains
      expect(result.current.color.overrides).not.toHaveProperty('track-1');
      expect(result.current.color.overrides).toHaveProperty('track-2');
      expect(result.current.color.overrides['track-2']).toBe('#00ff00');
    });

    it('should handle removing non-existent override gracefully', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.actions.color.handleRemoveAccentColorOverride('non-existent-track');
      });
      
      expect(result.current.color.overrides).toEqual({});
    });

    it('should reset accent color override for a track', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-1', '#ff0000');
      });
      
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-2', '#00ff00');
      });
      
      // Verify both are set
      expect(result.current.color.overrides).toHaveProperty('track-1');
      expect(result.current.color.overrides).toHaveProperty('track-2');
      
      act(() => {
        result.current.actions.color.handleResetAccentColorOverride('track-1');
      });
      
      // Verify track-1 is removed and track-2 remains
      expect(result.current.color.overrides).not.toHaveProperty('track-1');
      expect(result.current.color.overrides).toHaveProperty('track-2');
      expect(result.current.color.overrides['track-2']).toBe('#00ff00');
    });

    it('should maintain multiple track overrides independently', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-1', '#ff0000');
      });
      
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-2', '#00ff00');
      });
      
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-3', '#0000ff');
      });
      
      // Verify all three tracks have their overrides set correctly
      expect(result.current.color.overrides['track-1']).toBe('#ff0000');
      expect(result.current.color.overrides['track-2']).toBe('#00ff00');
      expect(result.current.color.overrides['track-3']).toBe('#0000ff');
    });
  });

  describe('localStorage Integration', () => {
    it('should persist overrides across multiple state changes', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-1', '#ff0000');
      });
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'accentColorOverrides',
        JSON.stringify({ 'track-1': '#ff0000' })
      );
      
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-2', '#00ff00');
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
      
      const firstRender = result.current.actions.color.handleSetAccentColorOverride;
      
      // Trigger a re-render
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-1', '#ff0000');
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
        result.current.actions.color.handleSetAccentColorOverride('track-1', '');
      });
      
      expect(result.current.color.overrides).toEqual({
        'track-1': ''
      });
    });

    it('should handle special characters in track IDs', () => {
      const { result } = renderHook(() => usePlayerState());
      
      act(() => {
        result.current.actions.color.handleSetAccentColorOverride('track-with-special-chars-!@#$%', '#ff0000');
      });
      
      expect(result.current.color.overrides).toEqual({
        'track-with-special-chars-!@#$%': '#ff0000'
      });
    });
  });
});
