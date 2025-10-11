import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import LikeButton from '../LikeButton';
import * as spotifyService from '../../services/spotify';

// Mock the entire spotify service
vi.mock('../../services/spotify', () => ({
  checkTrackSaved: vi.fn(),
  saveTrack: vi.fn(),
  unsaveTrack: vi.fn(),
  spotifyAuth: {
    ensureValidToken: vi.fn(() => Promise.resolve('mock-token'))
  }
}));

// Mock theme for styled-components
const mockTheme = {
  colors: {
    primary: '#1DB954',
    secondary: '#191414',
    accent: '#1DB954',
    background: '#121212',
    surface: '#181818',
    text: '#FFFFFF',
    textSecondary: '#B3B3B3',
    border: '#282828'
  },
  breakpoints: {
    mobile: '700px'
  }
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={mockTheme}>
    {children}
  </ThemeProvider>
);

// Integration test component that manages the like state
const LikeButtonIntegration: React.FC<{
  trackId: string;
  accentColor?: string;
  initialLiked?: boolean;
}> = ({ trackId, accentColor = '#1DB954', initialLiked = false }) => {
  const [isLiked, setIsLiked] = React.useState(initialLiked);
  const [isLoading, setIsLoading] = React.useState(false);

  // Check initial like status
  React.useEffect(() => {
    const checkInitialStatus = async () => {
      if (!trackId) return;

      try {
        setIsLoading(true);
        const liked = await spotifyService.checkTrackSaved(trackId);
        setIsLiked(liked);
      } catch (error) {
        console.error('Failed to check track status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkInitialStatus();
  }, [trackId]);

  const handleToggleLike = async () => {
    if (!trackId || isLoading) return;

    try {
      setIsLoading(true);

      if (isLiked) {
        await spotifyService.unsaveTrack(trackId);
        setIsLiked(false);
      } else {
        await spotifyService.saveTrack(trackId);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      // In a real app, you might want to show an error message
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LikeButton
      trackId={trackId}
      isLiked={isLiked}
      isLoading={isLoading}
      accentColor={accentColor}
      onToggleLike={handleToggleLike}
    />
  );
};

describe('LikeButton Integration Tests', () => {
  const mockTrackId = 'spotify-track-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State Loading', () => {
    it('should check track status on mount and show as not liked', async () => {
      vi.mocked(spotifyService.checkTrackSaved).mockResolvedValue(false);

      render(
        <TestWrapper>
          <LikeButtonIntegration trackId={mockTrackId} />
        </TestWrapper>
      );

      // Should show loading initially
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument();

      // Wait for initial check to complete
      await waitFor(() => {
        expect(screen.getByLabelText('Add to Liked Songs')).toBeInTheDocument();
      });

      expect(spotifyService.checkTrackSaved).toHaveBeenCalledWith(mockTrackId);
    });

    it('should check track status on mount and show as liked', async () => {
      vi.mocked(spotifyService.checkTrackSaved).mockResolvedValue(true);

      render(
        <TestWrapper>
          <LikeButtonIntegration trackId={mockTrackId} />
        </TestWrapper>
      );

      // Wait for initial check to complete
      await waitFor(() => {
        expect(screen.getByLabelText('Remove from Liked Songs')).toBeInTheDocument();
      });

      expect(spotifyService.checkTrackSaved).toHaveBeenCalledWith(mockTrackId);
    });

    it('should handle initial check errors gracefully', async () => {
      vi.mocked(spotifyService.checkTrackSaved).mockRejectedValue(
        new Error('API Error')
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      render(
        <TestWrapper>
          <LikeButtonIntegration trackId={mockTrackId} />
        </TestWrapper>
      );

      // Should still render button after error
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to check track status:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Like/Unlike Workflow', () => {
    it('should complete full like workflow', async () => {
      const user = userEvent.setup();

      // Mock initial state as not liked
      vi.mocked(spotifyService.checkTrackSaved).mockResolvedValue(false);
      vi.mocked(spotifyService.saveTrack).mockResolvedValue();

      render(
        <TestWrapper>
          <LikeButtonIntegration trackId={mockTrackId} />
        </TestWrapper>
      );

      // Wait for initial state
      await waitFor(() => {
        expect(screen.getByLabelText('Add to Liked Songs')).toBeInTheDocument();
      });

      // Click to like
      const button = screen.getByRole('button');
      await user.click(button);

      // Should show loading
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument();

      // Wait for like action to complete
      await waitFor(() => {
        expect(screen.getByLabelText('Remove from Liked Songs')).toBeInTheDocument();
      });

      expect(spotifyService.saveTrack).toHaveBeenCalledWith(mockTrackId);
    });

    it('should complete full unlike workflow', async () => {
      const user = userEvent.setup();

      // Mock initial state as liked
      vi.mocked(spotifyService.checkTrackSaved).mockResolvedValue(true);
      vi.mocked(spotifyService.unsaveTrack).mockResolvedValue();

      render(
        <TestWrapper>
          <LikeButtonIntegration trackId={mockTrackId} />
        </TestWrapper>
      );

      // Wait for initial state
      await waitFor(() => {
        expect(screen.getByLabelText('Remove from Liked Songs')).toBeInTheDocument();
      });

      // Click to unlike
      const button = screen.getByRole('button');
      await user.click(button);

      // Should show loading
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument();

      // Wait for unlike action to complete
      await waitFor(() => {
        expect(screen.getByLabelText('Add to Liked Songs')).toBeInTheDocument();
      });

      expect(spotifyService.unsaveTrack).toHaveBeenCalledWith(mockTrackId);
    });

    it('should handle multiple rapid clicks gracefully', async () => {
      const user = userEvent.setup();

      vi.mocked(spotifyService.checkTrackSaved).mockResolvedValue(false);
      vi.mocked(spotifyService.saveTrack).mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <TestWrapper>
          <LikeButtonIntegration trackId={mockTrackId} />
        </TestWrapper>
      );

      // Wait for initial state
      await waitFor(() => {
        expect(screen.getByLabelText('Add to Liked Songs')).toBeInTheDocument();
      });

      const button = screen.getByRole('button');

      // Click multiple times rapidly
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Should only call saveTrack once due to loading state
      await waitFor(() => {
        expect(spotifyService.saveTrack).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle like operation errors', async () => {
      const user = userEvent.setup();

      vi.mocked(spotifyService.checkTrackSaved).mockResolvedValue(false);
      vi.mocked(spotifyService.saveTrack).mockRejectedValue(
        new Error('Like failed')
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      render(
        <TestWrapper>
          <LikeButtonIntegration trackId={mockTrackId} />
        </TestWrapper>
      );

      // Wait for initial state
      await waitFor(() => {
        expect(screen.getByLabelText('Add to Liked Songs')).toBeInTheDocument();
      });

      // Click to like
      const button = screen.getByRole('button');
      await user.click(button);

      // Wait for error handling
      await waitFor(() => {
        expect(screen.getByLabelText('Add to Liked Songs')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to toggle like:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle unlike operation errors', async () => {
      const user = userEvent.setup();

      vi.mocked(spotifyService.checkTrackSaved).mockResolvedValue(true);
      vi.mocked(spotifyService.unsaveTrack).mockRejectedValue(
        new Error('Unlike failed')
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      render(
        <TestWrapper>
          <LikeButtonIntegration trackId={mockTrackId} />
        </TestWrapper>
      );

      // Wait for initial state
      await waitFor(() => {
        expect(screen.getByLabelText('Remove from Liked Songs')).toBeInTheDocument();
      });

      // Click to unlike
      const button = screen.getByRole('button');
      await user.click(button);

      // Wait for error handling - should revert to liked state
      await waitFor(() => {
        expect(screen.getByLabelText('Remove from Liked Songs')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to toggle like:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();

      vi.mocked(spotifyService.checkTrackSaved).mockResolvedValue(false);
      vi.mocked(spotifyService.saveTrack).mockRejectedValue(
        new Error('Network error')
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      render(
        <TestWrapper>
          <LikeButtonIntegration trackId={mockTrackId} />
        </TestWrapper>
      );

      // Wait for initial state
      await waitFor(() => {
        expect(screen.getByLabelText('Add to Liked Songs')).toBeInTheDocument();
      });

      // Click to like
      const button = screen.getByRole('button');
      await user.click(button);

      // Should handle error and return to available state
      await waitFor(() => {
        expect(screen.getByRole('button')).not.toBeDisabled();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Authentication Integration', () => {
    it('should handle authentication token refresh', async () => {
      const user = userEvent.setup();

      vi.mocked(spotifyService.checkTrackSaved).mockResolvedValue(false);
      vi.mocked(spotifyService.saveTrack).mockResolvedValue();

      render(
        <TestWrapper>
          <LikeButtonIntegration trackId={mockTrackId} />
        </TestWrapper>
      );

      // Wait for initial check
      await waitFor(() => {
        expect(screen.getByLabelText('Add to Liked Songs')).toBeInTheDocument();
      });

      // Click to like
      const button = screen.getByRole('button');
      await user.click(button);

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByLabelText('Remove from Liked Songs')).toBeInTheDocument();
      });

      // Verify that the spotify service methods were called
      // (token refresh happens internally in the service)
      expect(spotifyService.checkTrackSaved).toHaveBeenCalled();
      expect(spotifyService.saveTrack).toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      const user = userEvent.setup();

      vi.mocked(spotifyService.checkTrackSaved).mockResolvedValue(false);
      vi.mocked(spotifyService.saveTrack).mockRejectedValue(
        new Error('Token expired')
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      render(
        <TestWrapper>
          <LikeButtonIntegration trackId={mockTrackId} />
        </TestWrapper>
      );

      // Wait for initial state
      await waitFor(() => {
        expect(screen.getByLabelText('Add to Liked Songs')).toBeInTheDocument();
      });

      // Click to like
      const button = screen.getByRole('button');
      await user.click(button);

      // Should handle auth error
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to toggle like:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across component updates', async () => {
      const user = userEvent.setup();

      vi.mocked(spotifyService.checkTrackSaved).mockResolvedValue(false);
      vi.mocked(spotifyService.saveTrack).mockResolvedValue();

      const { rerender } = render(
        <TestWrapper>
          <LikeButtonIntegration trackId={mockTrackId} accentColor="#FF5722" />
        </TestWrapper>
      );

      // Wait for initial state
      await waitFor(() => {
        expect(screen.getByLabelText('Add to Liked Songs')).toBeInTheDocument();
      });

      // Click to like
      const button = screen.getByRole('button');
      await user.click(button);

      // Wait for like to complete
      await waitFor(() => {
        expect(screen.getByLabelText('Remove from Liked Songs')).toBeInTheDocument();
      });

      // Rerender with different accent color
      rerender(
        <TestWrapper>
          <LikeButtonIntegration trackId={mockTrackId} accentColor="#1DB954" />
        </TestWrapper>
      );

      // Should maintain liked state
      expect(screen.getByLabelText('Remove from Liked Songs')).toBeInTheDocument();
    });

    it('should reset state when trackId changes', async () => {
      vi.mocked(spotifyService.checkTrackSaved)
        .mockResolvedValueOnce(true)  // First track is liked
        .mockResolvedValueOnce(false); // Second track is not liked

      const { rerender } = render(
        <TestWrapper>
          <LikeButtonIntegration trackId="track-1" />
        </TestWrapper>
      );

      // Wait for first track state
      await waitFor(() => {
        expect(screen.getByLabelText('Remove from Liked Songs')).toBeInTheDocument();
      });

      // Change to different track
      rerender(
        <TestWrapper>
          <LikeButtonIntegration trackId="track-2" />
        </TestWrapper>
      );

      // Should show loading for new track
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument();

      // Wait for new track state
      await waitFor(() => {
        expect(screen.getByLabelText('Add to Liked Songs')).toBeInTheDocument();
      });

      expect(spotifyService.checkTrackSaved).toHaveBeenCalledTimes(2);
      expect(spotifyService.checkTrackSaved).toHaveBeenCalledWith('track-1');
      expect(spotifyService.checkTrackSaved).toHaveBeenCalledWith('track-2');
    });
  });
});