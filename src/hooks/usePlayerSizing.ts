import { useState, useEffect, useCallback, useRef } from 'react';
import type { 
  ViewportInfo, 
  PlayerDimensions, 
  SizingConstraints
} from '../utils/sizingUtils';
import {
  getViewportInfo,
  calculatePlayerDimensions,
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

interface UsePlayerSizingReturn {
  dimensions: PlayerDimensions;
  viewport: ViewportInfo;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** True when primary input is pointer (mouse/stylus) or device can hover; enables arrow-key drawer shortcuts */
  hasPointerInput: boolean;
  /**
   * True when the device's primary input is touch (finger), not a mouse or fine pointer.
   * Use this for interaction decisions: enabling swipe gestures, touch-action styles, etc.
   * Derived from CSS media queries (pointer: coarse / hover: none), so it correctly identifies
   * high-resolution tablets as touch devices regardless of their viewport width.
   * Contrast with isMobile/isTablet/isDesktop, which are viewport-based and should be used
   * only for layout/spacing decisions.
   */
  isTouchDevice: boolean;
  orientation: 'portrait' | 'landscape';
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

  useEffect(() => {
    // Initial calculation
    updateDimensions();

    // Use enhanced event listeners with fallbacks
    const cleanup = createEnhancedEventListeners(browserFeatures, debouncedUpdateDimensions);
    
    // Cleanup
    return cleanup;
  }, [debouncedUpdateDimensions, updateDimensions, browserFeatures]);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    const timeoutId = timeoutRef.current;
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  // Pointer/touch input detection: true when user has mouse or precise pointer (not touch-only)
  const [hasPointerInput, setHasPointerInput] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return (
      window.matchMedia('(pointer: fine)').matches ||
      window.matchMedia('(hover: hover)').matches
    );
  });

  useEffect(() => {
    if (!browserFeatures.matchMedia) return;
    const pointerFine = window.matchMedia('(pointer: fine)');
    const hoverHover = window.matchMedia('(hover: hover)');
    const update = () => {
      setHasPointerInput(pointerFine.matches || hoverHover.matches);
    };
    pointerFine.addEventListener('change', update);
    hoverHover.addEventListener('change', update);
    update(); // sync initial state
    return () => {
      pointerFine.removeEventListener('change', update);
      hoverHover.removeEventListener('change', update);
    };
  }, [browserFeatures.matchMedia]);

  // Calculate derived values
  const isMobile = viewport.width < 700;
  const isTablet = viewport.width >= 700 && viewport.width < 1024;
  const isDesktop = viewport.width >= 1024;
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
    hasPointerInput,
    isTouchDevice: !hasPointerInput,
    orientation: viewport.orientation,
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
