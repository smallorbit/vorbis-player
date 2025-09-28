# Task 1: Extract PlayerContent Component

## Objective
Extract the main content rendering logic from the `renderContent` function (lines 393-476) into a dedicated `PlayerContent` component.

## Current Issues
- Large `renderContent` function with mixed concerns
- Complex conditional rendering logic embedded in main component
- UI structure scattered across multiple nested JSX blocks
- Content rendering tightly coupled with AudioPlayer state

## Files to Modify
- **Create**: `src/components/PlayerContent.tsx`
- **Modify**: `src/components/AudioPlayer.tsx` (replace renderContent with PlayerContent component)

## Implementation Steps

### Step 1: Create the PlayerContent Component
Create `src/components/PlayerContent.tsx` with the following structure:

```typescript
import React, { Suspense } from 'react';
import styled from 'styled-components';
import { CardContent } from './styled';
import AlbumArt from './AlbumArt';
import { lazy } from 'react';

const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu'));
const PlaylistDrawer = lazy(() => import('./PlaylistDrawer'));
const SpotifyPlayerControls = lazy(() => import('./SpotifyPlayerControls'));

interface PlayerContentProps {
  currentTrack: SpotifyTrack | null;
  accentColor: string;
  visualEffectsEnabled: boolean;
  effectiveGlow: { intensity: number; rate: number };
  albumFilters: AlbumArtFilters;
  tracks: SpotifyTrack[];
  currentTrackIndex: number;
  showVisualEffects: boolean;
  showPlaylist: boolean;
  // ... other props
}

const PlayerContent: React.FC<PlayerContentProps> = ({ ... }) => {
  return (
    <ContentWrapper>
      {/* Move LoadingCard and content here */}
    </ContentWrapper>
  );
};
```

### Step 2: Extract LoadingCard and Styling
Move the `LoadingCard` styled component and `ContentWrapper` from AudioPlayer.tsx:
- `ContentWrapper` styled component (lines 30-47)
- `LoadingCard` styled component (lines 50-95)
- All related styling and theming logic

### Step 3: Extract Main Content Structure
Move the content structure from AudioPlayer.tsx:408-476:
- `LoadingCard` with background image and glow props
- Album art rendering with `CardContent` wrapper
- Controls rendering with `Suspense` fallback
- Visual effects menu conditional rendering
- Playlist drawer rendering

### Step 4: Extract Event Handlers Interface
Define a clean interface for event handlers:
```typescript
interface PlayerContentHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShowPlaylist: () => void;
  onShowVisualEffects: () => void;
  onCloseVisualEffects: () => void;
  onClosePlaylist: () => void;
  onTrackSelect: (index: number) => void;
  onAccentColorChange: (color: string) => void;
  onGlowToggle: () => void;
  onFilterChange: (filter: string, value: number) => void;
  onResetFilters: () => void;
}
```

### Step 5: Simplify Props Interface
Group related props into logical objects:
```typescript
interface PlayerContentProps {
  track: {
    current: SpotifyTrack | null;
    list: SpotifyTrack[];
    currentIndex: number;
  };
  ui: {
    accentColor: string;
    showVisualEffects: boolean;
    showPlaylist: boolean;
  };
  effects: {
    enabled: boolean;
    glow: { intensity: number; rate: number };
    filters: AlbumArtFilters;
  };
  handlers: PlayerContentHandlers;
}
```

### Step 6: Update AudioPlayer.tsx
Replace the `renderContent` function with:
```typescript
const renderMainContent = () => (
  <PlayerContent
    track={{
      current: currentTrack,
      list: tracks,
      currentIndex: currentTrackIndex
    }}
    ui={{
      accentColor,
      showVisualEffects,
      showPlaylist
    }}
    effects={{
      enabled: visualEffectsEnabled,
      glow: effectiveGlow,
      filters: albumFilters
    }}
    handlers={{
      onPlay: handlePlay,
      onPause: handlePause,
      onNext: handleNext,
      onPrevious: handlePrevious,
      // ... other handlers
    }}
  />
);
```

## Testing Requirements

### Unit Tests
- [ ] Component renders correctly with all props
- [ ] Conditional rendering works for visual effects menu
- [ ] Conditional rendering works for playlist drawer
- [ ] Event handlers are called correctly
- [ ] Styled components render with correct props

### Integration Tests
- [ ] Component integrates with AudioPlayer
- [ ] Lazy loading works for child components
- [ ] Album art renders with correct filters
- [ ] Controls receive correct event handlers

### Manual Testing
- [ ] Main content displays correctly
- [ ] Visual effects menu opens/closes properly
- [ ] Playlist drawer opens/closes properly
- [ ] All controls function as before
- [ ] Loading states display correctly

## Dependencies
- **Recommended**: Complete Phase 1 tasks first for cleaner props interface
- **Optional**: Can be done independently but will require props updates after Phase 1

## Success Criteria
- [ ] `renderContent` function removed from AudioPlayer.tsx
- [ ] All content rendering logic moved to PlayerContent component
- [ ] Component has clean, typed props interface
- [ ] All functionality preserved
- [ ] Loading and error states work correctly

## Implementation Details

### Conditional Rendering Structure
```typescript
return (
  <ContentWrapper>
    <LoadingCard
      backgroundImage={track.current?.image}
      accentColor={ui.accentColor}
      glowEnabled={effects.enabled}
      glowIntensity={effects.glow.intensity}
      glowRate={effects.glow.rate}
    >
      <CardContent style={{ position: 'relative', zIndex: 2, marginTop: '-0.25rem' }}>
        <AlbumArt
          currentTrack={track.current}
          accentColor={ui.accentColor}
          glowIntensity={effects.enabled ? effects.glow.intensity : 0}
          glowRate={effects.glow.rate}
          albumFilters={effects.enabled ? effects.filters : defaultFilters}
        />
      </CardContent>

      <CardContent style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2 }}>
        <Suspense fallback={<ControlsLoadingFallback />}>
          <SpotifyPlayerControls
            currentTrack={track.current}
            accentColor={ui.accentColor}
            onPlay={handlers.onPlay}
            onPause={handlers.onPause}
            // ... other props
          />
        </Suspense>
      </CardContent>

      {effects.enabled && (
        <Suspense fallback={<EffectsLoadingFallback />}>
          <VisualEffectsMenu
            isOpen={ui.showVisualEffects}
            onClose={handlers.onCloseVisualEffects}
            // ... other props
          />
        </Suspense>
      )}
    </LoadingCard>

    <Suspense fallback={<PlaylistLoadingFallback />}>
      <PlaylistDrawer
        isOpen={ui.showPlaylist}
        onClose={handlers.onClosePlaylist}
        // ... other props
      />
    </Suspense>
  </ContentWrapper>
);
```

### Loading Fallback Components
Create reusable loading fallback components:
```typescript
const ControlsLoadingFallback = () => (
  <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
    Loading controls...
  </div>
);
```

## Advanced Features (Optional)
- **Memoization**: Use React.memo for performance optimization
- **Error Boundaries**: Add error boundaries for child components
- **Loading States**: Enhanced loading states with skeleton UI
- **Animations**: Add enter/exit animations for content sections

## Notes
- Consider extracting smaller sub-components if PlayerContent becomes large
- Ensure proper prop drilling is minimized with grouped props
- Test with different screen sizes for responsive behavior
- Consider using compound component pattern for better composition