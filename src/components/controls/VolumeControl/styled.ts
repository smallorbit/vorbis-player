import styled from 'styled-components';
import { theme } from '@/styles/theme';

const POPOVER_PADDING_Y = '12px';
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
