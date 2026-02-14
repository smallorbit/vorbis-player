import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useCustomAccentColors } from '../useCustomAccentColors';

const mockUsePlayerState = vi.fn();
vi.mock('../usePlayerState', () => ({
  usePlayerState: () => mockUsePlayerState()
}));

vi.mock('../../styles/theme', () => ({
  theme: {
    colors: {
      accent: '#ff6b6b'
    }
  }
}));

describe('useCustomAccentColors', () => {
  const mockAccentColorOverrides = {
    'album-1': '#ff0000',
    'album-2': '#00ff00'
  };

  const mockHandleSetAccentColorOverride = vi.fn();
  const mockHandleRemoveAccentColorOverride = vi.fn();
  const mockHandleResetAccentColorOverride = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUsePlayerState.mockReturnValue({
      color: {
        overrides: mockAccentColorOverrides
      },
      actions: {
        color: {
          handleSetAccentColorOverride: mockHandleSetAccentColorOverride,
          handleRemoveAccentColorOverride: mockHandleRemoveAccentColorOverride,
          handleResetAccentColorOverride: mockHandleResetAccentColorOverride
        }
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should import and use usePlayerState hook', () => {
      renderHook(() => useCustomAccentColors({
        currentAlbumId: 'album-1',
        onAccentColorChange: vi.fn()
      }));

      expect(mockUsePlayerState).toHaveBeenCalled();
    });

    it('should return accent color overrides from usePlayerState', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: 'album-1',
        onAccentColorChange: vi.fn()
      }));

      expect(result.current.customAccentColorOverrides).toEqual(mockAccentColorOverrides);
    });

    it('should provide handleCustomAccentColor function', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: 'album-1',
        onAccentColorChange: vi.fn()
      }));

      expect(typeof result.current.handleCustomAccentColor).toBe('function');
    });

    it('should provide handleAccentColorChange function', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: 'album-1',
        onAccentColorChange: vi.fn()
      }));

      expect(typeof result.current.handleAccentColorChange).toBe('function');
    });
  });

  describe('handleCustomAccentColor', () => {
    it('should delegate to usePlayerState when currentAlbumId is provided', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: 'album-1',
        onAccentColorChange: mockOnAccentColorChange
      }));

      act(() => {
        result.current.handleCustomAccentColor('#ff0000');
      });

      expect(mockHandleSetAccentColorOverride).toHaveBeenCalledWith('album-1', '#ff0000');
      expect(mockOnAccentColorChange).toHaveBeenCalledWith('#ff0000');
    });

    it('should handle empty string by removing override', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: 'album-1',
        onAccentColorChange: mockOnAccentColorChange
      }));

      act(() => {
        result.current.handleCustomAccentColor('');
      });

      expect(mockHandleRemoveAccentColorOverride).toHaveBeenCalledWith('album-1');
      expect(mockOnAccentColorChange).toHaveBeenCalledWith('');
    });

    it('should call onAccentColorChange even when no currentAlbumId', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: undefined,
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
        currentAlbumId: 'album-1',
        onAccentColorChange: undefined
      }));

      act(() => {
        result.current.handleCustomAccentColor('#ff0000');
      });

      expect(mockHandleSetAccentColorOverride).toHaveBeenCalledWith('album-1', '#ff0000');
    });
  });

  describe('handleAccentColorChange', () => {
    it('should handle RESET_TO_DEFAULT by calling reset method', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: 'album-1',
        onAccentColorChange: mockOnAccentColorChange
      }));

      act(() => {
        result.current.handleAccentColorChange('RESET_TO_DEFAULT');
      });

      expect(mockHandleResetAccentColorOverride).toHaveBeenCalledWith('album-1');
      expect(mockOnAccentColorChange).not.toHaveBeenCalled();
    });

    it('should handle regular color changes by setting override', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: 'album-1',
        onAccentColorChange: mockOnAccentColorChange
      }));

      act(() => {
        result.current.handleAccentColorChange('#ff0000');
      });

      expect(mockHandleSetAccentColorOverride).toHaveBeenCalledWith('album-1', '#ff0000');
      expect(mockOnAccentColorChange).toHaveBeenCalledWith('#ff0000');
    });

    it('should call onAccentColorChange even when no currentAlbumId', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: undefined,
        onAccentColorChange: mockOnAccentColorChange
      }));

      act(() => {
        result.current.handleAccentColorChange('#ff0000');
      });

      expect(mockHandleSetAccentColorOverride).not.toHaveBeenCalled();
      expect(mockOnAccentColorChange).toHaveBeenCalledWith('#ff0000');
    });

    it('should handle RESET_TO_DEFAULT without currentAlbumId', () => {
      const mockOnAccentColorChange = vi.fn();
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: undefined,
        onAccentColorChange: mockOnAccentColorChange
      }));

      act(() => {
        result.current.handleAccentColorChange('RESET_TO_DEFAULT');
      });

      expect(mockHandleResetAccentColorOverride).not.toHaveBeenCalled();
      expect(mockOnAccentColorChange).toHaveBeenCalledWith('RESET_TO_DEFAULT');
    });
  });

  describe('API Compatibility', () => {
    it('should maintain expected API interface', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: 'album-1',
        onAccentColorChange: vi.fn()
      }));

      expect(result.current).toHaveProperty('customAccentColorOverrides');
      expect(result.current).toHaveProperty('handleCustomAccentColor');
      expect(result.current).toHaveProperty('handleAccentColorChange');

      expect(typeof result.current.customAccentColorOverrides).toBe('object');
      expect(typeof result.current.handleCustomAccentColor).toBe('function');
      expect(typeof result.current.handleAccentColorChange).toBe('function');
    });

    it('should return accentColorOverrides as customAccentColorOverrides', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: 'album-1',
        onAccentColorChange: vi.fn()
      }));

      expect(result.current.customAccentColorOverrides).toBe(mockAccentColorOverrides);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined currentAlbumId', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: undefined,
        onAccentColorChange: vi.fn()
      }));

      act(() => {
        result.current.handleCustomAccentColor('#ff0000');
      });

      expect(mockHandleSetAccentColorOverride).not.toHaveBeenCalled();
    });

    it('should handle empty string currentAlbumId', () => {
      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: '',
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
        'album-1': '#ff0000',
        'album-2': '#00ff00',
        'album-3': '#0000ff'
      };

      mockUsePlayerState.mockReturnValue({
        color: {
          overrides: customOverrides
        },
        actions: {
          color: {
            handleSetAccentColorOverride: mockHandleSetAccentColorOverride,
            handleRemoveAccentColorOverride: mockHandleRemoveAccentColorOverride,
            handleResetAccentColorOverride: mockHandleResetAccentColorOverride
          }
        }
      });

      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: 'album-1',
        onAccentColorChange: vi.fn()
      }));

      expect(result.current.customAccentColorOverrides).toEqual(customOverrides);
    });

    it('should handle empty overrides object from usePlayerState', () => {
      mockUsePlayerState.mockReturnValue({
        color: {
          overrides: {}
        },
        actions: {
          color: {
            handleSetAccentColorOverride: mockHandleSetAccentColorOverride,
            handleRemoveAccentColorOverride: mockHandleRemoveAccentColorOverride,
            handleResetAccentColorOverride: mockHandleResetAccentColorOverride
          }
        }
      });

      const { result } = renderHook(() => useCustomAccentColors({
        currentAlbumId: 'album-1',
        onAccentColorChange: vi.fn()
      }));

      expect(result.current.customAccentColorOverrides).toEqual({});
    });
  });
});
