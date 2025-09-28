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
}

export const getViewportInfo = (): ViewportInfo => {
  const width = window.innerWidth;
  const height = window.innerHeight;
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
    preferredAspectRatio = 0.86 // 1024/1186 ratio
  } = constraints;

  // Calculate base dimensions based on viewport
  let width: number;
  let height: number;

  if (viewport.orientation === 'portrait') {
    // Portrait: prioritize height, calculate width from aspect ratio
    height = Math.min(viewport.height * 0.85, maxHeight);
    width = height * preferredAspectRatio;
    
    // Ensure width fits within viewport
    if (width > viewport.width * 0.9) {
      width = viewport.width * 0.9;
      height = width / preferredAspectRatio;
    }
  } else {
    // Landscape: prioritize width, calculate height from aspect ratio
    width = Math.min(viewport.width * 0.8, maxWidth);
    height = width / preferredAspectRatio;
    
    // Ensure height fits within viewport
    if (height > viewport.height * 0.85) {
      height = viewport.height * 0.85;
      width = height * preferredAspectRatio;
    }
  }

  // Apply constraints
  width = Math.max(minWidth, Math.min(width, maxWidth));
  height = Math.max(minHeight, Math.min(height, maxHeight));

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
  // Responsive padding based on screen size
  if (viewport.width < 480) return 8;
  if (viewport.width < 768) return 12;
  if (viewport.width < 1024) return 16;
  return 20;
};
