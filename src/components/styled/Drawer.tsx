import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const DRAWER_TRANSITION_DURATION = 300;
export const DRAWER_TRANSITION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

export const DrawerOverlay = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== '$isOpen',
})<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.zIndex.modal};
  background: ${({ theme }) => theme.colors.overlay.bar};
  opacity: ${({ $isOpen }) => ($isOpen ? 1 : 0)};
  pointer-events: ${({ $isOpen }) => ($isOpen ? 'auto' : 'none')};
  transition: opacity ${theme.drawer.transitionDuration}ms ${theme.drawer.transitionEasing};
`;

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

export const DrawerFallback = styled.div`
  width: 100%;
  padding: ${theme.spacing.lg};
`;

export const DrawerFallbackCard = styled.div`
  background-color: ${theme.colors.gray[800]};
  border-radius: ${theme.borderRadius['2xl']};
  padding: ${theme.spacing.md};
  border: 1px solid ${theme.colors.gray[700]};
`;
