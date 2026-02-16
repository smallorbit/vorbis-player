import styled from 'styled-components';
import { theme } from '@/styles/theme';

/**
 * Height of the desktop bottom menu content area.
 * Used to reserve space so content doesn't overlap.
 */
export const DESKTOP_BOTTOM_MENU_HEIGHT = '4.5rem';

export const MenuWrapper = styled.div`
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: ${theme.zIndex.mobileMenu};
  padding-bottom: env(safe-area-inset-bottom, 0px);
  width: auto;
  max-width: 90vw;
`;

export const ContentArea = styled.div`
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  background: ${theme.colors.overlay.dark};
  border: 1px solid ${theme.colors.popover.border};
  border-bottom: none;
  border-top-left-radius: ${theme.borderRadius.xl};
  border-top-right-radius: ${theme.borderRadius.xl};
  box-shadow: 0 -4px 20px rgba(0,0,0,0.35);
  backdrop-filter: blur(${theme.drawer.backdropBlur});
`;
