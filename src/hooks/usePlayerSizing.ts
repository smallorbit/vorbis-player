import { useState, useEffect, useCallback, useRef } from 'react';
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
import {
  detectBrowserFeatures,
  getEnhancedViewportInfo,
  createEnhancedEventListeners,
  type BrowserFeatures
} from '../utils/featureDetection';

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
  // Progressive enhancement features
  browserFeatures: BrowserFeatures;
  compatibilityScore: number;
  supportsContainerQueries: boolean;
  supportsBackdropFilter: boolean;
  supportsVisualViewport: boolean;
}

export const usePlayerSizing = (constraints?: SizingConstraints): UsePlayerSizingReturn => {
  // Detect browser features once
  const [browserFeatures] = useState<BrowserFeatures>(() => detectBrowserFeatures());
  
  // Get enhanced viewport info with fallbacks
  const [viewport, setViewport] = useState<ViewportInfo>(() => {
    if (browserFeatures.visualViewport || browserFeatures.devicePixelRatio) {
      return getEnhancedViewportInfo(browserFeatures);
    }
    return getViewportInfo();
  });
  
  const [dimensions, setDimensions] = useState<PlayerDimensions>(() => 
    calculatePlayerDimensions(viewport, constraints)
  );

  const updateDimensions = useCallback(() => {
    const newViewport: ViewportInfo = browserFeatures.visualViewport || browserFeatures.devicePixelRatio 
      ? getEnhancedViewportInfo(browserFeatures)
      : getViewportInfo();
    const newDimensions = calculatePlayerDimensions(newViewport, constraints);
    
    setViewport(newViewport);
    setDimensions(newDimensions);
  }, [constraints, browserFeatures]);

  // Debounced resize handler with smooth transitions
  const debouncedUpdateDimensions = useCallback(() => {
    const newViewport: ViewportInfo = browserFeatures.visualViewport || browserFeatures.devicePixelRatio 
      ? getEnhancedViewportInfo(browserFeatures)
      : getViewportInfo();
    const newDimensions = calculatePlayerDimensions(newViewport, constraints);
    
    setViewport(newViewport);
    setDimensions(newDimensions);
  }, [constraints, browserFeatures]);

  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const handleResize = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      debouncedUpdateDimensions();
    }, 150);
  }, [debouncedUpdateDimensions]);

  useEffect(() => {
    // Initial calculation
    updateDimensions();

    // Use enhanced event listeners with fallbacks
    const cleanup = createEnhancedEventListeners(browserFeatures, handleResize);
    
    // Cleanup
    return cleanup;
  }, [handleResize, updateDimensions, browserFeatures]);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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

  // Progressive enhancement features
  const compatibilityScore = Math.round(
    (Object.values(browserFeatures).filter(Boolean).length / Object.keys(browserFeatures).length) * 100
  );
  const supportsContainerQueries = browserFeatures.containerQueries;
  const supportsBackdropFilter = browserFeatures.backdropFilter;
  const supportsVisualViewport = browserFeatures.visualViewport;

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
    transitionEasing,
    // Progressive enhancement features
    browserFeatures,
    compatibilityScore,
    supportsContainerQueries,
    supportsBackdropFilter,
    supportsVisualViewport
  };
};
