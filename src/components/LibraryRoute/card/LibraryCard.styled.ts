import styled, { css } from 'styled-components';
import { theme } from '@/styles/theme';

export const CardButton = styled.button<{ $variant: 'row' | 'grid' }>`
  appearance: none;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  color: inherit;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;

  ${({ $variant }) =>
    $variant === 'row'
      ? css`
          width: 144px;
          flex: 0 0 auto;
          scroll-snap-align: start;
        `
      : css`
          width: 100%;
        `}

  &:focus-visible {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 2px;
    border-radius: ${theme.borderRadius.lg};
  }
`;

export const ArtWrap = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: ${theme.borderRadius.lg};
  overflow: hidden;
  background: ${theme.colors.muted.background};
`;

export const ArtImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

export const ArtPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSize.lg};
  color: ${theme.colors.muted.foreground};
`;

export const ProviderBadge = styled.span`
  position: absolute;
  top: ${theme.spacing.xs};
  right: ${theme.spacing.xs};
  padding: 0 ${theme.spacing.xs};
  border-radius: ${theme.borderRadius.sm};
  background: rgba(0, 0, 0, 0.6);
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.xs};
  text-transform: capitalize;
`;

export const Title = styled.div`
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

export const Subtitle = styled.div`
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.xs};
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
