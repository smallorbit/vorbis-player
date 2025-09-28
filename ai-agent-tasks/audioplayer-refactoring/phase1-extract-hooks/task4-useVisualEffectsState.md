# Task 4: Extract useVisualEffectsState Hook

## Objective
Extract the glow state management and visual effects toggle logic (lines 126-131, 135-144, 341-354) into a dedicated custom hook.

## Current Issues
- Glow state variables scattered throughout component
- Visual effects toggle logic mixed with other component logic
- Manual state synchronization between glow settings and saved values
- Complex state restoration logic for visual effects

## Files to Modify
- **Create**: `src/hooks/useVisualEffectsState.ts`
- **Modify**: `src/components/AudioPlayer.tsx` (remove glow state and toggle logic, use hook)

## Implementation Steps

### Step 1: Create the Hook File
Create `src/hooks/useVisualEffectsState.ts` with the following structure:

```typescript
import { useState, useCallback } from 'react';
import { DEFAULT_GLOW_INTENSITY, DEFAULT_GLOW_RATE } from '../components/AccentColorGlowOverlay';

interface UseVisualEffectsStateProps {
  initialGlowIntensity?: number;
  initialGlowRate?: number;
}

export const useVisualEffectsState = ({
  initialGlowIntensity = DEFAULT_GLOW_INTENSITY,
  initialGlowRate = DEFAULT_GLOW_RATE
}: UseVisualEffectsStateProps = {}) => {
  // Glow state management
  // Saved state management
  // Toggle functionality
  // Effect calculation

  return {
    glowIntensity,
    glowRate,
    savedGlowIntensity,
    savedGlowRate,
    effectiveGlow,
    handleGlowIntensityChange,
    handleGlowRateChange,
    restoreGlowSettings
  };
};
```

### Step 2: Extract Glow State Management
Move the following state from AudioPlayer.tsx:126-131:
- `glowIntensity` state and setter
- `glowRate` state and setter
- `savedGlowIntensity` state and setter
- `savedGlowRate` state and setter

### Step 3: Extract Glow Handlers
Move the glow change handlers from AudioPlayer.tsx:135-144:
- `handleGlowIntensityChange` function
- `handleGlowRateChange` function
- State saving logic when values change

### Step 4: Extract Effective Glow Calculation
Move the effective glow calculation from AudioPlayer.tsx:133:
- `effectiveGlow` object with intensity and rate
- Make it reactive to current glow settings

### Step 5: Add State Restoration Logic
Extract and improve the restoration logic from AudioPlayer.tsx:347-352:
- Create `restoreGlowSettings` function
- Handle restoration of both intensity and rate
- Add validation for restored values

### Step 6: Add Persistence Support
Enhance with localStorage persistence:
- Save glow settings to localStorage when changed
- Load initial settings from localStorage
- Provide clear/reset functionality

### Step 7: Update AudioPlayer.tsx
Replace the current glow state management with:
```typescript
const {
  glowIntensity,
  glowRate,
  effectiveGlow,
  handleGlowIntensityChange,
  handleGlowRateChange,
  restoreGlowSettings
} = useVisualEffectsState();
```

## Testing Requirements

### Unit Tests
- [ ] Hook initializes with correct default values
- [ ] Glow intensity changes update state correctly
- [ ] Glow rate changes update state correctly
- [ ] Saved state is managed properly
- [ ] Effective glow calculation is correct
- [ ] State restoration works correctly

### Integration Tests
- [ ] Hook integrates with AudioPlayer component
- [ ] Glow settings persist across component re-renders
- [ ] Visual effects toggle uses hook correctly
- [ ] VisualEffectsMenu receives correct props from hook

### Manual Testing
- [ ] Glow intensity slider updates work
- [ ] Glow rate slider updates work
- [ ] Visual effects toggle preserves settings
- [ ] Settings restore correctly when re-enabled

## Dependencies
- None (independent of other Phase 1 tasks)

## Success Criteria
- [ ] All glow state variables removed from AudioPlayer.tsx
- [ ] Glow change handlers removed from AudioPlayer.tsx
- [ ] Visual effects functionality preserved
- [ ] Hook provides clean API for glow management
- [ ] State persistence works correctly

## Implementation Details

### State Management with Persistence
```typescript
const [glowIntensity, setGlowIntensity] = useState(() => {
  const saved = localStorage.getItem('vorbis-player-glow-intensity');
  return saved ? parseInt(saved, 10) : initialGlowIntensity;
});

const [glowRate, setGlowRate] = useState(() => {
  const saved = localStorage.getItem('vorbis-player-glow-rate');
  return saved ? parseInt(saved, 10) : initialGlowRate;
});
```

### Change Handlers with Persistence
```typescript
const handleGlowIntensityChange = useCallback((intensity: number) => {
  setGlowIntensity(intensity);
  setSavedGlowIntensity(intensity);
  localStorage.setItem('vorbis-player-glow-intensity', intensity.toString());
}, []);

const handleGlowRateChange = useCallback((rate: number) => {
  setGlowRate(rate);
  setSavedGlowRate(rate);
  localStorage.setItem('vorbis-player-glow-rate', rate.toString());
}, []);
```

### Effective Glow Calculation
```typescript
const effectiveGlow = useMemo(() => ({
  intensity: glowIntensity,
  rate: glowRate
}), [glowIntensity, glowRate]);
```

### State Restoration
```typescript
const restoreGlowSettings = useCallback(() => {
  if (savedGlowIntensity !== null) {
    setGlowIntensity(savedGlowIntensity);
  }
  if (savedGlowRate !== null) {
    setGlowRate(savedGlowRate);
  }
}, [savedGlowIntensity, savedGlowRate]);
```

## Advanced Features (Optional)
- **Preset Management**: Save/load glow presets
- **Animation Curves**: Different easing functions for glow animations
- **Performance Monitoring**: Track glow rendering performance
- **Glow Themes**: Predefined glow configurations

## Integration Notes
- This hook will be used by the VisualEffectsMenu component
- The `handleVisualEffectsToggle` function in AudioPlayer should call `restoreGlowSettings`
- Consider combining with other visual effects state if pattern emerges

## Notes
- Ensure proper validation of localStorage values
- Consider debouncing localStorage writes for performance
- Test with invalid/corrupted localStorage data
- Maintain backward compatibility with existing saved settings