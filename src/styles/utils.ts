import { css } from 'styled-components';
import { theme } from './theme';

// Common flexbox utilities
export const flexCenter = css`
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const flexBetween = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const flexColumn = css`
  display: flex;
  flex-direction: column;
`;

export const flexRow = css`
  display: flex;
  flex-direction: row;
`;

// Common positioning
export const absoluteCenter = css`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

export const fullSize = css`
  width: 100%;
  height: 100%;
`;

// Glass morphism effect
export const glassMorphism = css`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

// Button variants
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

// Card styles
export const cardBase = css`
  background-color: ${theme.colors.muted.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  padding: ${theme.spacing.sm};
  box-shadow: ${theme.shadows.sm};
`;

// Input styles
export const inputBase = css`
  display: flex;
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background-color: ${theme.colors.muted.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  color: ${theme.colors.foreground};
  font-size: ${theme.fontSize.sm};
  transition: ${theme.transitions.normal};
  
  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
    box-shadow: 0 0 0 2px rgba(100, 108, 255, 0.2);
  }
  
  &::placeholder {
    color: ${theme.colors.muted.foreground};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Text utilities
export const textShadow = css`
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
`;

export const truncateText = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// Animation utilities
export const fadeIn = css`
  opacity: 0;
  animation: fadeIn 0.3s ease-in-out forwards;
  
  @keyframes fadeIn {
    to {
      opacity: 1;
    }
  }
`;

export const slideUp = css`
  transform: translateY(20px);
  opacity: 0;
  animation: slideUp 0.3s ease-out forwards;
  
  @keyframes slideUp {
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

// Hover effects
export const hoverScale = css`
  transition: transform ${theme.transitions.fast};
  
  &:hover {
    transform: scale(1.05);
  }
`;

export const hoverGlow = css`
  transition: box-shadow ${theme.transitions.normal};
  
  &:hover {
    box-shadow: 0 0 20px rgba(100, 108, 255, 0.3);
  }
`;

// Screen reader only
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

// Responsive helpers
export const hideOnMobile = css`
  @media (max-width: ${theme.breakpoints.md}) {
    display: none;
  }
`;

export const showOnMobile = css`
  @media (min-width: ${theme.breakpoints.md}) {
    display: none;
  }
`;

// Scrollbar styling
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
