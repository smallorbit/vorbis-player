import styled from 'styled-components';
import { theme } from '@/styles/theme';

interface MenuWrapperProps {
  $isExpanded: boolean;
  $isDragging: boolean;
  $dragOffset: number;
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
  transform: ${({ $isExpanded, $isDragging, $dragOffset }) => {
    if ($isDragging) {
      if ($isExpanded) {
        // Expanded base is translateY(0), allow dragging down
        return `translateY(${$dragOffset}px)`;
      }
      // Collapsed base is translateY(calc(100% - 32px)), allow dragging up
      return `translateY(calc(100% - 32px + ${$dragOffset}px))`;
    }
    return $isExpanded ? 'translateY(0)' : 'translateY(calc(100% - 32px))';
  }};
  transition: ${({ $isDragging, $transitionDuration, $transitionEasing }) =>
    $isDragging ? 'none' : `transform ${$transitionDuration}ms ${$transitionEasing}`};
  will-change: ${({ $isDragging }) => ($isDragging ? 'transform' : 'auto')};
`;

export const HandleArea = styled.div`
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: none;
  padding: 8px 0;
  background: transparent;
  border: none;
`;

export const PillIndicator = styled.div`
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
`;

export const ContentArea = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
`;
