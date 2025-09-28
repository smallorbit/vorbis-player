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

export const getViewportInfo = (): ViewportInfo => {
  // Use visual viewport API if available (better for mobile browsers)
  let width: number;
  let height: number;
  
  if ('visualViewport' in window && (window as any).visualViewport) {
    const visualViewport = (window as any).visualViewport;
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
  const {
    minWidth = 320,
    maxWidth = Math.min(viewport.width * 0.9, 1024),
    minHeight = 400,
    maxHeight = Math.min(viewport.height * 0.9, 1186),
    preferredAspectRatio,
    allowAspectRatioAdjustment = true,
    minAspectRatio,
    maxAspectRatio
  } = constraints;

  // Get optimal aspect ratio for this viewport
  const optimalAspectRatio = preferredAspectRatio ?? getOptimalAspectRatio(viewport);
  
  // Get aspect ratio constraints
  const aspectRatioConstraints = calculateAspectRatioConstraints(viewport);
  const finalMinAspectRatio = minAspectRatio ?? aspectRatioConstraints.min;
  const finalMaxAspectRatio = maxAspectRatio ?? aspectRatioConstraints.max;

  // Calculate base dimensions based on viewport
  let width: number;
  let height: number;

  if (viewport.orientation === 'portrait') {
    // Portrait: prioritize height, calculate width from aspect ratio
    height = Math.min(viewport.height * 0.85, maxHeight);
    width = height * optimalAspectRatio;
    
    // Ensure width fits within viewport
    if (width > viewport.width * 0.9) {
      width = viewport.width * 0.9;
      height = width / optimalAspectRatio;
    }
  } else {
    // Landscape: prioritize width, calculate height from aspect ratio
    width = Math.min(viewport.width * 0.8, maxWidth);
    height = width / optimalAspectRatio;
    
    // Ensure height fits within viewport
    if (height > viewport.height * 0.85) {
      height = viewport.height * 0.85;
      width = height * optimalAspectRatio;
    }
  }

  // Apply basic constraints
  width = Math.max(minWidth, Math.min(width, maxWidth));
  height = Math.max(minHeight, Math.min(height, maxHeight));

  // Apply aspect ratio adjustments if enabled
  if (allowAspectRatioAdjustment) {
    const adjusted = adjustDimensionsForAspectRatio(
      width,
      height,
      { min: finalMinAspectRatio, max: finalMaxAspectRatio }
    );
    width = adjusted.width;
    height = adjusted.height;
  }

  // Calculate scale factor for responsive adjustments
  const scale = Math.min(1, viewport.width / 1024);

  return {
    width: Math.round(width),
    height: Math.round(height),
    scale,
    aspectRatio: width / height
  };
};

export const getResponsiveBreakpoint = (viewport: ViewportInfo): string => {
  // Enhanced mobile breakpoints for better mobile experience
  if (viewport.width < 320) return 'mobile-xs'; // Very small phones
  if (viewport.width < 480) return 'mobile';
  if (viewport.width < 768) return 'mobile-large';
  if (viewport.width < 1024) return 'tablet';
  if (viewport.width < 1280) return 'desktop';
  return 'desktop-large';
};

export const shouldUseFluidSizing = (viewport: ViewportInfo): boolean => {
  // Use fluid sizing for screens smaller than desktop or very large screens
  return viewport.width < 1024 || viewport.width > 1920;
};

export const calculateOptimalPadding = (viewport: ViewportInfo): number => {
  // Responsive padding based on screen size with mobile optimizations
  if (viewport.width < 320) return 4; // Very small screens
  if (viewport.width < 480) return 8;
  if (viewport.width < 768) return 12;
  if (viewport.width < 1024) return 16;
  return 20;
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
