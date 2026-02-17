import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const FabOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${theme.zIndex.mobileMenu};
`;

export const FabContainer = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: ${parseInt(theme.zIndex.mobileMenu) + 1};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};

  @media (max-width: ${theme.breakpoints.lg}) {
    right: 12px;
    bottom: 16px;
  }
`;

export const FabButton = styled.button<{ $isOpen: boolean; $accentColor: string }>`
  width: 56px;
  height: 56px;
  border-radius: ${theme.borderRadius.full};
  border: 1px solid ${theme.colors.popover.border};
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(${theme.drawer.backdropBlur});
  color: ${theme.colors.white};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-shadow: ${theme.shadows.lg};

  svg {
    transition: transform ${theme.transitions.normal};
    transform: ${({ $isOpen }) => ($isOpen ? 'rotate(45deg)' : 'rotate(0deg)')};
  }

  &:hover {
    background: ${theme.colors.control.backgroundHover};
  }
`;

export const FabMenuItem = styled.div<{
  $isOpen: boolean;
  $openDelay: number;
  $closeDelay: number;
}>`
  position: relative;
  transform: ${({ $isOpen }) => ($isOpen ? 'scale(1)' : 'scale(0)')};
  opacity: ${({ $isOpen }) => ($isOpen ? 1 : 0)};
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s ease;
  transition-delay: ${({ $isOpen, $openDelay, $closeDelay }) =>
    $isOpen ? `${$openDelay}ms` : `${$closeDelay}ms`};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const FabMenuItemTooltip = styled.span`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  margin-bottom: 8px;
  padding: 4px 8px;
  background: ${theme.colors.popover.background};
  border-radius: ${theme.borderRadius.md};
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.white};
  opacity: 0;
  transition: opacity ${theme.transitions.fast};
  pointer-events: none;

  *:hover > &,
  *:focus-within > & {
    opacity: 1;
  }

  @media (max-width: ${theme.breakpoints.lg}) {
    display: none;
  }
`;
