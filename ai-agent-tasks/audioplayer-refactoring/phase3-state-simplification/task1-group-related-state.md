# Task 1: Group Related State Variables

## Objective
Consolidate the 24+ scattered state variables in AudioPlayer.tsx into logical, grouped state objects to reduce complexity and improve maintainability.

## Current Issues
- 24+ individual state variables destructured from usePlayerState
- Related state scattered across different hooks and components
- No logical grouping of state by domain/concern
- Difficult to understand state relationships and dependencies

## Current State Variables (from lines 99-124)
```typescript
const {
  tracks, currentTrackIndex, isLoading, error,           // Track-related
  selectedPlaylistId, showPlaylist,                      // Playlist-related
  accentColor, accentColorOverrides,                     // Color-related
  showVisualEffects, visualEffectsEnabled,              // Visual effects UI
  albumFilters,                                          // Visual effects data
  setTracks, setCurrentTrackIndex, setIsLoading, setError,     // Track setters
  setSelectedPlaylistId, setShowPlaylist,               // Playlist setters
  setAccentColor, setShowVisualEffects,                 // UI setters
  setAccentColorOverrides, handleFilterChange,          // Color/filter handlers
  handleResetFilters, restoreSavedFilters               // Filter utilities
} = usePlayerState();
```

## Files to Modify
- **Modify**: `src/hooks/usePlayerState.ts` (restructure state grouping)
- **Modify**: `src/components/AudioPlayer.tsx` (update state usage)
- **Consider**: Update other components using grouped state

## Implementation Steps

### Step 1: Define State Domain Groups
Create logical groupings for related state:

```typescript
// Track and Playback State
interface TrackState {
  tracks: SpotifyTrack[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
}

// Playlist State
interface PlaylistState {
  selectedId: string | null;
  isVisible: boolean;
}

// Color and Theme State
interface ColorState {
  current: string;
  overrides: Record<string, string>;
}

// Visual Effects State
interface VisualEffectsState {
  enabled: boolean;
  menuVisible: boolean;
  filters: AlbumArtFilters;
}
```

### Step 2: Update usePlayerState Hook
Restructure the hook to return grouped state:

```typescript
export const usePlayerState = () => {
  // Internal state management (keep individual states internally)
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  // ... other individual states

  // Group related state for external consumption
  const trackState: TrackState = {
    tracks,
    currentIndex: currentTrackIndex,
    isLoading,
    error
  };

  const playlistState: PlaylistState = {
    selectedId: selectedPlaylistId,
    isVisible: showPlaylist
  };

  const colorState: ColorState = {
    current: accentColor,
    overrides: accentColorOverrides
  };

  const visualEffectsState: VisualEffectsState = {
    enabled: visualEffectsEnabled,
    menuVisible: showVisualEffects,
    filters: albumFilters
  };

  // Group related actions
  const trackActions = {
    setTracks,
    setCurrentIndex: setCurrentTrackIndex,
    setLoading: setIsLoading,
    setError
  };

  const playlistActions = {
    setSelectedId: setSelectedPlaylistId,
    setVisible: setShowPlaylist
  };

  const colorActions = {
    setCurrent: setAccentColor,
    setOverrides: setAccentColorOverrides
  };

  const visualEffectsActions = {
    setEnabled: setVisualEffectsEnabled,
    setMenuVisible: setShowVisualEffects,
    handleFilterChange,
    handleResetFilters,
    restoreSavedFilters
  };

  return {
    track: trackState,
    playlist: playlistState,
    color: colorState,
    visualEffects: visualEffectsState,
    actions: {
      track: trackActions,
      playlist: playlistActions,
      color: colorActions,
      visualEffects: visualEffectsActions
    }
  };
};
```

### Step 3: Update AudioPlayer.tsx Usage
Update component to use grouped state:

```typescript
const AudioPlayerComponent = () => {
  const {
    track,
    playlist,
    color,
    visualEffects,
    actions
  } = usePlayerState();

  // Access state through groups
  const currentTrack = useMemo(() =>
    track.tracks[track.currentIndex] || null,
    [track.tracks, track.currentIndex]
  );

  // Use grouped actions
  const handleNext = useCallback(() => {
    if (track.tracks.length === 0) return;
    const nextIndex = (track.currentIndex + 1) % track.tracks.length;
    actions.track.setCurrentIndex(nextIndex);
  }, [track.currentIndex, track.tracks.length, actions.track.setCurrentIndex]);
```

