import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const DRAWER_TRANSITION_DURATION = 300;
export const DRAWER_TRANSITION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

export const GripPill = styled.div`
  width: 40px;
  height: 4px;
  background: ${({ theme }) => theme.colors.control.backgroundHover};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
`;

export const SwipeHandle = styled.div`
  flex-shrink: 0;
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.sm} 0;
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
`;

