import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import LikeButton from '../LikeButton';

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
    mobile: '768px'
  }
};

// Test wrapper component with theme provider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={mockTheme}>
    {children}
  </ThemeProvider>
);

describe('LikeButton Component', () => {
  const defaultProps = {
    trackId: 'spotify-track-123',
    isLiked: false,
    isLoading: false,
    accentColor: '#1DB954',
    onToggleLike: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render heart outline when not liked', () => {
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Add to Liked Songs');
      
      // Check that the heart icon is rendered (outline version)
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render filled heart when liked', () => {
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} isLiked={true} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Remove from Liked Songs');
      
      // Check that the filled heart icon is rendered
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should show loading state when isLoading=true', () => {
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} isLoading={true} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Loading...');
      expect(button).toBeDisabled();
      
      // Check that loading spinner is rendered instead of heart
      const spinner = button.querySelector('[class*="LoadingSpinner"]');
      expect(spinner).toBeInTheDocument();
    });

    it('should be disabled when no trackId provided', () => {
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} trackId={undefined} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-label', 'No track selected');
    });

    it('should apply custom className when provided', () => {
      const customClass = 'custom-like-button';
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} className={customClass} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass(customClass);
    });

    it('should apply accent color theming', () => {
      const customAccentColor = '#FF5722';
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} accentColor={customAccentColor} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      
      // The accent color is applied through styled-components props
      // We can test that the component renders without error with custom accent color
    });
  });

  describe('Interactions', () => {
    it('should call onToggleLike when clicked', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();

      render(
        <TestWrapper>
          <LikeButton {...defaultProps} onToggleLike={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockToggle).toHaveBeenCalledOnce();
    });

    it('should not call onToggleLike when loading', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();

      render(
        <TestWrapper>
          <LikeButton {...defaultProps} isLoading={true} onToggleLike={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockToggle).not.toHaveBeenCalled();
    });

    it('should not call onToggleLike when no trackId', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();

      render(
        <TestWrapper>
          <LikeButton {...defaultProps} trackId={undefined} onToggleLike={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockToggle).not.toHaveBeenCalled();
    });

    it('should handle multiple rapid clicks gracefully', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();

      render(
        <TestWrapper>
          <LikeButton {...defaultProps} onToggleLike={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      
      // Simulate rapid clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockToggle).toHaveBeenCalledTimes(3);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should respond to Enter key', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();

      render(
        <TestWrapper>
          <LikeButton {...defaultProps} onToggleLike={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(mockToggle).toHaveBeenCalledOnce();
    });

    it('should respond to Space key', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();

      render(
        <TestWrapper>
          <LikeButton {...defaultProps} onToggleLike={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard(' ');

      expect(mockToggle).toHaveBeenCalledOnce();
    });

    it('should not respond to other keys', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();

      render(
        <TestWrapper>
          <LikeButton {...defaultProps} onToggleLike={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Escape}');
      await user.keyboard('a');
      await user.keyboard('{ArrowDown}');

      expect(mockToggle).not.toHaveBeenCalled();
    });

    it('should not respond to keyboard when disabled', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();

      render(
        <TestWrapper>
          <LikeButton {...defaultProps} isLoading={true} onToggleLike={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');

      expect(mockToggle).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const { rerender } = render(
        <TestWrapper>
          <LikeButton {...defaultProps} />
        </TestWrapper>
      );

      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Add to Liked Songs');
      expect(button).toHaveAttribute('title', 'Add to Liked Songs');

      rerender(
        <TestWrapper>
          <LikeButton {...defaultProps} isLiked={true} />
        </TestWrapper>
      );

      button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Remove from Liked Songs');
      expect(button).toHaveAttribute('title', 'Remove from Liked Songs');
    });

    it('should have proper ARIA label when loading', () => {
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} isLoading={true} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Loading...');
      expect(button).toHaveAttribute('title', 'Loading...');
    });

    it('should have proper ARIA label when no track selected', () => {
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} trackId={undefined} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'No track selected');
      expect(button).toHaveAttribute('title', 'No track selected');
    });

    it('should have correct role and tabIndex', () => {
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('role', 'button');
      expect(button).toHaveAttribute('tabIndex', '0');
    });

    it('should have aria-hidden on heart icon', () => {
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} />
        </TestWrapper>
      );

      const svg = screen.getByRole('img', { hidden: true });
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Animation States', () => {
    it('should handle animation state changes', async () => {
      vi.useFakeTimers();
      const mockToggle = vi.fn();

      render(
        <TestWrapper>
          <LikeButton {...defaultProps} onToggleLike={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      
      // Trigger click to start animation
      fireEvent.click(button);
      expect(mockToggle).toHaveBeenCalled();

      // Fast-forward time to complete animation
      vi.advanceTimersByTime(600);

      vi.useRealTimers();
    });

    it('should show heart beat animation when liked', () => {
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} isLiked={true} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      
      // Animation is applied via styled-components CSS
      // We can verify the component renders correctly with the liked state
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty trackId string', () => {
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} trackId="" />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-label', 'No track selected');
    });

    it('should handle whitespace-only trackId', () => {
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} trackId="   " />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      // Component should treat whitespace-only as valid (this is current behavior)
      expect(button).not.toBeDisabled();
    });

    it('should handle simultaneous isLoading and isLiked states', () => {
      render(
        <TestWrapper>
          <LikeButton {...defaultProps} isLoading={true} isLiked={true} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-label', 'Loading...');
      
      // Should show spinner, not heart
      const spinner = button.querySelector('[class*="LoadingSpinner"]');
      expect(spinner).toBeInTheDocument();
    });

    it('should handle invalid accent colors gracefully', () => {
      const invalidColor = 'not-a-color';
      
      expect(() => {
        render(
          <TestWrapper>
            <LikeButton {...defaultProps} accentColor={invalidColor} />
          </TestWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('State Transitions', () => {
    it('should transition from not liked to liked', () => {
      const { rerender } = render(
        <TestWrapper>
          <LikeButton {...defaultProps} isLiked={false} />
        </TestWrapper>
      );

      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Add to Liked Songs');

      rerender(
        <TestWrapper>
          <LikeButton {...defaultProps} isLiked={true} />
        </TestWrapper>
      );

      button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Remove from Liked Songs');
    });

    it('should handle loading state transitions', () => {
      const { rerender } = render(
        <TestWrapper>
          <LikeButton {...defaultProps} isLoading={false} />
        </TestWrapper>
      );

      let button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
      
      rerender(
        <TestWrapper>
          <LikeButton {...defaultProps} isLoading={true} />
        </TestWrapper>
      );

      button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-label', 'Loading...');
    });

    it('should handle trackId changes', () => {
      const { rerender } = render(
        <TestWrapper>
          <LikeButton {...defaultProps} trackId="track-1" />
        </TestWrapper>
      );

      let button = screen.getByRole('button');
      expect(button).not.toBeDisabled();

      rerender(
        <TestWrapper>
          <LikeButton {...defaultProps} trackId={undefined} />
        </TestWrapper>
      );

      button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-label', 'No track selected');
    });
  });
});