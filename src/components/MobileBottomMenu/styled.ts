import styled from 'styled-components';
import { theme } from '@/styles/theme';

interface MenuWrapperProps {
  $isExpanded: boolean;
  $transitionDuration: number;
  $transitionEasing: string;
}

export const MenuWrapper = styled.div<MenuWrapperProps>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: ${theme.zIndex.mobileMenu};
  border-radius: 16px 16px 0 0;
  background: rgba(30, 30, 30, 0.92);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.35);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  transform: ${({ $isExpanded }) => ($isExpanded ? 'translateY(0)' : 'translateY(100%)')};
  transition: transform ${({ $transitionDuration, $transitionEasing }) =>
    `${$transitionDuration}ms ${$transitionEasing}`};
`;

export const ContentArea = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
`;
