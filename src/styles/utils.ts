import { css } from 'styled-components';
import { theme } from './theme';

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

export const glassMorphism = css`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
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
  background-color: ${theme.colors.muted.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  padding: ${theme.spacing.sm};
  box-shadow: ${theme.shadows.sm};
`;

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

export const textShadow = css`
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
`;

export const truncateText = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

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

export const overlayBase = css`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: ${theme.zIndex.overlay};
`;

export const overlayLight = css`
  ${overlayBase}
  background: ${theme.colors.overlay.light};
  backdrop-filter: blur(2px);
`;

export const overlayDark = css`
  ${overlayBase}
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(20px);
`;

export const drawerBase = css`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: ${theme.zIndex.modal};
  overflow-y: auto;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`;

export const drawerContainer = css`
  ${drawerBase}
  width: 400px;
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(20px);
  border-left: 1px solid ${theme.colors.popover.border};
  
  @media (max-width: ${theme.breakpoints.sm}) {
    width: 100vw;
  }
`;

export const controlButtonBase = css`
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  
  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }
`;

export const controlButtonInactive = css`
  ${controlButtonBase}
  background: ${theme.colors.control.background};
  color: ${theme.colors.white};
  
  &:hover {
    background: ${theme.colors.control.backgroundHover};
  }
`;

export const controlButtonActive = css<{ accentColor: string }>`
  ${controlButtonBase}
  background: ${(props: { accentColor: string }) => props.accentColor};
  color: ${theme.colors.white};
  
  &:hover {
    background: ${(props: { accentColor: string }) => props.accentColor}4D;
  }
`;

export const popoverBase = css`
  background: ${theme.colors.popover.background};
  border-radius: ${theme.borderRadius.xl};
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
  border: 1px solid ${theme.colors.popover.border};
  z-index: ${theme.zIndex.popover};
`;

export const closeButton = css`
  background: none;
  border: none;
  color: ${theme.colors.muted.foreground};
  cursor: pointer;
  padding: ${theme.spacing.xs};
  border-radius: ${theme.borderRadius.md};
  transition: all 0.2s ease;
  
  &:hover {
    color: ${theme.colors.white};
    background: ${theme.colors.muted.background};
  }
  
  svg {
    width: 1rem;
    height: 1rem;
  }
`;

export const sliderBase = css<{ accentColor: string }>`
  appearance: none;
  width: 100%;
  height: 4px;
  background: ${theme.colors.control.background};
  border-radius: ${theme.borderRadius.sm};
  outline: none;
  cursor: pointer;
  
  &::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: ${(props: { accentColor: string }) => props.accentColor};
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }
  
  &::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 4px ${(props: { accentColor: string }) => props.accentColor}33;
  }
  
  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: ${(props: { accentColor: string }) => props.accentColor};
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }
  
  &::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 4px ${(props: { accentColor: string }) => props.accentColor}33;
  }
`;
