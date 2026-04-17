import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { theme } from '../styles/theme';

interface LikeButtonProps {
  trackId?: string;
  isLiked: boolean;
  isLoading?: boolean;
  onToggleLike: () => void;
  className?: string;
  $isMobile?: boolean;
  $isTablet?: boolean;
}

const heartBeat = keyframes`
  0% { transform: scale(1); }
  14% { transform: scale(1.3); }
  28% { transform: scale(1); }
  42% { transform: scale(1.15); }
  70% { transform: scale(1); }
`;

const StyledLikeButton = styled.button<{
  $isLiked: boolean;
  $isPulsing: boolean;
  $isMobile: boolean;
  $isTablet: boolean;
}>`
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: ${({ $isMobile, $isTablet }) => {
    if ($isMobile) return theme.spacing.xs;
    if ($isTablet) return theme.spacing.sm;
    return theme.spacing.sm;
  }};
  border-radius: ${theme.borderRadius.flat};
  position: relative;

  .heart-icon-wrapper {
    position: relative;
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
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: currentColor;
    transition: opacity 0.3s ease;
  }

  .heart-filled {
    opacity: ${({ $isLiked }) => $isLiked ? 1 : 0};
  }

  .heart-outline {
    opacity: ${({ $isLiked }) => $isLiked ? 0 : 1};
  }

  ${({ $isPulsing }) => $isPulsing && css`
    .heart-icon-wrapper {
      animation: ${heartBeat} 0.6s ease-in-out;
    }
  `}

  ${({ $isLiked }) => $isLiked ? css`
    background: var(--accent-color);
    color: var(--accent-contrast-color);

    &:hover:not(:disabled) {
      background: color-mix(in srgb, var(--accent-color) 87%, transparent);
      color: var(--accent-contrast-color);
      transform: translateY(-1px);
    }
  ` : css`
    background: color-mix(in srgb, var(--accent-color) 20%, transparent);
    color: ${theme.colors.white};

    &:hover:not(:disabled) {
      background: color-mix(in srgb, var(--accent-color) 30%, transparent);
      color: ${theme.colors.white};
      transform: translateY(-1px);
    }
  `}

  &:disabled {
    cursor: default;
    opacity: 0.6;
    pointer-events: none;
  }

  &:focus-visible {
    outline: 2px solid var(--accent-color);
    outline-offset: 2px;
  }
`;

const FILLED_PATH = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
const OUTLINE_PATH = 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z';

const HeartIcon = memo(() => (
  <span className="heart-icon-wrapper">
    <svg className="heart-outline" viewBox="0 0 24 24" role="img" aria-hidden="true">
      <path d={OUTLINE_PATH} />
    </svg>
    <svg className="heart-filled" viewBox="0 0 24 24" role="img" aria-hidden="true">
      <path d={FILLED_PATH} />
    </svg>
  </span>
));

HeartIcon.displayName = 'HeartIcon';

const areLikeButtonPropsEqual = (
  prevProps: LikeButtonProps,
  nextProps: LikeButtonProps
): boolean => {
  return (
    prevProps.trackId === nextProps.trackId &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.className === nextProps.className &&
    prevProps.$isMobile === nextProps.$isMobile &&
    prevProps.$isTablet === nextProps.$isTablet
  );
};

const PULSE_DURATION_MS = 600;

const LikeButton = memo<LikeButtonProps>(({
  trackId,
  isLiked,
  isLoading = false,
  onToggleLike,
  className,
  $isMobile = false,
  $isTablet = false
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (isLoading || !trackId) return;

    setIsPulsing(false);
    requestAnimationFrame(() => {
      setIsPulsing(true);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = setTimeout(() => setIsPulsing(false), PULSE_DURATION_MS);
    });

    onToggleLike();
  }, [isLoading, trackId, onToggleLike]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  const ariaLabel = isLoading ? 'Loading...' : !trackId ? 'No track selected' : isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs';

  return (
    <StyledLikeButton
      $isLiked={isLiked}
      $isPulsing={isPulsing}
      $isMobile={$isMobile}
      $isTablet={$isTablet}
      disabled={isLoading || !trackId}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={className}
      aria-label={ariaLabel}
      title={ariaLabel}
      role="button"
      tabIndex={0}
    >
      <HeartIcon />
    </StyledLikeButton>
  );
}, areLikeButtonPropsEqual);

LikeButton.displayName = 'LikeButton';

export default LikeButton;
