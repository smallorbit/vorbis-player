import styled from 'styled-components';
import { theme } from '@/styles/theme';

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
  padding: ${theme.spacing.md} ${theme.spacing.md};
`;
