# Task 4: Create Sizing Hook

## Objective
Create a comprehensive `usePlayerSizing` hook that dynamically calculates optimal player dimensions based on viewport size, device characteristics, and content requirements.

## Hook Requirements

### Core Functionality
- **Dynamic dimension calculation**: Based on viewport and constraints
- **Aspect ratio handling**: Different ratios for different orientations
- **Performance optimization**: Debounced resize handling
- **Type safety**: Full TypeScript support
- **Accessibility**: Respects user preferences and system settings

### Hook Interface
```typescript
interface UsePlayerSizingReturn {
  dimensions: PlayerDimensions;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  scale: number;
  updateDimensions: () => void;
}
```

## Implementation Plan

### 4.1 Core Hook Implementation
```typescript
// src/hooks/usePlayerSizing.ts
export const usePlayerSizing = (constraints?: SizingConstraints) => {
  const [dimensions, setDimensions] = useState<PlayerDimensions>(() => 
    calculateInitialDimensions()
  );
  
  const [viewportInfo, setViewportInfo] = useState<ViewportInfo>(() =>
    getViewportInfo()
  );
  
  // Debounced resize handler
  const handleResize = useCallback(
    debounce(() => {
      const newViewport = getViewportInfo();
      const newDimensions = calculatePlayerDimensions(newViewport, constraints);
      
      setViewportInfo(newViewport);
      setDimensions(newDimensions);
    }, 100),
    [constraints]
  );
  
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [handleResize]);
  
  return {
    dimensions,
    isMobile: viewportInfo.width < 768,
    isTablet: viewportInfo.width >= 768 && viewportInfo.width < 1024,
    isDesktop: viewportInfo.width >= 1024,
    orientation: viewportInfo.orientation,
    scale: dimensions.scale,
    updateDimensions: handleResize
  };
};
```

## Tasks

### 4.1 Create Core Hook
- [ ] Implement `usePlayerSizing` hook with basic functionality
- [ ] Add viewport detection and tracking
- [ ] Implement dimension calculation logic
- [ ] Add TypeScript interfaces and types

### 4.2 Add Performance Optimizations
- [ ] Implement debounced resize handling
- [ ] Add memoization for expensive calculations
- [ ] Optimize re-renders with proper dependencies
- [ ] Add cleanup for event listeners

### 4.3 Add Advanced Features
- [ ] Implement aspect ratio calculations
- [ ] Add device pixel ratio handling
- [ ] Create smooth transition support
- [ ] Add accessibility considerations

### 4.4 Testing and Validation
- [ ] Create unit tests for hook functionality
- [ ] Add integration tests with components
- [ ] Test performance with various screen sizes
- [ ] Validate accessibility compliance

## Implementation Details

### Dimension Calculation Algorithm
```typescript
const calculatePlayerDimensions = (
  viewport: ViewportInfo,
  constraints: SizingConstraints
): PlayerDimensions => {
  const { width: vw, height: vh, orientation, devicePixelRatio } = viewport;
  const { minWidth, maxWidth, minHeight, maxHeight } = constraints;
  
  // Calculate base dimensions with viewport constraints
  const baseWidth = Math.min(vw * 0.9, maxWidth);
  const baseHeight = Math.min(vh * 0.9, maxHeight);
  
  // Apply minimum constraints
  const width = Math.max(minWidth, baseWidth);
  const height = Math.max(minHeight, baseHeight);
  
  // Calculate aspect ratio based on orientation
  const aspectRatio = orientation === 'portrait' ? 4/5 : 16/9;
  
  // Calculate scale factor for high DPI displays
  const scale = Math.min(devicePixelRatio, 2);
  
  return {
    width,
    height,
    aspectRatio,
    scale,
    orientation,
    devicePixelRatio
  };
};
```

### Viewport Information Interface
```typescript
interface ViewportInfo {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  devicePixelRatio: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const getViewportInfo = (): ViewportInfo => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const orientation = width > height ? 'landscape' : 'portrait';
  const devicePixelRatio = window.devicePixelRatio || 1;
  
  return {
    width,
    height,
    orientation,
    devicePixelRatio,
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024
  };
};
```

### Sizing Constraints Interface
```typescript
interface SizingConstraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  aspectRatio?: number;
  scale?: number;
}

const defaultConstraints: SizingConstraints = {
  minWidth: 320,
  maxWidth: 1200,
  minHeight: 400,
  maxHeight: 800,
  aspectRatio: 16/9
};
```

## Usage Examples

### Basic Usage
```typescript
const PlayerContent = () => {
  const { dimensions, isMobile, orientation } = usePlayerSizing();
  
  return (
    <div 
      style={{
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio: dimensions.aspectRatio
      }}
    >
      {/* Player content */}
    </div>
  );
};
```

### With Custom Constraints
```typescript
const PlayerContent = () => {
  const constraints = {
    minWidth: 400,
    maxWidth: 1000,
    minHeight: 500,
    maxHeight: 700
  };
  
  const { dimensions } = usePlayerSizing(constraints);
  
  return (
    <div style={{ width: dimensions.width, height: dimensions.height }}>
      {/* Player content */}
    </div>
  );
};
```

## Deliverables
- Complete `usePlayerSizing` hook implementation
- TypeScript interfaces and types
- Performance optimizations
- Comprehensive testing suite

## Success Criteria
- [ ] Hook calculates dimensions correctly for all screen sizes
- [ ] Performance optimized with debouncing and memoization
- [ ] Full TypeScript support with proper types
- [ ] Accessibility considerations implemented
- [ ] Comprehensive test coverage
- [ ] Smooth transitions between size changes
