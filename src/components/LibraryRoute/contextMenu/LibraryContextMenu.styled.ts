import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const VirtualAnchor = styled.div`
  position: fixed;
  width: 0;
  height: 0;
  pointer-events: none;
`;

export const MenuRoot = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 200px;
  padding: ${theme.spacing.xs};
  gap: 1px;
`;

export const MenuItemButton = styled.button<{ $variant?: 'default' | 'destructive' }>`
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  font-size: ${theme.fontSize?.sm ?? '0.875rem'};
  color: ${({ $variant }) =>
    $variant === 'destructive' ? theme.colors.menu.destructiveText : theme.colors.foreground};
  border-radius: ${theme.borderRadius.md};
  cursor: pointer;
  transition: background 80ms ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
  }

  &:focus-visible:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    outline: 2px solid rgba(255, 255, 255, 0.6);
    outline-offset: -2px;
    border-radius: ${theme.borderRadius.md};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
