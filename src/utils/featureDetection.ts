/**
 * Feature Detection Utilities for Progressive Enhancement
 * Provides fallbacks for modern browser features
 */

import type { ViewportInfo } from './sizingUtils';

// Type definition for Window with Visual Viewport API support
interface WindowWithVisualViewport extends Window {
  visualViewport: VisualViewport | null;
}

export interface BrowserFeatures {
  visualViewport: boolean;
  containerQueries: boolean;
  backdropFilter: boolean;
  cssCustomProperties: boolean;
  cssGrid: boolean;
  cssFlexbox: boolean;
  cssGap: boolean;
  cssClamp: boolean;
  cssAspectRatio: boolean;
  cssLogicalProperties: boolean;
  cssScrollBehavior: boolean;
  cssFocusVisible: boolean;
  cssIs: boolean;
  cssHas: boolean;
  cssColorMix: boolean;
  cssRelativeColors: boolean;
  cssAnchorPositioning: boolean;
  cssViewportUnits: boolean;
  cssSubgrid: boolean;
  intersectionObserver: boolean;
  resizeObserver: boolean;
  requestAnimationFrame: boolean;
  matchMedia: boolean;
  devicePixelRatio: boolean;
}

/**
 * Detect browser feature support
 */
export const detectBrowserFeatures = (): BrowserFeatures => {
  const features: BrowserFeatures = {
    // Visual Viewport API
    visualViewport: 'visualViewport' in window && !!(window as WindowWithVisualViewport).visualViewport,
    
    // CSS Container Queries
    containerQueries: CSS.supports('container-type', 'inline-size'),
    
    // CSS Backdrop Filter
    backdropFilter: CSS.supports('backdrop-filter', 'blur(10px)'),
    
    // CSS Custom Properties
    cssCustomProperties: CSS.supports('--css', 'variables'),
    
    // CSS Grid
    cssGrid: CSS.supports('display', 'grid'),
    
    // CSS Flexbox
    cssFlexbox: CSS.supports('display', 'flex'),
    
    // CSS Gap
    cssGap: CSS.supports('gap', '1rem'),
    
    // CSS clamp()
    cssClamp: CSS.supports('font-size', 'clamp(1rem, 2vw, 2rem)'),
    
    // CSS aspect-ratio
    cssAspectRatio: CSS.supports('aspect-ratio', '16/9'),
    
    // CSS Logical Properties
    cssLogicalProperties: CSS.supports('margin-inline-start', '1rem'),
    
    // CSS scroll-behavior
    cssScrollBehavior: CSS.supports('scroll-behavior', 'smooth'),
    
    // CSS :focus-visible
    cssFocusVisible: CSS.supports('selector(:focus-visible)'),
    
    // CSS :is()
    cssIs: CSS.supports('selector(:is(button, input))'),
    
    // CSS :has()
    cssHas: CSS.supports('selector(:has(button))'),
    
    // CSS color-mix()
    cssColorMix: CSS.supports('color', 'color-mix(in srgb, red, blue)'),
    
    // CSS relative color syntax
    cssRelativeColors: CSS.supports('color', 'rgb(from red r g b)'),
    
    // CSS anchor positioning
    cssAnchorPositioning: CSS.supports('anchor-name', '--anchor'),
    
    // CSS viewport units (100dvh, 100dvw, etc.)
    cssViewportUnits: CSS.supports('height', '100dvh'),
    
    // CSS subgrid
    cssSubgrid: CSS.supports('display', 'subgrid'),
    
    // JavaScript APIs
    intersectionObserver: 'IntersectionObserver' in window,
    resizeObserver: 'ResizeObserver' in window,
    requestAnimationFrame: 'requestAnimationFrame' in window,
    matchMedia: 'matchMedia' in window,
    devicePixelRatio: 'devicePixelRatio' in window,
  };

  return features;
};

/**
 * Get fallback values for unsupported features
 */
