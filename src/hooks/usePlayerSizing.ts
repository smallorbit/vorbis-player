import { useState, useEffect, useCallback } from 'react';
import type { 
  ViewportInfo, 
  PlayerDimensions, 
  SizingConstraints
} from '../utils/sizingUtils';
import {
  getViewportInfo,
  calculatePlayerDimensions,
  getResponsiveBreakpoint,
  shouldUseFluidSizing,
  calculateOptimalPadding,
  getOptimalAspectRatio,
  calculateAspectRatioConstraints
} from '../utils/sizingUtils';

export interface UsePlayerSizingReturn {
  dimensions: PlayerDimensions;
  viewport: ViewportInfo;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  breakpoint: string;
  useFluidSizing: boolean;
  padding: number;
  aspectRatio: number;
  optimalAspectRatio: number;
  aspectRatioConstraints: { min: number; max: number };
  updateDimensions: () => void;
  transitionDuration: number;
  transitionEasing: string;
}

// Debounce utility
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const usePlayerSizing = (constraints?: SizingConstraints): UsePlayerSizingReturn => {
  const [viewport, setViewport] = useState<ViewportInfo>(() => getViewportInfo());
  const [dimensions, setDimensions] = useState<PlayerDimensions>(() => 
    calculatePlayerDimensions(getViewportInfo(), constraints)
  );

  const updateDimensions = useCallback(() => {
    const newViewport = getViewportInfo();
    const newDimensions = calculatePlayerDimensions(newViewport, constraints);
    
    setViewport(newViewport);
    setDimensions(newDimensions);
  }, [constraints]);

  // Debounced resize handler with smooth transitions
  const handleResize = useCallback(
    debounce(updateDimensions, 150), // Slightly longer debounce for smoother transitions
    [updateDimensions]
  );

  useEffect(() => {
    // Initial calculation
    updateDimensions();

    // Add event listeners for viewport changes
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    // Add visual viewport API support for mobile browsers
    if ('visualViewport' in window) {
      const visualViewport = (window as any).visualViewport;
      if (visualViewport) {
        visualViewport.addEventListener('resize', handleResize);
        visualViewport.addEventListener('scroll', handleResize);
      }
    }
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      
      if ('visualViewport' in window) {
        const visualViewport = (window as any).visualViewport;
        if (visualViewport) {
          visualViewport.removeEventListener('resize', handleResize);
          visualViewport.removeEventListener('scroll', handleResize);
        }
      }
    };
  }, [handleResize, updateDimensions]);

  // Calculate derived values
  const isMobile = viewport.width < 768;
  const isTablet = viewport.width >= 768 && viewport.width < 1024;
  const isDesktop = viewport.width >= 1024;
  const breakpoint = getResponsiveBreakpoint(viewport);
  const useFluidSizing = shouldUseFluidSizing(viewport);
  const padding = calculateOptimalPadding(viewport);
  const aspectRatio = dimensions.aspectRatio;
  const optimalAspectRatio = getOptimalAspectRatio(viewport);
  const aspectRatioConstraints = calculateAspectRatioConstraints(viewport);
  
  // Transition configuration
  const transitionDuration = 300; // 300ms for smooth transitions
  const transitionEasing = 'cubic-bezier(0.4, 0, 0.2, 1)'; // Material Design easing

  return {
    dimensions,
    viewport,
    isMobile,
    isTablet,
    isDesktop,
    orientation: viewport.orientation,
    breakpoint,
    useFluidSizing,
    padding,
    aspectRatio,
    optimalAspectRatio,
    aspectRatioConstraints,
    updateDimensions,
    transitionDuration,
    transitionEasing
  };
};
