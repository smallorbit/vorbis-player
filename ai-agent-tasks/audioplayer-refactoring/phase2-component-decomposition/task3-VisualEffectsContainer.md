# Task 3: Extract VisualEffectsContainer Component

## Objective
Create a dedicated container component that manages all visual effects-related functionality, including the menu, state management, and integration with album art filters.

## Current Issues
- Visual effects logic scattered across AudioPlayer component
- Complex conditional rendering for visual effects menu
- Mixed visual effects state management
- Tight coupling between effects and main component

## Files to Modify
- **Create**: `src/components/VisualEffectsContainer.tsx`
- **Modify**: `src/components/PlayerContent.tsx` (replace visual effects menu with container)
- **Consider**: Integration with Phase 1 useVisualEffectsState hook

## Implementation Steps

### Step 1: Create the VisualEffectsContainer Component
Create `src/components/VisualEffectsContainer.tsx` with the following structure:

```typescript
import React, { Suspense, lazy } from 'react';
import { useVisualEffectsState } from '../hooks/useVisualEffectsState';

const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu'));

interface VisualEffectsContainerProps {
  enabled: boolean;
  isMenuOpen: boolean;
  accentColor: string;
  filters: AlbumArtFilters;
  onMenuClose: () => void;
  onFilterChange: (filter: string, value: number) => void;
  onResetFilters: () => void;
  onToggleEffects: () => void;
}

const VisualEffectsContainer: React.FC<VisualEffectsContainerProps> = ({
  enabled,
  isMenuOpen,
  accentColor,
  filters,
  onMenuClose,
  onFilterChange,
  onResetFilters,
  onToggleEffects
}) => {
  const {
    glowIntensity,
    glowRate,
    effectiveGlow,
    handleGlowIntensityChange,
    handleGlowRateChange,
    restoreGlowSettings
  } = useVisualEffectsState();

  // Visual effects management logic

  return enabled ? (
    <Suspense fallback={<EffectsLoadingFallback />}>
      <VisualEffectsMenu
        isOpen={isMenuOpen}
        onClose={onMenuClose}
        accentColor={accentColor}
        filters={filters}
        onFilterChange={onFilterChange}
        onResetFilters={onResetFilters}
        glowIntensity={glowIntensity}
        setGlowIntensity={handleGlowIntensityChange}
        glowRate={glowRate}
        setGlowRate={handleGlowRateChange}
        effectiveGlow={effectiveGlow}
      />
    </Suspense>
  ) : null;
};
```

### Step 2: Add Effects State Management
Integrate comprehensive effects state management:

```typescript
interface VisualEffectsState {
  glow: {
    intensity: number;
    rate: number;
    enabled: boolean;
  };
  filters: AlbumArtFilters;
  menu: {
    isOpen: boolean;
    activeTab: string;
  };
}

const VisualEffectsContainer: React.FC<VisualEffectsContainerProps> = (props) => {
  const [effectsState, setEffectsState] = useState<VisualEffectsState>({
    glow: { intensity: 50, rate: 2, enabled: props.enabled },
    filters: props.filters,
    menu: { isOpen: props.isMenuOpen, activeTab: 'filters' }
  });

  // Sync with props
  useEffect(() => {
    setEffectsState(prev => ({
      ...prev,
      glow: { ...prev.glow, enabled: props.enabled },
      menu: { ...prev.menu, isOpen: props.isMenuOpen }
    }));
  }, [props.enabled, props.isMenuOpen]);
};
```

### Step 3: Add Effects Presets Management
Create a preset system for visual effects:

```typescript
interface EffectsPreset {
  id: string;
  name: string;
  filters: AlbumArtFilters;
  glow: { intensity: number; rate: number };
}

const DEFAULT_PRESETS: EffectsPreset[] = [
  {
    id: 'default',
    name: 'Default',
    filters: { brightness: 110, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0 },
    glow: { intensity: 50, rate: 2 }
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    filters: { brightness: 120, contrast: 110, saturation: 130, hue: 0, blur: 0, sepia: 0 },
    glow: { intensity: 70, rate: 3 }
  },
  {
    id: 'vintage',
    name: 'Vintage',
    filters: { brightness: 95, contrast: 105, saturation: 80, hue: 15, blur: 1, sepia: 30 },
    glow: { intensity: 30, rate: 1 }
  }
];

const applyPreset = useCallback((preset: EffectsPreset) => {
  // Apply filters
  Object.entries(preset.filters).forEach(([filter, value]) => {
    props.onFilterChange(filter, value);
  });

  // Apply glow settings
  handleGlowIntensityChange(preset.glow.intensity);
  handleGlowRateChange(preset.glow.rate);
}, [props.onFilterChange, handleGlowIntensityChange, handleGlowRateChange]);
```