### Step 4: Create State Selector Utilities
Add utility functions for common state selections:

```typescript
// In usePlayerState.ts or separate utilities file
export const createStateSelectors = (state: PlayerState) => ({
  // Track selectors
  getCurrentTrack: () => state.track.tracks[state.track.currentIndex] || null,
  hasTrackData: () => state.track.tracks.length > 0,
  isTrackLoading: () => state.track.isLoading,

  // Playlist selectors
  isPlaylistVisible: () => state.playlist.isVisible,
  hasSelectedPlaylist: () => !!state.playlist.selectedId,

  // Visual effects selectors
  areEffectsActive: () => state.visualEffects.enabled,
  isEffectsMenuOpen: () => state.visualEffects.menuVisible,

  // Combined selectors
  shouldShowContent: () =>
    !state.track.isLoading &&
    !state.track.error &&
    state.playlist.selectedId &&
    state.track.tracks.length > 0
});
```

### Step 5: Add State Validation
Implement validation for state consistency:

```typescript
const validatePlayerState = (state: PlayerState): string[] => {
  const errors: string[] = [];

  // Track validation
  if (state.track.currentIndex >= state.track.tracks.length && state.track.tracks.length > 0) {
    errors.push('Current track index is out of bounds');
  }

  // Color validation
  if (state.color.current && !/^#[0-9A-F]{6}$/i.test(state.color.current)) {
    errors.push('Invalid accent color format');
  }

  // Visual effects validation
  if (state.visualEffects.enabled && !state.visualEffects.filters) {
    errors.push('Visual effects enabled but no filters defined');
  }

  return errors;
};
```

### Step 6: Update Component Props Interfaces
Update components to accept grouped state:

```typescript
// For PlayerContent component
interface PlayerContentProps {
  playerState: {
    track: TrackState;
    playlist: PlaylistState;
    color: ColorState;
    visualEffects: VisualEffectsState;
  };
  actions: PlayerActions;
}
```

## Testing Requirements

### Unit Tests
- [ ] State grouping maintains all original functionality
- [ ] Grouped state updates correctly
- [ ] State selectors return correct values
- [ ] State validation catches inconsistencies
- [ ] Actions are properly grouped and functional

### Integration Tests
- [ ] Components work with grouped state interface
- [ ] State changes propagate correctly through groups
- [ ] No performance regression from state grouping
- [ ] State persistence works with new structure

### Manual Testing
- [ ] All player functionality works identically
- [ ] State updates are reflected in UI correctly
- [ ] No state synchronization issues
- [ ] Performance remains acceptable

## Dependencies
- None (can be done independently of other phases)

## Success Criteria
- [ ] State variables reduced from 24+ individual to 4 logical groups
- [ ] All functionality preserved with grouped state
- [ ] State relationships are clearer and more maintainable
- [ ] Component interfaces are simplified
- [ ] State validation is implemented

## Implementation Benefits

### Before (Current)
```typescript
// 24+ individual variables
const {
  tracks, currentTrackIndex, isLoading, error,
  selectedPlaylistId, showPlaylist, accentColor,
  // ... 17 more variables
} = usePlayerState();
```

### After (Grouped)
```typescript
// 4 logical groups + actions
const {
  track,        // { tracks, currentIndex, isLoading, error }
  playlist,     // { selectedId, isVisible }
  color,        // { current, overrides }
  visualEffects, // { enabled, menuVisible, filters }
  actions       // { track: {...}, playlist: {...}, ... }
} = usePlayerState();
```

## Advanced Features (Optional)
- **State History**: Track state changes for debugging
- **State Snapshots**: Save/restore complete player state
- **State Middleware**: Add logging, analytics, or persistence middleware
- **State Validation**: Runtime validation of state consistency
- **State Normalization**: Normalize nested state structures

## Migration Strategy
1. **Phase 1**: Update usePlayerState to return both old and new interfaces
2. **Phase 2**: Update AudioPlayer.tsx to use new interface
3. **Phase 3**: Update other components one by one
4. **Phase 4**: Remove old interface once all components migrated

## Notes
- Maintain backward compatibility during migration
- Consider using Redux Toolkit or Zustand for complex state management
- Test state performance with large track lists
- Document state shape changes for other developers
- Consider state persistence implications