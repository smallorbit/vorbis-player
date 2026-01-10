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
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  min-height: 60px; 
  flex-shrink: 0; /* Prevent header from shrinking */
`;

export const DrawerTitle = styled.h3`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
`;

export const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.muted.foreground};
  cursor: pointer;
  padding: ${theme.spacing.sm};
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

export const DrawerContent = styled.div`
  padding: 1rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

export const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

export const ControlLabel = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
`;

export const FilterSection = styled.div`
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 1rem;
  margin-top: 0.5rem;
`;

export const SectionTitle = styled.h4`
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const FilterGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

export const VirtualListContainer = styled.div`
  width: 100%;
  height: 100%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  overflow: hidden;
  /* Hardware acceleration for smooth scrolling */
  transform: translateZ(0);
  will-change: scroll-position;
`;

export const FilterItem = styled.div`
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  
  &:last-child {
    border-bottom: none;
  }
`;

export const ResetButton = styled.button<{ $accentColor: string }>`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all ${theme.transitions.fast};
  width: 100%;
  margin-top: 0.75rem;
  
  &:hover {
    background: ${({ $accentColor }) => $accentColor}22;
    border-color: ${({ $accentColor }) => $accentColor}44;
    color: rgba(255, 255, 255, 0.9);
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
  transition: all 0.2s ease;
  min-width: 60px;
  
  &:hover {
    background: ${({ $isActive, $accentColor }: { $isActive: boolean; $accentColor: string }) => $isActive ? $accentColor + 'DD' : $accentColor + '22'};
    border-color: ${({ $accentColor }: { $accentColor: string }) => $accentColor};
    color: ${({ $isActive, $accentColor }: { $isActive: boolean; $accentColor: string }) => $isActive ? getContrastColor($accentColor) : theme.colors.white};
    transform: translateY(-1px);
  }
`;

export const IntensitySlider = styled.input<{ $accentColor: string }>`
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: ${theme.colors.gray[600]};
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${({ $accentColor }) => $accentColor};
    border: 2px solid ${theme.colors.white};
    cursor: pointer;
    transition: transform 0.1s ease;
    margin-top: -6px; /* Center the thumb vertically: (16px thumb - 4px track) / 2 = 6px */
    
    &:hover {
      transform: scale(1.1);
    }
  }
  
  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${({ $accentColor }) => $accentColor};
    border: 2px solid ${theme.colors.white};
    cursor: pointer;
    transition: transform 0.1s ease;
    border: none; /* Remove default border for Firefox */
    box-shadow: 0 0 0 2px ${theme.colors.white}; /* Use box-shadow instead for better centering */
    
    &:hover {
      transform: scale(1.1);
    }
  }
  
  &::-webkit-slider-runnable-track {
    height: 4px;
    background: linear-gradient(
      to right,
      ${({ $accentColor }) => $accentColor} 0%,
      ${({ $accentColor }) => $accentColor} var(--slider-value, 0%),
      ${theme.colors.gray[600]} var(--slider-value, 0%),
      ${theme.colors.gray[600]} 100%
    );
    border-radius: 2px;
  }
  
  &::-moz-range-track {
    height: 4px;
    background: ${theme.colors.gray[600]};
    border-radius: 2px;
  }
  
  &::-moz-range-progress {
    height: 4px;
    background: ${({ $accentColor }) => $accentColor};
    border-radius: 2px;
  }
`;

export const IntensityValue = styled.span`
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  min-width: 3rem;
  text-align: right;
`;

