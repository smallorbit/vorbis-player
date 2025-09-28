# Task 1: Replace ContentWrapper

## Objective
Replace the hardcoded ContentWrapper in PlayerContent.tsx with a responsive wrapper that uses the new sizing system and fluid dimensions.

## Current Issues
- Hardcoded dimensions: `1024px × 1186px` and `768px × 922px`
- Single breakpoint: `@media (max-height: 1024px)`
- Fixed positioning causing layout issues
- No mobile optimization

## Implementation Plan

### 1.1 Create ResponsivePlayerWrapper Component
```typescript
// src/components/ResponsivePlayerWrapper.tsx
interface ResponsivePlayerWrapperProps {
  children: React.ReactNode;
  className?: string;
}

const ResponsivePlayerWrapper = styled.div`
  /* Fluid dimensions with constraints */
  width: min(90vw, 1200px);
  height: min(90vh, 800px);
  min-width: 320px;
  min-height: 400px;
  
  /* Responsive positioning */
  margin: 0 auto;
  padding: 0.5rem;
  box-sizing: border-box;
  
  /* Smooth transitions */
  transition: width 0.3s ease, height 0.3s ease;
  
  /* Container query setup */
  container-type: inline-size;
  container-name: player;
`;
```

### 1.2 Update PlayerContent.tsx
- Remove hardcoded ContentWrapper
- Replace with ResponsivePlayerWrapper
- Update styling to use CSS custom properties
- Add responsive behavior

## Tasks

### 1.1 Create ResponsivePlayerWrapper
- [ ] Create new ResponsivePlayerWrapper component
- [ ] Implement fluid sizing with constraints
- [ ] Add container query setup
- [ ] Add smooth transition animations

### 1.2 Update PlayerContent.tsx
- [ ] Remove hardcoded ContentWrapper
- [ ] Replace with ResponsivePlayerWrapper
- [ ] Update all hardcoded dimensions
- [ ] Test responsive behavior

### 1.3 Add Responsive Styling
- [ ] Update LoadingCard with responsive dimensions
- [ ] Add responsive padding and margins
- [ ] Implement responsive border radius
- [ ] Add responsive shadows

### 1.4 Testing and Validation
- [ ] Test on various screen sizes
- [ ] Verify smooth transitions
- [ ] Check container query functionality
- [ ] Validate accessibility

## Implementation Details

### ResponsivePlayerWrapper Implementation
```typescript
// src/components/ResponsivePlayerWrapper.tsx
import styled from 'styled-components';
import { usePlayerSizing } from '../hooks/usePlayerSizing';

const ResponsivePlayerWrapper = styled.div<{ dimensions: PlayerDimensions }>`
  /* Dynamic dimensions from hook */
  width: ${({ dimensions }) => dimensions.width}px;
  height: ${({ dimensions }) => dimensions.height}px;
  
  /* Responsive constraints */
  min-width: 320px;
  max-width: 90vw;
  min-height: 400px;
  max-height: 90vh;
  
  /* Centering and positioning */
  margin: 0 auto;
  padding: 0.5rem;
  box-sizing: border-box;
  position: relative;
  z-index: 1000;
  
  /* Smooth transitions */
  transition: width 0.3s ease, height 0.3s ease;
  
  /* Container query setup */
  container-type: inline-size;
  container-name: player;
  
  /* Responsive padding */
  @media (max-width: 480px) {
    padding: 0.25rem;
  }
  
  @media (min-width: 768px) {
    padding: 1rem;
  }
`;

export const ResponsivePlayerWrapper: React.FC<ResponsivePlayerWrapperProps> = ({ 
  children, 
  className 
}) => {
  const { dimensions } = usePlayerSizing();
  
  return (
    <ResponsivePlayerWrapper 
      dimensions={dimensions}
      className={className}
    >
      {children}
    </ResponsivePlayerWrapper>
  );
};
```

### Updated PlayerContent.tsx
```typescript
// src/components/PlayerContent.tsx
const PlayerContent: React.FC<PlayerContentProps> = ({ track, ui, effects, handlers }) => {
  const defaultFilters = {
    brightness: 110,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    sepia: 0
  };

  return (
    <ResponsivePlayerWrapper>
      <LoadingCard
        backgroundImage={track.current?.image}
        accentColor={ui.accentColor}
        glowEnabled={effects.enabled}
        glowIntensity={effects.glow.intensity}
        glowRate={effects.glow.rate}
      >
        {/* Rest of component remains the same */}
      </LoadingCard>
    </ResponsivePlayerWrapper>
  );
};
```

## Deliverables
- ResponsivePlayerWrapper component
- Updated PlayerContent.tsx
- Responsive styling implementation
- Testing results

## Success Criteria
- [ ] No hardcoded dimensions in PlayerContent.tsx
- [ ] Fluid responsive sizing working
- [ ] Smooth transitions between sizes
- [ ] Container queries functioning
- [ ] All existing functionality preserved
