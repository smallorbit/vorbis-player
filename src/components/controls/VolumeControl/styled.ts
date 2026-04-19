import styled from 'styled-components';
import { theme } from '@/styles/theme';

const POPOVER_PADDING_Y = '12px';
const SLIDER_TRACK_WIDTH = '4px';
const SLIDER_TRACK_HEIGHT = '120px';
const SLIDER_THUMB_SIZE = '14px';
const VOLUME_LABEL_FONT_SIZE = '10px';
const VOLUME_LABEL_MIN_WIDTH = '22px';
const MUTE_BUTTON_ICON_SIZE = '16px';

export const PopoverContainer = styled.div`
  position: fixed;
  z-index: ${({ theme }) => theme.zIndex.popover};
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${POPOVER_PADDING_Y} ${({ theme }) => theme.spacing.sm};
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
  width: ${SLIDER_TRACK_WIDTH};
  height: ${SLIDER_TRACK_HEIGHT};
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
  width: ${SLIDER_THUMB_SIZE};
  height: ${SLIDER_THUMB_SIZE};
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
    width: ${MUTE_BUTTON_ICON_SIZE};
    height: ${MUTE_BUTTON_ICON_SIZE};
    fill: currentColor;
  }
`;

export const VolumeLabel = styled.span`
  font-size: ${VOLUME_LABEL_FONT_SIZE};
  font-family: monospace;
  color: ${theme.colors.gray[400]};
  user-select: none;
  min-width: ${VOLUME_LABEL_MIN_WIDTH};
  text-align: center;
`;
