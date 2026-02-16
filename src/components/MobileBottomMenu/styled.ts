import styled from 'styled-components';
import { theme } from '@/styles/theme';

/**
 * Height of the mobile bottom menu content area (padding + icon size + padding).
 * Used by other components to reserve space so the fixed menu doesn't overlap content.
 */
export const MOBILE_BOTTOM_MENU_HEIGHT = '3.75rem';

export const MenuWrapper = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: ${theme.zIndex.mobileMenu};
  padding-bottom: env(safe-area-inset-bottom, 0px);
`;

export const ContentArea = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
`;
