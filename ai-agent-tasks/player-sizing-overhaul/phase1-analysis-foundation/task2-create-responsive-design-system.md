# Task 2: Create Responsive Design System

## Objective
Establish a comprehensive responsive design system with proper breakpoints, sizing utilities, and design tokens for the player sizing overhaul.

## Design System Requirements

### New Breakpoint System
```typescript
const breakpoints = {
  // Mobile devices
  mobile: '320px',
  mobileLarge: '480px',
  
  // Tablet devices  
  tablet: '768px',
  tabletLarge: '1024px',
  
  // Desktop devices
  desktop: '1280px',
  desktopLarge: '1440px',
  desktopXLarge: '1920px'
};
```

### Aspect Ratio Considerations
- **Portrait Mobile**: 4:5 ratio (album art optimized)
- **Landscape Mobile**: 16:9 ratio (video-like experience)
- **Tablet Portrait**: 3:4 ratio (balanced layout)
- **Desktop**: 16:10 ratio (wide screen optimized)

### Sizing Constraints
- Minimum width: 320px (smallest mobile)
- Maximum width: 90vw (never exceed viewport)
- Minimum height: 400px (ensure usability)
- Maximum height: 90vh (never exceed viewport)

## Tasks

### 2.1 Update Theme Breakpoints
- [ ] Add new breakpoint system to `src/styles/theme.ts`
- [ ] Create orientation-specific breakpoints
- [ ] Add container query breakpoints
- [ ] Update media query helpers

### 2.2 Create Sizing Utilities
- [ ] Create `src/utils/sizingUtils.ts` with calculation functions
- [ ] Implement viewport detection utilities
- [ ] Add aspect ratio calculation helpers
- [ ] Create responsive dimension calculators

### 2.3 Design Token System
- [ ] Add responsive spacing tokens
- [ ] Create fluid typography scale
- [ ] Add responsive border radius tokens
- [ ] Create responsive shadow tokens

### 2.4 Container Query Setup
- [ ] Add container query polyfill if needed
- [ ] Create container query utilities
- [ ] Set up container query CSS structure
- [ ] Test container query support

## Implementation Details

### Sizing Utility Functions
```typescript
// src/utils/sizingUtils.ts
export const calculatePlayerDimensions = (
  viewport: ViewportInfo,
  constraints: SizingConstraints
): PlayerDimensions => {
  const { width, height, orientation } = viewport;
  const { minWidth, maxWidth, minHeight, maxHeight } = constraints;
  
  // Calculate optimal dimensions based on viewport and constraints
  const optimalWidth = Math.max(minWidth, Math.min(maxWidth, width * 0.9));
  const optimalHeight = Math.max(minHeight, Math.min(maxHeight, height * 0.9));
  
  return {
    width: optimalWidth,
    height: optimalHeight,
    aspectRatio: calculateAspectRatio(orientation),
    scale: calculateScale(optimalWidth, optimalHeight, viewport)
  };
};
```

### Responsive CSS Variables
```css
:root {
  --player-min-width: 320px;
  --player-max-width: 90vw;
  --player-min-height: 400px;
  --player-max-height: 90vh;
  
  --player-mobile-width: min(90vw, 480px);
  --player-tablet-width: min(90vw, 768px);
  --player-desktop-width: min(90vw, 1024px);
}
```

## Deliverables
- Updated theme with new breakpoint system
- Comprehensive sizing utilities
- Container query setup
- Responsive design tokens

## Success Criteria
- [ ] New breakpoint system implemented
- [ ] Sizing utilities created and tested
- [ ] Container queries working
- [ ] Design tokens established
- [ ] All utilities properly typed
