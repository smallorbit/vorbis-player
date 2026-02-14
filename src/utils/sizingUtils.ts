import { theme } from '@/styles/theme';

// Type definition for Window with Visual Viewport API support
interface WindowWithVisualViewport extends Window {
  visualViewport: VisualViewport | null;
}

export interface ViewportInfo {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  devicePixelRatio: number;
}

export interface PlayerDimensions {
  width: number;
  height: number;
  scale: number;
  aspectRatio: number;
}

export interface SizingConstraints {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  preferredAspectRatio?: number;
  allowAspectRatioAdjustment?: boolean;
  minAspectRatio?: number;
  maxAspectRatio?: number;
}

/**
 * Creates default SizingConstraints from theme configuration
 * This bridges the gap between hardcoded theme values and the flexible SizingConstraints interface
 */
export const createDefaultSizingConstraints = (viewport: ViewportInfo): SizingConstraints & {
  viewportUsageWidth: number;
  viewportUsageHeight: number;
} => {
  const isMobile = viewport.width < parseInt(theme.breakpoints.lg);
  const viewportUsageWidth = isMobile ? 0.98 : theme.playerConstraints.viewportUsage.width;
  const viewportUsageHeight = isMobile ? 0.95 : theme.playerConstraints.viewportUsage.height;

  return {
    minWidth: parseInt(theme.breakpoints.xs),
    maxWidth: Math.min(viewport.width * viewportUsageWidth, isMobile ? viewport.width : parseInt(theme.breakpoints.lg)),
    minHeight: theme.playerConstraints.minHeight,
    maxHeight: Math.min(viewport.height * viewportUsageHeight, theme.playerConstraints.maxHeight),
    allowAspectRatioAdjustment: true,
    viewportUsageWidth,
    viewportUsageHeight,
    // These will be calculated by getOptimalAspectRatio and calculateAspectRatioConstraints
    preferredAspectRatio: undefined,
    minAspectRatio: undefined,
    maxAspectRatio: undefined
  };
};

export const getViewportInfo = (): ViewportInfo => {
  // Use visual viewport API if available (better for mobile browsers)
  let width: number;
  let height: number;
  
  if ('visualViewport' in window && (window as WindowWithVisualViewport).visualViewport) {
    const visualViewport = (window as WindowWithVisualViewport).visualViewport!;
    width = visualViewport.width || window.innerWidth;
    height = visualViewport.height || window.innerHeight;
  } else {
    width = window.innerWidth;
    height = window.innerHeight;
  }
  
  const orientation = width > height ? 'landscape' : 'portrait';
  
  return {
    width,
    height,
    orientation,
    devicePixelRatio: window.devicePixelRatio || 1
  };
};

export const calculatePlayerDimensions = (
  viewport: ViewportInfo,
  constraints: SizingConstraints = {}
): PlayerDimensions => {
  // Merge provided constraints with theme-based defaults
  const defaultConstraints = createDefaultSizingConstraints(viewport);
  const mergedConstraints = { ...defaultConstraints, ...constraints };
  
  

  // Get optimal aspect ratio for this viewport
  const optimalAspectRatio = mergedConstraints.preferredAspectRatio ?? getOptimalAspectRatio(viewport);
  
  // Get aspect ratio constraints
  const aspectRatioConstraints = calculateAspectRatioConstraints(viewport);
  const finalMinAspectRatio = mergedConstraints.minAspectRatio ?? aspectRatioConstraints.min;
  const finalMaxAspectRatio = mergedConstraints.maxAspectRatio ?? aspectRatioConstraints.max;

  // Calculate base dimensions based on viewport
  let width: number;
  let height: number;

  if (viewport.orientation === 'portrait') {
    // Portrait: prioritize height, calculate width from aspect ratio
    height = Math.min(viewport.height * mergedConstraints.viewportUsageHeight, mergedConstraints.maxHeight ?? 0);
    width = height * optimalAspectRatio;
    
    // Ensure width fits within viewport
    if (width > viewport.width * mergedConstraints.viewportUsageWidth) {
      width = viewport.width * mergedConstraints.viewportUsageWidth;
      height = width / optimalAspectRatio;
    }
  } else {
    // Landscape: prioritize width, calculate height from aspect ratio
    width = Math.min(viewport.width * mergedConstraints.viewportUsageWidth, mergedConstraints.maxWidth ?? 0);
    height = width / optimalAspectRatio;
    
    // Ensure height fits within viewport
    if (height > viewport.height * mergedConstraints.viewportUsageHeight) {
      height = viewport.height * mergedConstraints.viewportUsageHeight;
      width = height * optimalAspectRatio;
    }
  }

  // Apply basic constraints
  width = Math.max(mergedConstraints.minWidth ?? 0, Math.min(width, mergedConstraints.maxWidth ?? 0));
  height = Math.max(mergedConstraints.minHeight ?? 0, Math.min(height, mergedConstraints.maxHeight ?? 0));

  // Apply aspect ratio adjustments if enabled
  if (mergedConstraints.allowAspectRatioAdjustment) {
    const adjusted = adjustDimensionsForAspectRatio(
      width,
      height,
      { min: finalMinAspectRatio, max: finalMaxAspectRatio }
    );
    width = adjusted.width;
    height = adjusted.height;
  }

  // Calculate scale factor for responsive adjustments
  const scale = Math.min(1, viewport.width / parseInt(theme.breakpoints.lg));

  return {
    width: Math.round(width),
    height: Math.round(height),
    scale,
    aspectRatio: width / height
  };
};


