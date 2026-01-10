import React, { memo, useCallback } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { theme } from '../styles/theme';
import { getContrastColor } from '../utils/colorUtils';

// Define the component interface
interface LikeButtonProps {
  trackId?: string;
  isLiked: boolean;
  isLoading?: boolean;
  accentColor: string;
  onToggleLike: () => void;
  className?: string;
  $isMobile?: boolean;
  $isTablet?: boolean;
}

// Loading animation for the spinner
const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// Like animation for heart fill effect
const heartBeat = keyframes`
  0% { transform: scale(1); }
  14% { transform: scale(1.3); }
  28% { transform: scale(1); }
  42% { transform: scale(1.15); }
  70% { transform: scale(1); }
`;

// Styled button component following the ControlButton pattern with responsive sizing
const StyledLikeButton = styled.button<{
  $isLiked: boolean;
  $accentColor: string;
  $isLoading: boolean;
  $isMobile: boolean;
  $isTablet: boolean;
}>`
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${({ $isLoading }) => $isLoading ? 'default' : 'pointer'};
  transition: all 0.2s ease;
  padding: ${({ $isMobile, $isTablet }) => {
    if ($isMobile) return theme.spacing.xs;
    if ($isTablet) return theme.spacing.sm;
    return theme.spacing.sm;
  }};
  border-radius: ${({ $isMobile, $isTablet }) => {
    if ($isMobile) return theme.borderRadius.sm;
    if ($isTablet) return theme.borderRadius.md;
    return theme.borderRadius.md;
  }};
  position: relative;
  opacity: ${({ $isLoading }) => $isLoading ? 0.6 : 1};

  /* Responsive sizing matching other control buttons */
  svg {
    width: ${({ $isMobile, $isTablet }) => {
      if ($isMobile) return '1.25rem';
      if ($isTablet) return '1.375rem';
      return '1.5rem';
    }};
    height: ${({ $isMobile, $isTablet }) => {
      if ($isMobile) return '1.25rem';
      if ($isTablet) return '1.375rem';
      return '1.5rem';
    }};
    fill: currentColor;
    transition: all 0.2s ease;
  }

  /* Styling for liked state - matching ControlButton active state */
  ${({ $isLiked, $accentColor }) => $isLiked ? css`
    background: ${$accentColor};
    color: ${getContrastColor($accentColor)};

    &:hover:not(:disabled) {
      background: ${$accentColor}4D;
      color: ${getContrastColor($accentColor)};
      transform: translateY(-1px);
    }

    svg {
      animation: ${heartBeat} 0.6s ease-in-out;
    }
  ` : css`
    background: ${theme.colors.control.background};
    color: ${theme.colors.white};

    &:hover:not(:disabled) {
      background: ${theme.colors.control.backgroundHover};
      color: ${theme.colors.white};
      transform: translateY(-1px);
    }
  `}

  /* Disabled state for loading */
  &:disabled {
    cursor: default;
    pointer-events: none;
  }

  /* Focus styles for accessibility */
  &:focus-visible {
    outline: 2px solid ${({ $accentColor }) => $accentColor};
    outline-offset: 2px;
  }
`;

// Loading spinner component
const LoadingSpinner = styled.div<{ $accentColor: string }>`
  width: 1rem;
  height: 1rem;
  border: 2px solid transparent;
  border-top: 2px solid ${({ $accentColor }) => $accentColor};
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
  position: absolute;
`;

// Heart icon components for filled and outlined states - memoized for performance
const HeartIcon = memo<{ filled: boolean }>(({ filled }) => (
  <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
    {filled ? (
      // Filled heart
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    ) : (
      // Outlined heart
      <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" />
    )}
  </svg>
));

HeartIcon.displayName = 'HeartIcon';

// Custom comparison function for memo optimization
const areLikeButtonPropsEqual = (
  prevProps: LikeButtonProps,
  nextProps: LikeButtonProps
): boolean => {
  return (
    prevProps.trackId === nextProps.trackId &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.accentColor === nextProps.accentColor &&
    prevProps.className === nextProps.className &&
    prevProps.$isMobile === nextProps.$isMobile &&
    prevProps.$isTablet === nextProps.$isTablet
    // Note: onToggleLike is excluded from comparison as it should be memoized by parent
  );
};

// Main LikeButton component
const LikeButton = memo<LikeButtonProps>(({
  trackId,
  isLiked,
  isLoading = false,
  accentColor,
  onToggleLike,
  className,
  $isMobile = false,
  $isTablet = false
}) => {
  const handleClick = useCallback(() => {
    console.log('[DEBUG] LikeButton handleClick', {
      isLoading,
      trackId,
      hasOnToggleLike: !!onToggleLike
    });

    if (isLoading || !trackId) {
      console.warn('[DEBUG] LikeButton click ignored:', { isLoading, trackId });
      return;
    }

    console.log('[DEBUG] LikeButton calling onToggleLike');
    onToggleLike();
  }, [isLoading, trackId, onToggleLike]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  // Determine ARIA label based on current state
  const getAriaLabel = useCallback(() => {
    if (isLoading) return 'Loading...';
    if (!trackId) return 'No track selected';
    return isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs';
  }, [isLoading, trackId, isLiked]);

  return (
    <StyledLikeButton
      $isLiked={isLiked}
      $accentColor={accentColor}
      $isLoading={isLoading}
      $isMobile={$isMobile}
      $isTablet={$isTablet}
      disabled={isLoading || !trackId}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={className}
      aria-label={getAriaLabel()}
      title={getAriaLabel()}
      role="button"
      tabIndex={0}
    >
      {isLoading ? (
        <LoadingSpinner $accentColor={accentColor} />
      ) : (
        <HeartIcon filled={isLiked} />
      )}
    </StyledLikeButton>
  );
}, areLikeButtonPropsEqual);

LikeButton.displayName = 'LikeButton';

export default LikeButton;