export const getFallbackValues = (features: BrowserFeatures) => {
  return {
    // Viewport fallbacks
    getViewportWidth: () => {
      if (features.visualViewport && (window as WindowWithVisualViewport).visualViewport) {
        return (window as WindowWithVisualViewport).visualViewport!.width || window.innerWidth;
      }
      return window.innerWidth;
    },
    
    getViewportHeight: () => {
      if (features.visualViewport && (window as WindowWithVisualViewport).visualViewport) {
        return (window as WindowWithVisualViewport).visualViewport!.height || window.innerHeight;
      }
      return window.innerHeight;
    },
    
    // CSS fallbacks
    getContainerQueryFallback: (containerName: string, minWidth: number) => {
      if (features.containerQueries) {
        return `@container ${containerName} (min-width: ${minWidth}px)`;
      }
      return `@media (min-width: ${minWidth}px)`;
    },
    
    getBackdropFilterFallback: (blurAmount: number) => {
      if (features.backdropFilter) {
        return `backdrop-filter: blur(${blurAmount}px)`;
      }
      const opacity = Math.min(blurAmount / 20, 0.4);
      return `background-color: rgba(0, 0, 0, ${opacity})`;
    },
    
    getCustomPropertyFallback: (property: string, fallbackValue: string) => {
      if (features.cssCustomProperties) {
        return `var(${property}, ${fallbackValue})`;
      }
      return fallbackValue;
    },
    
    getGapFallback: (gapValue: string) => {
      if (features.cssGap) {
        return `gap: ${gapValue}`;
      }
      return `margin: calc(${gapValue} / 2)`;
    },
    
    getAspectRatioFallback: (ratio: string) => {
      if (features.cssAspectRatio) {
        return `aspect-ratio: ${ratio}`;
      }
      // Use padding-bottom trick for aspect ratio
      const [width, height] = ratio.split('/').map(Number);
      const percentage = (height / width) * 100;
      return `padding-bottom: ${percentage}%`;
    },
    
    getViewportUnitFallback: (unit: string) => {
      if (features.cssViewportUnits) {
        return unit;
      }
      return unit.replace('dvh', 'vh').replace('dvw', 'vw');
    },
  };
};

/**
 * Enhanced viewport info with fallbacks
 */
export const getEnhancedViewportInfo = (features: BrowserFeatures): ViewportInfo => {
  const fallbacks = getFallbackValues(features);
  
  return {
    width: fallbacks.getViewportWidth(),
    height: fallbacks.getViewportHeight(),
    orientation: (fallbacks.getViewportWidth() > fallbacks.getViewportHeight() ? 'landscape' : 'portrait') as 'portrait' | 'landscape',
    devicePixelRatio: features.devicePixelRatio ? window.devicePixelRatio || 1 : 1
  };
};

/**
 * Create enhanced event listeners with fallbacks
 */
export const createEnhancedEventListeners = (
  features: BrowserFeatures,
  callback: () => void
) => {
  const listeners: Array<{ element: EventTarget; event: string; handler: () => void }> = [];
  
  // Standard resize listener
  const resizeHandler = () => callback();
  window.addEventListener('resize', resizeHandler);
  listeners.push({ element: window, event: 'resize', handler: resizeHandler });
  
  // Orientation change listener
  const orientationHandler = () => callback();
  window.addEventListener('orientationchange', orientationHandler);
  listeners.push({ element: window, event: 'orientationchange', handler: orientationHandler });
  
  // Visual Viewport API listener (if supported)
  if (features.visualViewport && (window as WindowWithVisualViewport).visualViewport) {
    const visualViewport = (window as WindowWithVisualViewport).visualViewport!;
    const visualViewportHandler = () => callback();
    visualViewport.addEventListener('resize', visualViewportHandler);
    visualViewport.addEventListener('scroll', visualViewportHandler);
    listeners.push({ element: visualViewport, event: 'resize', handler: visualViewportHandler });
    listeners.push({ element: visualViewport, event: 'scroll', handler: visualViewportHandler });
  }
  
  // ResizeObserver (if supported)
  if (features.resizeObserver) {
    const resizeObserver = new ResizeObserver(() => callback());
    resizeObserver.observe(document.body);
    listeners.push({ element: document.body, event: 'observe', handler: () => resizeObserver.disconnect() });
  }
  
  // Return cleanup function
  return () => {
    listeners.forEach(({ element, event, handler }) => {
      if (event === 'observe') {
        handler();
      } else if (element && typeof element === 'object' && 'removeEventListener' in element) {
        (element as { removeEventListener: (event: string, handler: () => void) => void }).removeEventListener(event, handler);
      }
    });
  };
};