export const shouldUseFluidSizing = (viewport: ViewportInfo): boolean => {
  // Use fluid sizing for screens smaller than desktop or very large screens
  return viewport.width < parseInt(theme.breakpoints.lg) || viewport.width > parseInt(theme.breakpoints['3xl']);
};

// Helper function to convert rem values to pixels
const remToPixels = (remValue: string): number => {
  const numericValue = parseFloat(remValue);
  return numericValue * 16; // 1rem = 16px
};

export const calculateOptimalPadding = (viewport: ViewportInfo): number => {
  // Responsive padding based on screen size — minimize on mobile to maximize album art
  const breakpoints = {
    xs: parseInt(theme.breakpoints.xs),
    sm: parseInt(theme.breakpoints.sm),
    md: parseInt(theme.breakpoints.md),
    lg: parseInt(theme.breakpoints.lg),
  };

  if (viewport.width < breakpoints.xs) return 2;  // 2px for very small screens
  if (viewport.width < breakpoints.sm) return 4;   // 4px for small phones
  if (viewport.width < breakpoints.md) return 6;   // 6px for standard phones
  if (viewport.width < breakpoints.lg) return 10;  // 10px for large phones / small tablets
  return remToPixels(theme.spacing.md);             // 16px for desktop
};

// Enhanced aspect ratio utilities
export const getOptimalAspectRatio = (viewport: ViewportInfo): number => {
  const viewportRatio = viewport.width / viewport.height;
  
  // Define aspect ratio ranges for different screen types
  if (viewportRatio < 0.75) {
    // Very tall screens (portrait phones, tablets)
    return 0.6;
  } else if (viewportRatio < 1.0) {
    // Standard portrait
    return 0.8;
  } else if (viewportRatio < 1.5) {
    // Square-ish or landscape tablets
    return 0.86;
  } else if (viewportRatio < 2.0) {
    // Standard landscape
    return 0.9;
  } else {
    // Ultra-wide screens
    return 1.2;
  }
};

export const calculateAspectRatioConstraints = (viewport: ViewportInfo): { min: number; max: number } => {
  const viewportRatio = viewport.width / viewport.height;
  
  // Define reasonable aspect ratio bounds based on viewport
  if (viewportRatio < 0.75) {
    // Very tall screens - allow wider ratios
    return { min: 0.5, max: 1.0 };
  } else if (viewportRatio < 1.0) {
    // Portrait - standard bounds
    return { min: 0.6, max: 0.9 };
  } else if (viewportRatio < 1.5) {
    // Square-ish - balanced bounds
    return { min: 0.7, max: 1.1 };
  } else if (viewportRatio < 2.0) {
    // Landscape - allow taller ratios
    return { min: 0.8, max: 1.3 };
  } else {
    // Ultra-wide - allow much taller ratios
    return { min: 1.0, max: 2.0 };
  }
};

export const adjustDimensionsForAspectRatio = (
  width: number,
  height: number,
  constraints: { min: number; max: number }
): { width: number; height: number; aspectRatio: number } => {
  const currentAspectRatio = width / height;
  
  // If current ratio is within constraints, use it
  if (currentAspectRatio >= constraints.min && currentAspectRatio <= constraints.max) {
    return { width, height, aspectRatio: currentAspectRatio };
  }
  
  // Calculate new dimensions based on target ratio
  let newWidth = width;
  let newHeight = height;
  
  if (currentAspectRatio < constraints.min) {
    // Too tall - increase width
    newWidth = height * constraints.min;
  } else if (currentAspectRatio > constraints.max) {
    // Too wide - increase height
    newHeight = width / constraints.max;
  }
  
  const finalAspectRatio = newWidth / newHeight;
  
  return {
    width: Math.round(newWidth),
    height: Math.round(newHeight),
    aspectRatio: finalAspectRatio
  };
};
