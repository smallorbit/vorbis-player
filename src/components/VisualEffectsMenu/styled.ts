import styled from 'styled-components';
import { theme } from '../../styles/theme';
import { getContrastColor } from '../../utils/colorUtils';

export const DrawerOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${theme.colors.overlay.light};
  z-index: ${theme.zIndex.overlay};
  opacity: ${({ $isOpen }) => ($isOpen ? '1' : '0')};
  pointer-events: ${({ $isOpen }) => ($isOpen ? 'auto' : 'none')};
  transition: all ${theme.drawer.transitionDuration}ms ${theme.drawer.transitionEasing};
`;

export const DrawerContainer = styled.div<{ $isOpen: boolean; $width: number; $transitionDuration: number; $transitionEasing: string }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: ${({ $width }) => $width}px;
  max-width: 95vw; 
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(${theme.drawer.backdropBlur});
  border-left: 1px solid ${theme.colors.popover.border};
  transform: translateX(${({ $isOpen }) => ($isOpen ? '0' : '100%')});
  transition: all ${({ $transitionDuration }) => $transitionDuration}ms ${({ $transitionEasing }) => $transitionEasing},
            width ${({ $transitionDuration }) => $transitionDuration}ms ${({ $transitionEasing }) => $transitionEasing};
  z-index: ${theme.zIndex.modal};
  overflow-y: auto;
  overflow-x: hidden; 
  
  /* Enable container queries */
  container-type: inline-size;
  container-name: visual-effects;
  
  /* Container query responsive adjustments */
  @container visual-effects (max-width: ${theme.drawer.breakpoints.mobile}) {
    width: ${theme.drawer.widths.mobile};
  }
  
  @container visual-effects (min-width: ${theme.drawer.breakpoints.mobile}) and (max-width: ${theme.drawer.breakpoints.tablet}) {
    width: ${theme.drawer.widths.tablet};
  }
  
  @container visual-effects (min-width: ${theme.drawer.breakpoints.tablet}) {
    width: ${theme.drawer.widths.desktop};
  }
  
  /* Fallback for browsers without container query support */
  @supports not (container-type: inline-size) {
    @media (max-width: ${theme.breakpoints.md}) {
      width: ${theme.drawer.widths.mobile};
    }
  }
`;

export const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.lg} ${theme.spacing.lg} ${theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.popover.border};
  min-height: 60px; 
  flex-shrink: 0; /* Prevent header from shrinking */
`;

export const DrawerTitle = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.lg};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.foreground};
`;

export const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.muted.foreground};
  cursor: pointer;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  transition: all ${({ theme }) => theme.transitions.fast} ease;
  
  &:hover {
    color: ${theme.colors.white};
    background: ${theme.colors.muted.background};
  }
  
  svg {
    width: 1rem;
    height: 1rem;
  }
`;

export const DrawerContent = styled.div`
  padding: ${({ theme }) => theme.spacing.md} ${theme.spacing.lg} ${theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const ControlLabel = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.muted.foreground};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
`;

export const FilterSection = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.popover.border};
  padding-top: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

export const SectionTitle = styled.h4`
  margin: 0 0 ${({ theme }) => theme.spacing.lg} 0;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.muted.foreground};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const FilterGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const VirtualListContainer = styled.div`
  width: 100%;
  height: 100%;
  border: 1px solid ${({ theme }) => theme.colors.popover.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
  transform: translateZ(0);
  will-change: scroll-position;
`;

export const FilterItem = styled.div`
  padding: ${({ theme }) => theme.spacing.sm} ${theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.popover.border};
  
  &:last-child {
    border-bottom: none;
  }
`;

export const ResetButton = styled.button<{ $accentColor: string }>`
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.muted.foreground};
  padding: ${({ theme }) => theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  transition: all ${({ theme }) => theme.transitions.fast};
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing.lg};
  
  &:hover {
    background: ${({ $accentColor }) => $accentColor}22;
    border-color: ${({ $accentColor }) => $accentColor}44;
    color: ${({ theme }) => theme.colors.foreground};
    transform: translateY(-1px);
  }
`;

export const OptionButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

export const OptionButton = styled.button<{ $accentColor: string; $isActive: boolean }>`
  background: ${({ $isActive, $accentColor }: { $isActive: boolean; $accentColor: string }) => $isActive ? $accentColor : theme.colors.muted.background};
  border: 1px solid ${({ $isActive, $accentColor }: { $isActive: boolean; $accentColor: string }) => $isActive ? $accentColor : theme.colors.border};
  color: ${({ $isActive, $accentColor }: { $isActive: boolean; $accentColor: string }) => $isActive ? getContrastColor($accentColor) : theme.colors.muted.foreground};
  padding: 0.375rem 0.75rem;
  border-radius: ${theme.borderRadius.sm};
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: ${theme.fontWeight.medium};
  transition: all ${({ theme }) => theme.transitions.fast} ease;
  min-width: 60px;
  
  &:hover {
    background: ${({ $isActive, $accentColor }: { $isActive: boolean; $accentColor: string }) => $isActive ? $accentColor + 'DD' : $accentColor + '22'};
    border-color: ${({ $accentColor }: { $accentColor: string }) => $accentColor};
    color: ${({ $isActive, $accentColor }: { $isActive: boolean; $accentColor: string }) => $isActive ? getContrastColor($accentColor) : theme.colors.white};
    transform: translateY(-1px);
  }
`;


