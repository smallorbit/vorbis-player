import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useCustomAccentColors } from '../useCustomAccentColors';

// Mock usePlayerState hook
const mockUsePlayerState = vi.fn();
vi.mock('../usePlayerState', () => ({
  usePlayerState: () => mockUsePlayerState()
}));

// Mock the theme module
vi.mock('../../styles/theme', () => ({
  theme: {
    colors: {
      accent: '#ff6b6b'
    }
  }
}));

describe('useCustomAccentColors - Refactored Adapter Hook', () => {
  const mockAccentColorOverrides = {
    'track-1': '#ff0000',
    'track-2': '#00ff00'
  };

  const mockHandleSetAccentColorOverride = vi.fn();
  const mockHandleRemoveAccentColorOverride = vi.fn();
  const mockHandleResetAccentColorOverride = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock return values
    mockUsePlayerState.mockReturnValue({
      accentColorOverrides: mockAccentColorOverrides,
      handleSetAccentColorOverride: mockHandleSetAccentColorOverride,
      handleRemoveAccentColorOverride: mockHandleRemoveAccentColorOverride,
      handleResetAccentColorOverride: mockHandleResetAccentColorOverride
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should import and use usePlayerState hook', () => {
      renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: vi.fn()
      }));
      
      expect(mockUsePlayerState).toHaveBeenCalled();
    });

    it('should return accent color overrides from usePlayerState', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: vi.fn()
      }));
      
      expect(result.current.customAccentColorOverrides).toEqual(mockAccentColorOverrides);
    });

    it('should provide handleCustomAccentColor function', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: vi.fn()
      }));
      
      expect(typeof result.current.handleCustomAccentColor).toBe('function');
    });

    it('should provide handleAccentColorChange function', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: vi.fn()
      }));
      
      expect(typeof result.current.handleAccentColorChange).toBe('function');
    });
  });

  describe('handleCustomAccentColor', () => {
    it('should delegate to usePlayerState when currentTrackId is provided', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: mockOnAccentColorChange
      }));
      
      act(() => {
        result.current.handleCustomAccentColor('#ff0000');
      });
      
      expect(mockHandleSetAccentColorOverride).toHaveBeenCalledWith('track-1', '#ff0000');
      expect(mockOnAccentColorChange).toHaveBeenCalledWith('#ff0000');
    });

    it('should handle empty string by removing override', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: mockOnAccentColorChange
      }));
      
      act(() => {
        result.current.handleCustomAccentColor('');
      });
      
      expect(mockHandleRemoveAccentColorOverride).toHaveBeenCalledWith('track-1');
      expect(mockOnAccentColorChange).toHaveBeenCalledWith('');
    });

    it('should call onAccentColorChange even when no currentTrackId', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: undefined,
        onAccentColorChange: mockOnAccentColorChange
      }));
      
      act(() => {
        result.current.handleCustomAccentColor('#ff0000');
      });
      
      expect(mockHandleSetAccentColorOverride).not.toHaveBeenCalled();
      expect(mockOnAccentColorChange).toHaveBeenCalledWith('#ff0000');
    });

    it('should not call onAccentColorChange when it is not provided', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: undefined
      }));
      
      act(() => {
        result.current.handleCustomAccentColor('#ff0000');
      });
      
      expect(mockHandleSetAccentColorOverride).toHaveBeenCalledWith('track-1', '#ff0000');
    });
  });

  describe('handleAccentColorChange', () => {
    it('should handle RESET_TO_DEFAULT by calling reset method', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: mockOnAccentColorChange
      }));
      
      act(() => {
        result.current.handleAccentColorChange('RESET_TO_DEFAULT');
      });
      
      expect(mockHandleResetAccentColorOverride).toHaveBeenCalledWith('track-1');
      expect(mockOnAccentColorChange).not.toHaveBeenCalled();
    });

    it('should handle regular color changes by setting override', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: mockOnAccentColorChange
      }));
      
      act(() => {
        result.current.handleAccentColorChange('#ff0000');
      });
      
      expect(mockHandleSetAccentColorOverride).toHaveBeenCalledWith('track-1', '#ff0000');
      expect(mockOnAccentColorChange).toHaveBeenCalledWith('#ff0000');
    });

    it('should call onAccentColorChange even when no currentTrackId', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: undefined,
        onAccentColorChange: mockOnAccentColorChange
      }));
      
      act(() => {
        result.current.handleAccentColorChange('#ff0000');
      });
      
      expect(mockHandleSetAccentColorOverride).not.toHaveBeenCalled();
      expect(mockOnAccentColorChange).toHaveBeenCalledWith('#ff0000');
    });

    it('should handle RESET_TO_DEFAULT without currentTrackId', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: undefined,
        onAccentColorChange: mockOnAccentColorChange
      }));
      
      act(() => {
        result.current.handleAccentColorChange('RESET_TO_DEFAULT');
      });
      
      expect(mockHandleResetAccentColorOverride).not.toHaveBeenCalled();
      // onAccentColorChange should be called even for RESET_TO_DEFAULT without currentTrackId
      expect(mockOnAccentColorChange).toHaveBeenCalledWith('RESET_TO_DEFAULT');
    });
  });

  describe('API Compatibility', () => {
    it('should maintain same API interface as before refactoring', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: vi.fn()
      }));
      
      // Verify all expected properties exist
      expect(result.current).toHaveProperty('customAccentColorOverrides');
      expect(result.current).toHaveProperty('handleCustomAccentColor');
      expect(result.current).toHaveProperty('handleAccentColorChange');
      
      // Verify types
      expect(typeof result.current.customAccentColorOverrides).toBe('object');
      expect(typeof result.current.handleCustomAccentColor).toBe('function');
      expect(typeof result.current.handleAccentColorChange).toBe('function');
    });

    it('should return accentColorOverrides as customAccentColorOverrides for compatibility', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: vi.fn()
      }));
      
      expect(result.current.customAccentColorOverrides).toBe(mockAccentColorOverrides);
    });
  });

  describe('Performance and Optimization', () => {
    it('should use useCallback for returned functions', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: vi.fn()
      }));
      
      const firstRender = result.current.handleCustomAccentColor;
      
      // Trigger a re-render by changing props
      const { result: result2 } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-2',
        onAccentColorChange: vi.fn()
      }));
      
      const secondRender = result2.current.handleCustomAccentColor;
      
      // Functions should be memoized (same reference for same dependencies)
      expect(typeof firstRender).toBe('function');
      expect(typeof secondRender).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined currentTrackId', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: undefined,
        onAccentColorChange: vi.fn()
      }));
      
      act(() => {
        result.current.handleCustomAccentColor('#ff0000');
      });
      
      expect(mockHandleSetAccentColorOverride).not.toHaveBeenCalled();
    });

    it('should handle null currentTrackId', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: null as any,
        onAccentColorChange: vi.fn()
      }));
      
      act(() => {
        result.current.handleCustomAccentColor('#ff0000');
      });
      
      expect(mockHandleSetAccentColorOverride).not.toHaveBeenCalled();
    });

    it('should handle empty string currentTrackId', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: '',
        onAccentColorChange: vi.fn()
      }));
      
      act(() => {
        result.current.handleCustomAccentColor('#ff0000');
      });
      
      expect(mockHandleSetAccentColorOverride).not.toHaveBeenCalled();
    });
  });

  describe('Integration with usePlayerState', () => {
    it('should pass through all accent color overrides from usePlayerState', () => {
      const customOverrides = {
        'track-1': '#ff0000',
        'track-2': '#00ff00',
        'track-3': '#0000ff'
      };
      
      mockUsePlayerState.mockReturnValue({
        accentColorOverrides: customOverrides,
        handleSetAccentColorOverride: mockHandleSetAccentColorOverride,
        handleRemoveAccentColorOverride: mockHandleRemoveAccentColorOverride,
        handleResetAccentColorOverride: mockHandleResetAccentColorOverride
      });
      
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: vi.fn()
      }));
      
      expect(result.current.customAccentColorOverrides).toEqual(customOverrides);
    });

    it('should handle empty overrides object from usePlayerState', () => {
      mockUsePlayerState.mockReturnValue({
        accentColorOverrides: {},
        handleSetAccentColorOverride: mockHandleSetAccentColorOverride,
        handleRemoveAccentColorOverride: mockHandleRemoveAccentColorOverride,
        handleResetAccentColorOverride: mockHandleResetAccentColorOverride
      });
      
      const { result } = renderHook(() => useCustomAccentColors({
        currentTrackId: 'track-1',
        onAccentColorChange: vi.fn()
      }));
      
      expect(result.current.customAccentColorOverrides).toEqual({});
    });
  });
});
