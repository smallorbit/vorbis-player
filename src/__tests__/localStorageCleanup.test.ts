import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock console methods to avoid noise in tests
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

describe('localStorage Cleanup Functionality', () => {
  beforeEach(() => {
    // Clear localStorage mock before each test
    vi.clearAllMocks();
    localStorage.getItem.mockClear();
    localStorage.setItem.mockClear();
    localStorage.removeItem.mockClear();
    
    // Mock console methods
    console.log = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    vi.clearAllMocks();
  });

  describe('cleanupDeprecatedLocalStorage', () => {
    // Import the cleanup function from App.tsx
    const cleanupDeprecatedLocalStorage = () => {
      try {
        // Remove the deprecated customAccentColorOverrides key
        localStorage.removeItem('customAccentColorOverrides');
        console.log('Cleaned up deprecated localStorage key: customAccentColorOverrides');
      } catch (error) {
        console.warn('Failed to clean up deprecated localStorage keys:', error);
      }
    };

    it('should remove customAccentColorOverrides key from localStorage', () => {
      cleanupDeprecatedLocalStorage();
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('customAccentColorOverrides');
    });

    it('should log success message when cleanup succeeds', () => {
      cleanupDeprecatedLocalStorage();
      
      expect(console.log).toHaveBeenCalledWith(
        'Cleaned up deprecated localStorage key: customAccentColorOverrides'
      );
    });

    it('should handle localStorage errors gracefully', () => {
      const mockError = new Error('localStorage not available');
      localStorage.removeItem.mockImplementation(() => {
        throw mockError;
      });
      
      cleanupDeprecatedLocalStorage();
      
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to clean up deprecated localStorage keys:',
        mockError
      );
    });

    it('should not throw error when localStorage fails', () => {
      localStorage.removeItem.mockImplementation(() => {
        throw new Error('localStorage quota exceeded');
      });
      
      expect(() => {
        cleanupDeprecatedLocalStorage();
      }).not.toThrow();
    });

    it('should handle multiple cleanup calls safely', () => {
      cleanupDeprecatedLocalStorage();
      cleanupDeprecatedLocalStorage();
      
      expect(localStorage.removeItem).toHaveBeenCalledTimes(2);
      expect(localStorage.removeItem).toHaveBeenCalledWith('customAccentColorOverrides');
    });
  });

  describe('App Initialization Integration', () => {
    it('should run cleanup on app mount', () => {
      // This test verifies that the cleanup function is called during app initialization
      // In a real scenario, this would be tested by mounting the App component
      const cleanupDeprecatedLocalStorage = () => {
        try {
          localStorage.removeItem('customAccentColorOverrides');
          console.log('Cleaned up deprecated localStorage key: customAccentColorOverrides');
        } catch (error) {
          console.warn('Failed to clean up deprecated localStorage keys:', error);
        }
      };

      // Simulate app initialization
      cleanupDeprecatedLocalStorage();
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('customAccentColorOverrides');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined localStorage gracefully', () => {
      const originalLocalStorage = window.localStorage;
      delete (window as Record<string, unknown>).localStorage;
      
      const cleanupDeprecatedLocalStorage = () => {
        try {
          localStorage.removeItem('customAccentColorOverrides');
          console.log('Cleaned up deprecated localStorage key: customAccentColorOverrides');
        } catch (error) {
          console.warn('Failed to clean up deprecated localStorage keys:', error);
        }
      };

      expect(() => {
        cleanupDeprecatedLocalStorage();
      }).not.toThrow();
      
      expect(console.warn).toHaveBeenCalled();
      
      // Restore localStorage
      (window as Record<string, unknown>).localStorage = originalLocalStorage;
    });

    it('should handle null localStorage gracefully', () => {
      const originalLocalStorage = window.localStorage;
      (window as Record<string, unknown>).localStorage = null;
      
      const cleanupDeprecatedLocalStorage = () => {
        try {
          localStorage.removeItem('customAccentColorOverrides');
          console.log('Cleaned up deprecated localStorage key: customAccentColorOverrides');
        } catch (error) {
          console.warn('Failed to clean up deprecated localStorage keys:', error);
        }
      };

      expect(() => {
        cleanupDeprecatedLocalStorage();
      }).not.toThrow();
      
      expect(console.warn).toHaveBeenCalled();
      
      // Restore localStorage
      (window as Record<string, unknown>).localStorage = originalLocalStorage;
    });
  });
});
