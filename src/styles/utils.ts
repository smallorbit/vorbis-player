import { css } from 'styled-components';
import { theme } from './theme';

export const flexCenter = css`
  display: flex;
  justify-content: center;
  align-items: center;
`;

export const flexColumn = css`
  display: flex;
  flex-direction: column;
`;

export const buttonBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${theme.borderRadius.lg};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  transition: ${theme.transitions.normal};
  cursor: pointer;
  border: none;
  outline: none;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const buttonPrimary = css`
  ${buttonBase}
  background-color: ${theme.colors.primary};
  color: ${theme.colors.white};
  
  &:hover:not(:disabled) {
    background-color: ${theme.colors.primaryHover};
  }
`;

export const buttonSecondary = css`
  ${buttonBase}
  background-color: ${theme.colors.secondary};
  color: ${theme.colors.white};
  
  &:hover:not(:disabled) {
    background-color: ${theme.colors.secondaryHover};
  }
`;

export const buttonOutline = css`
  ${buttonBase}
  background-color: transparent;
  color: ${theme.colors.foreground};
  border: 1px solid ${theme.colors.border};
  
  &:hover:not(:disabled) {
    background-color: ${theme.colors.muted.background};
    border-color: ${theme.colors.borderHover};
  }
`;

export const buttonGhost = css`
  ${buttonBase}
  background-color: transparent;
  color: ${theme.colors.foreground};
  
  &:hover:not(:disabled) {
    background-color: ${theme.colors.muted.background};
  }
`;

export const cardBase = css`
  
  box-shadow: ${theme.shadows.sm};
`;

export const customScrollbar = css`
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: ${theme.colors.muted.background};
    border-radius: ${theme.borderRadius.md};
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${theme.colors.gray[600]};
    border-radius: ${theme.borderRadius.md};
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: ${theme.colors.gray[500]};
  }
`;