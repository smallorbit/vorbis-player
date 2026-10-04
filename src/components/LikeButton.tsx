import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { AnimatedHeartIcon } from '@/components/icons/HeartIcons';
import { theme } from '../styles/theme';

interface LikeButtonProps {
  trackId?: string | undefined;
  isLiked: boolean;
  isLoading?: boolean | undefined;
  onToggleLike: () => void;
  className?: string | undefined;
  $isMobile?: boolean | undefined;
  $isTablet?: boolean | undefined;
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
  border-radius: ${({ $isMobile, $isTablet }) => {
    if ($isMobile) return theme.borderRadius.sm;
    if ($isTablet) return theme.borderRadius.md;
    return theme.borderRadius.md;
  }};
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
      <AnimatedHeartIcon />
    </StyledLikeButton>
  );
}, areLikeButtonPropsEqual);

LikeButton.displayName = 'LikeButton';

export default LikeButton;
