// TypeScript interface for player constraints
export interface PlayerConstraints {
  minHeight: number;
  maxHeight: number;
  viewportUsage: {
    width: number;
    height: number;
  };
}

export const theme = {
  colors: {
    // Base colors
    background: 'rgba(22, 21, 21, 0.56)',
    backgroundLight: '#c2b85e',
    foreground: 'rgba(255, 255, 255, 0.87)',
    foregroundDark: '#213547',
    
    // Primary colors
    primary: '#646cff',
    primaryHover: '#535bf2',
    
    // Secondary colors
    secondary: '#905252',
    secondaryHover: '#646cff',
    
    // Accent colors
    accent: '#fb923c',
    accentHover: '#f59e0b',
    accentDark: '#d97706',
    
    // Status colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    
    // Neutral colors
    white: '#ffffff',
    black: '#000000',
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827'
    },
    
    // Border colors
    border: 'rgba(255, 255, 255, 0.2)',
    borderHover: '#646cff',
    
    // Muted colors
    muted: {
      background: 'rgba(255, 255, 255, 0.05)',
      foreground: 'rgba(255, 255, 255, 0.7)'
    },
    
    // Common overlay and control colors (consolidating hardcoded values)
    overlay: {
      light: 'rgba(0, 0, 0, 0.5)',
      dark: 'rgba(0, 0, 0, 0.95)',
      backdrop: 'rgba(0, 0, 0, 0.9)'
    },
    
    // Common control colors
    control: {
      background: 'rgba(115, 115, 115, 0.2)',
      backgroundHover: 'rgba(115, 115, 115, 0.3)',
      border: 'rgba(115, 115, 115, 0.5)',
      borderHover: 'rgba(115, 115, 115, 0.7)'
    },
    
    // Popover colors
    popover: {
      background: '#232323',
      border: 'rgba(255, 255, 255, 0.1)'
    }
  },
  
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem',   // 64px
    '4xl': '6rem',   // 96px
    '5xl': '8rem',   // 128px
  },
  
  borderRadius: {
    none: '0',
    xs: '0.05rem',  // 1px
    sm: '0.125rem',  // 2px
    md: '0.375rem',  // 6px
    lg: '0.5rem',    // 8px
    xl: '0.75rem',   // 12px
    '2xl': '1rem',   // 16px
    '3xl': '1.5rem', // 24px
    full: '9999px'
  },
  
  fontSize: {
    xs: '0.75rem',   // 12px
    sm: '0.875rem',  // 14px
    base: '1rem',    // 16px
    lg: '1.125rem',  // 18px
    xl: '1.25rem',   // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
    '6xl': '3.75rem'   // 60px
  },
  
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  },
  
  shadows: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    albumArt: '0 8px 24px rgba(23, 22, 22, 0.7), 0 2px 8px rgba(22, 21, 21, 0.6)',
    none: 'none'
  },
  
  transitions: {
    fast: '0.15s ease',
    normal: '0.25s ease',
    slow: '0.35s ease'
  },
  
  breakpoints: {
    // Mobile devices
    xs: '320px',
    sm: '375px',
    md: '480px',
    lg: '768px',
    xl: '1280px',
    '2xl': '1536px',
    '3xl': '1920px'
  },
  
  
  // Container query breakpoints for component-level responsive behavior
  containerBreakpoints: {
    xs: '320px',
    sm: '480px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  },
  
  zIndex: {
    auto: 'auto',
    base: '0',
    docked: '10',
    dropdown: '1000',
    sticky: '1100',
    banner: '1200',
    overlay: '1300',
    modal: '1400',
    popover: '1500',
    skipLink: '1600',
    toast: '1700',
    tooltip: '1800'
  },
  
  // Player-specific sizing constraints
  playerConstraints: {
    minHeight: 400,
    maxHeight: 1186,
    viewportUsage: {
      width: 0.9,
      height: 0.9
    }
  }
} as const;

export type Theme = typeof theme;

// Ensure playerConstraints conforms to the interface
export type ThemeWithPlayerConstraints = Omit<Theme, 'playerConstraints'> & {
  playerConstraints: PlayerConstraints;
};

// Helper function for responsive design
export const mediaQuery = {
  xs: `@media (min-width: ${theme.breakpoints.xs})`,
  sm: `@media (min-width: ${theme.breakpoints.sm})`,
  md: `@media (min-width: ${theme.breakpoints.md})`,
  lg: `@media (min-width: ${theme.breakpoints.lg})`,
  xl: `@media (min-width: ${theme.breakpoints.xl})`,
  '2xl': `@media (min-width: ${theme.breakpoints['2xl']})`
};

// Container query utilities for component-level responsive behavior
export const containerQuery = {
  xs: `@container (min-width: ${theme.containerBreakpoints.xs})`,
  sm: `@container (min-width: ${theme.containerBreakpoints.sm})`,
  md: `@container (min-width: ${theme.containerBreakpoints.md})`,
  lg: `@container (min-width: ${theme.containerBreakpoints.lg})`,
  xl: `@container (min-width: ${theme.containerBreakpoints.xl})`,
  '2xl': `@container (min-width: ${theme.containerBreakpoints['2xl']})`
};
