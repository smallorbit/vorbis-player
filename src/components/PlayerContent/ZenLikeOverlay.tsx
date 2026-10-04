import React from 'react';
import styled from 'styled-components';
import { MaterialHeartIcon } from '@/components/icons/HeartIcons';

const ZEN_LIKE_BUTTON_Z = 6;

interface ZenLikeOverlayProps {
  isLiked: boolean;
  isVisible: boolean;
  canSaveTrack: boolean;
  onToggleLike: () => void;
  zenModeEnabled: boolean;
}

const LikeButton = styled.button.withConfig({
  shouldForwardProp: (prop) => !['$isVisible'].includes(prop),
})<{ $isVisible: boolean }>`
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: ${ZEN_LIKE_BUTTON_Z};
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.45);
  border-radius: ${({ theme }) => theme.borderRadius.full};
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(2rem, 10%, 3.5rem);
  height: clamp(2rem, 10%, 3.5rem);
  aspect-ratio: 1;
  padding: 0;
  opacity: ${({ $isVisible }) => ($isVisible ? 1 : 0)};
  transition: opacity 150ms ease;
`;

export const ZenLikeOverlay: React.FC<ZenLikeOverlayProps> = React.memo(({
  isLiked,
  isVisible,
  canSaveTrack,
  onToggleLike,
  zenModeEnabled,
}) => {
  if (!canSaveTrack || !zenModeEnabled) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleLike();
  };

  return (
    <LikeButton
      $isVisible={isVisible}
      aria-label={isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
      onClick={handleClick}
    >
      <MaterialHeartIcon filled={isLiked} fill="white" style={{ width: '55%', height: '55%' }} />
    </LikeButton>
  );
});

ZenLikeOverlay.displayName = 'ZenLikeOverlay';