### Step 4: Add Keyboard Shortcuts for Effects
Implement keyboard shortcuts for visual effects:

```typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;

    switch (event.code) {
      case 'KeyV':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          props.onToggleEffects();
        }
        break;
      case 'KeyE':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          props.onMenuClose();
        }
        break;
      case 'KeyR':
        if (event.ctrlKey || event.metaKey && props.enabled) {
          event.preventDefault();
          props.onResetFilters();
        }
        break;
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [props.enabled, props.onToggleEffects, props.onMenuClose, props.onResetFilters]);
```

### Step 5: Add Performance Monitoring
Add performance monitoring for visual effects:

```typescript
const [performanceMetrics, setPerformanceMetrics] = useState({
  renderTime: 0,
  filterApplicationTime: 0,
  glowRenderTime: 0
});

const measureFilterPerformance = useCallback((filterName: string, value: number) => {
  const startTime = performance.now();

  props.onFilterChange(filterName, value);

  requestAnimationFrame(() => {
    const endTime = performance.now();
    setPerformanceMetrics(prev => ({
      ...prev,
      filterApplicationTime: endTime - startTime
    }));
  });
}, [props.onFilterChange]);
```

### Step 6: Update PlayerContent.tsx
Replace the visual effects menu with the container:

```typescript
<VisualEffectsContainer
  enabled={effects.enabled}
  isMenuOpen={ui.showVisualEffects}
  accentColor={ui.accentColor}
  filters={effects.filters}
  onMenuClose={handlers.onCloseVisualEffects}
  onFilterChange={handlers.onFilterChange}
  onResetFilters={handlers.onResetFilters}
  onToggleEffects={handlers.onGlowToggle}
/>
```

## Testing Requirements

### Unit Tests
- [ ] Component renders VisualEffectsMenu when enabled
- [ ] Component returns null when disabled
- [ ] Preset system works correctly
- [ ] Keyboard shortcuts function properly
- [ ] Performance monitoring captures metrics
- [ ] State synchronization works correctly

### Integration Tests
- [ ] Container integrates with PlayerContent
- [ ] Visual effects state updates propagate correctly
- [ ] Filter changes are applied to album art
- [ ] Glow effects are applied correctly
- [ ] Preset application works end-to-end

### Performance Tests
- [ ] Effects rendering doesn't cause frame drops
- [ ] Filter application is smooth and responsive
- [ ] Memory usage remains stable with effects enabled
- [ ] Performance monitoring doesn't impact user experience

### Manual Testing
- [ ] Visual effects menu opens/closes correctly
- [ ] All filter controls work smoothly
- [ ] Presets apply correctly
- [ ] Keyboard shortcuts work as expected
- [ ] Performance remains acceptable

## Dependencies
- **Recommended**: Complete Phase 1 Task 4 (useVisualEffectsState) first
- **Optional**: Can work with current state management but will need updates

## Success Criteria
- [ ] VisualEffectsContainer successfully manages all effects functionality
- [ ] Visual effects menu logic is encapsulated
- [ ] Preset system is implemented and functional
- [ ] Keyboard shortcuts are working
- [ ] Performance monitoring is in place
- [ ] All existing visual effects functionality preserved

## Implementation Details

### Loading Fallback Component
```typescript
const EffectsLoadingFallback: React.FC = () => (
  <div style={{
    position: 'fixed',
    top: 0,
    right: 0,
    width: '350px',
    height: '100vh',
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '14px'
  }}>
    Loading effects...
  </div>
);
```

### Preset Storage Management
```typescript
const saveCustomPreset = useCallback((name: string) => {
  const customPreset: EffectsPreset = {
    id: `custom-${Date.now()}`,
    name,
    filters: props.filters,
    glow: { intensity: glowIntensity, rate: glowRate }
  };

  const savedPresets = JSON.parse(
    localStorage.getItem('vorbis-player-custom-presets') || '[]'
  );

  savedPresets.push(customPreset);
  localStorage.setItem('vorbis-player-custom-presets', JSON.stringify(savedPresets));
}, [props.filters, glowIntensity, glowRate]);
```

## Advanced Features (Optional)
- **Effect Animation**: Smooth transitions between effect states
- **Auto-Effects**: Automatic effects based on music genre/tempo
- **Effect Sharing**: Share effect presets with other users
- **A/B Testing**: Compare different effect configurations
- **Effect Analytics**: Track which effects are used most

## Notes
- Consider adding effect intensity validation (0-100 ranges)
- Test effects performance on lower-end devices
- Ensure effects don't interfere with accessibility
- Consider adding effect preview functionality
- Test with various image types and resolutions