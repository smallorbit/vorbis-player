import styled, { css, keyframes } from 'styled-components';
import { theme } from '@/styles/theme';

export const MINI_PLAYER_HEIGHT_MOBILE = 64;
export const MINI_PLAYER_HEIGHT_DESKTOP = 72;
const HEIGHT_MOBILE = MINI_PLAYER_HEIGHT_MOBILE;
const HEIGHT_DESKTOP = MINI_PLAYER_HEIGHT_DESKTOP;

export const MiniPlayerRoot = styled.div`
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  height: ${HEIGHT_MOBILE}px;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  padding-bottom: calc(${theme.spacing.sm} + env(safe-area-inset-bottom, 0px));
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid ${theme.colors.borderSubtle};

  @media (min-width: ${theme.breakpoints.md}) {
    height: ${HEIGHT_DESKTOP}px;
  }
`;

export const TapTarget = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
  color: inherit;

  &:focus-visible {
    outline: 2px solid var(--accent-color, ${theme.colors.accent});
    outline-offset: 2px;
    border-radius: ${theme.borderRadius.md};
  }
`;

export const TextStack = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
`;

export const Title = styled.span`
  font-size: ${theme.fontSize?.sm ?? '0.875rem'};
  font-weight: 600;
  color: ${theme.colors.foreground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const Artist = styled.span`
  font-size: ${theme.fontSize?.xs ?? '0.75rem'};
  color: ${theme.colors.muted.foreground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ControlButtonRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  flex-shrink: 0;
`;

export const ControlButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: ${theme.borderRadius.full};
  background: transparent;
  border: none;
  color: ${theme.colors.foreground};
  cursor: pointer;
  transition: background 120ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  &:active {
    background: rgba(255, 255, 255, 0.14);
  }

  &:focus-visible {
    outline: 2px solid var(--accent-color, ${theme.colors.accent});
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
`;

export const ArtFrame = styled.div`
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: ${theme.borderRadius.md};
  overflow: hidden;
  background: ${theme.colors.muted.background};
`;

export const ArtImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const pulse = keyframes`
  0%, 100% { transform: scale(0.85); opacity: 0.7; }
  50%      { transform: scale(1);    opacity: 1; }
`;

export const PulseDot = styled.span<{ $playing: boolean }>`
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: ${theme.borderRadius.full};
  background: var(--accent-color, ${theme.colors.accent});
  opacity: ${({ $playing }) => ($playing ? 1 : 0)};
  transform-origin: center;

  ${({ $playing }) =>
    $playing &&
    css`
      animation: ${pulse} 1200ms ease-in-out infinite;

      @media (prefers-reduced-motion: reduce) {
        animation: none;
        transform: scale(1);
        opacity: 1;
      }
    `}
`;
