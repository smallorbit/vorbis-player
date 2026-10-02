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

export const buttonCta = css`
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
  background-color: ${theme.colors.cta};
  color: ${theme.colors.foregroundDark};

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background-color: ${theme.colors.ctaHover};
  }
`;

export const cardBase = css`
  background-color: ${theme.colors.muted.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  padding: ${theme.spacing.sm};
  margin: ${theme.spacing.sm};
  margin-top: ${theme.spacing.md}; 
  box-shadow: ${theme.shadows.sm};
`;

export const srOnly = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

export const customScrollbar = css`
  &::-webkit-scrollbar {
    width: ${theme.spacing.sm};
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