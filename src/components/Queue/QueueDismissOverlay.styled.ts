import styled from 'styled-components';
import { theme } from '@/styles/theme';

/** Dismiss overlay for queue shells (drawer + bottom sheet). */
export const QueueDismissOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100dvh;
  background: ${theme.colors.overlay.light};
  backdrop-filter: blur(2px);
  opacity: ${({ $isOpen }) => ($isOpen ? 1 : 0)};
  visibility: ${({ $isOpen }) => ($isOpen ? 'visible' : 'hidden')};
  transition: all ${theme.drawer.transitionDuration}ms ${theme.drawer.transitionEasing};
  z-index: ${theme.zIndex.overlay};
`;
