import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const PopoverContainer = styled.div`
  position: fixed;
  z-index: ${({ theme }) => theme.zIndex.popover};
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px ${({ theme }) => theme.spacing.sm};
  gap: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.popover.background};
  border: 1px solid ${({ theme }) => theme.colors.popover.border};
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  box-shadow: ${({ theme }) => theme.shadows.popover};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
`;

export const SliderTrack = styled.div<{ $fillPercent: number }>`
  position: relative;
  width: 4px;
  height: 120px;
  background: ${({ theme }) => theme.colors.control.backgroundHover};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  touch-action: none;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: ${({ $fillPercent }) => $fillPercent}%;
    background: var(--accent-color);
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    pointer-events: none;
  }
`;

export const SliderThumb = styled.div<{ $percent: number }>`
  position: absolute;
  left: 50%;
  bottom: ${({ $percent }) => $percent}%;
  transform: translate(-50%, 50%);
  width: 14px;
  height: 14px;
  background: var(--accent-color);
  border-radius: 50%;
  pointer-events: none;
  box-shadow: ${({ theme }) => theme.shadows.xs};
`;

export const MuteButton = styled.button<{ $isMuted: boolean }>`
  border: none;
  background: ${({ $isMuted }) => $isMuted ? 'color-mix(in srgb, var(--accent-color) 20%, transparent)' : 'transparent'};
  color: ${({ $isMuted }) => $isMuted ? theme.colors.gray[300] : theme.colors.gray[400]};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: all ${({ theme }) => theme.transitions.fast} ease;
  touch-action: manipulation; /* Remove 300ms tap delay on iOS */

  &:hover {
    background: ${theme.colors.control.background};
    color: ${theme.colors.white};
  }

  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
`;

export const VolumeLabel = styled.span`
  font-size: 10px;
  font-family: monospace;
  color: ${theme.colors.gray[400]};
  user-select: none;
  min-width: 22px;
  text-align: center;
`;
