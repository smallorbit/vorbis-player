# Task 2: Reduce Prop Drilling

## Objective
Implement React Context providers to eliminate excessive prop drilling and simplify component interfaces throughout the player hierarchy.

## Current Issues
- Deep prop drilling from AudioPlayer → PlayerContent → SpotifyPlayerControls
- Complex handler prop interfaces with 10+ individual functions
- Repeated prop passing through intermediate components
- Tight coupling between parent and deeply nested components

## Current Prop Drilling Examples
```typescript
// AudioPlayer passes many props to PlayerContent
<PlayerContent
  currentTrack={currentTrack}
  accentColor={accentColor}
  visualEffectsEnabled={visualEffectsEnabled}
  effectiveGlow={effectiveGlow}
  albumFilters={albumFilters}
  tracks={tracks}
  currentTrackIndex={currentTrackIndex}
  showVisualEffects={showVisualEffects}
  showPlaylist={showPlaylist}
  onPlay={handlePlay}
  onPause={handlePause}
  onNext={handleNext}
  onPrevious={handlePrevious}
  // ... 15+ more props
/>
```

## Files to Modify
- **Create**: `src/contexts/PlayerContext.tsx`
- **Create**: `src/contexts/PlayerActionsContext.tsx`
- **Create**: `src/contexts/VisualEffectsContext.tsx`
- **Modify**: `src/components/AudioPlayer.tsx` (add context providers)
- **Modify**: All child components (consume contexts instead of props)

## Implementation Steps

### Step 1: Create PlayerContext
Create `src/contexts/PlayerContext.tsx` for state data:

```typescript
import React, { createContext, useContext, ReactNode } from 'react';

interface PlayerContextValue {
  track: {
    current: SpotifyTrack | null;
    list: SpotifyTrack[];
    currentIndex: number;
    isLoading: boolean;
    error: string | null;
  };
  playlist: {
    selectedId: string | null;
    isVisible: boolean;
  };
  ui: {
    accentColor: string;
    showVisualEffects: boolean;
  };
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export const PlayerProvider: React.FC<{
  value: PlayerContextValue;
  children: ReactNode;
}> = ({ value, children }) => (
  <PlayerContext.Provider value={value}>
    {children}
  </PlayerContext.Provider>
);

export const usePlayerContext = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayerContext must be used within a PlayerProvider');
  }
  return context;
};
```

### Step 2: Create PlayerActionsContext
Create `src/contexts/PlayerActionsContext.tsx` for action handlers:

```typescript
import React, { createContext, useContext, ReactNode } from 'react';

interface PlayerActionsContextValue {
  playback: {
    play: () => void;
    pause: () => void;
    next: () => void;
    previous: () => void;
    playTrack: (index: number) => void;
  };
  ui: {
    showPlaylist: () => void;
    hidePlaylist: () => void;
    showVisualEffects: () => void;
    hideVisualEffects: () => void;
    toggleVisualEffects: () => void;
  };
  settings: {
    changeAccentColor: (color: string) => void;
    resetAccentColor: () => void;
  };
}

const PlayerActionsContext = createContext<PlayerActionsContextValue | null>(null);

export const PlayerActionsProvider: React.FC<{
  value: PlayerActionsContextValue;
  children: ReactNode;
}> = ({ value, children }) => (
  <PlayerActionsContext.Provider value={value}>
    {children}
  </PlayerActionsContext.Provider>
);

export const usePlayerActions = () => {
  const context = useContext(PlayerActionsContext);
  if (!context) {
    throw new Error('usePlayerActions must be used within a PlayerActionsProvider');
  }
  return context;
};
```

### Step 3: Create VisualEffectsContext
Create `src/contexts/VisualEffectsContext.tsx` for visual effects state:

```typescript
import React, { createContext, useContext, ReactNode } from 'react';

interface VisualEffectsContextValue {
  state: {
    enabled: boolean;
    menuVisible: boolean;
    filters: AlbumArtFilters;
    glow: {
      intensity: number;
      rate: number;
    };
  };
  actions: {
    toggleEnabled: () => void;
    showMenu: () => void;
    hideMenu: () => void;
    updateFilter: (filter: string, value: number) => void;
    resetFilters: () => void;
    updateGlow: (intensity: number, rate: number) => void;
  };
}

const VisualEffectsContext = createContext<VisualEffectsContextValue | null>(null);

export const VisualEffectsProvider: React.FC<{
  value: VisualEffectsContextValue;
  children: ReactNode;
}> = ({ value, children }) => (
  <VisualEffectsContext.Provider value={value}>
    {children}
  </VisualEffectsContext.Provider>
);

export const useVisualEffects = () => {
  const context = useContext(VisualEffectsContext);
  if (!context) {
    throw new Error('useVisualEffects must be used within a VisualEffectsProvider');
  }
  return context;
};
```

### Step 4: Update AudioPlayer.tsx with Context Providers
Wrap components with context providers:

```typescript
const AudioPlayerComponent = () => {
  // ... existing state and handlers

  const playerContextValue: PlayerContextValue = {
    track: {
      current: currentTrack,
      list: tracks,
      currentIndex: currentTrackIndex,
      isLoading,
      error
    },
    playlist: {
      selectedId: selectedPlaylistId,
      isVisible: showPlaylist
    },
    ui: {
      accentColor,
      showVisualEffects
    }
  };

  const playerActionsValue: PlayerActionsContextValue = {
    playback: {
      play: handlePlay,
      pause: handlePause,
      next: handleNext,
      previous: handlePrevious,
      playTrack
    },
    ui: {
      showPlaylist: handleShowPlaylist,
      hidePlaylist: handleClosePlaylist,
      showVisualEffects: handleShowVisualEffects,
      hideVisualEffects: handleCloseVisualEffects,
      toggleVisualEffects: handleVisualEffectsToggle
    },
    settings: {
      changeAccentColor: handleAccentColorChange,
      resetAccentColor: () => handleAccentColorChange('RESET_TO_DEFAULT')
    }
  };

  return (
    <Container>
      <PlayerProvider value={playerContextValue}>
        <PlayerActionsProvider value={playerActionsValue}>
          <VisualEffectsProvider value={visualEffectsContextValue}>
            {renderContent()}
          </VisualEffectsProvider>
        </PlayerActionsProvider>
      </PlayerProvider>
    </Container>
  );
};
```

### Step 5: Update PlayerContent Component
Remove props and use contexts:

```typescript
// Before: Heavy props interface
interface PlayerContentProps {
  currentTrack: SpotifyTrack | null;
  accentColor: string;
  visualEffectsEnabled: boolean;
  // ... 20+ more props
}

// After: No props needed
const PlayerContent: React.FC = () => {
  const { track, ui } = usePlayerContext();
  const visualEffects = useVisualEffects();

  return (
    <ContentWrapper>
      <LoadingCard
        backgroundImage={track.current?.image}
        accentColor={ui.accentColor}
        glowEnabled={visualEffects.state.enabled}
        glowIntensity={visualEffects.state.glow.intensity}
        glowRate={visualEffects.state.glow.rate}
      >
        {/* Content using context data */}
      </LoadingCard>
    </ContentWrapper>
  );
};
```

### Step 6: Update SpotifyPlayerControls Component
Consume contexts directly:

```typescript
const SpotifyPlayerControls: React.FC = () => {
  const { track, ui } = usePlayerContext();
  const { playback, ui: uiActions } = usePlayerActions();
  const visualEffects = useVisualEffects();

  return (
    <ControlsContainer>
      <PlayButton onClick={playback.play} disabled={!track.current} />
      <NextButton onClick={playback.next} disabled={track.list.length === 0} />
      {/* Other controls using context actions */}
    </ControlsContainer>
  );
};
```

### Step 7: Add Context Selectors
Create selector hooks for optimized context consumption:

```typescript
// In PlayerContext.tsx
export const useCurrentTrack = () => {
  const { track } = usePlayerContext();
  return track.current;
};

export const useTrackList = () => {
  const { track } = usePlayerContext();
  return track.list;
};

export const useAccentColor = () => {
  const { ui } = usePlayerContext();
  return ui.accentColor;
};

// In PlayerActionsContext.tsx
export const usePlaybackActions = () => {
  const { playback } = usePlayerActions();
  return playback;
};

export const useUIActions = () => {
  const { ui } = usePlayerActions();
  return ui;
};
```

## Testing Requirements

### Unit Tests
- [ ] Contexts provide correct values to consumers
- [ ] Context hooks throw errors when used outside providers
- [ ] Selector hooks return correct data
- [ ] Context updates trigger re-renders correctly
- [ ] Error boundaries work with context errors

### Integration Tests
- [ ] Components work correctly with context data
- [ ] Actions flow correctly through context
- [ ] Context providers don't cause unnecessary re-renders
- [ ] Context data synchronizes correctly with state changes

### Performance Tests
- [ ] Context updates don't cause excessive re-renders
- [ ] Selector hooks optimize rendering correctly
- [ ] Context providers don't impact initial render performance
- [ ] Memory usage remains stable with context implementation

### Manual Testing
- [ ] All player functionality works identically
- [ ] Context data updates reflect in UI correctly
- [ ] No state synchronization issues
- [ ] Performance remains acceptable

## Dependencies
- **Recommended**: Complete Task 1 (Group Related State) first for cleaner context values
- **Optional**: Can be done independently but will benefit from grouped state

## Success Criteria
- [ ] Prop drilling eliminated from component hierarchy
- [ ] Component interfaces simplified dramatically
- [ ] Context providers implemented correctly
- [ ] All functionality preserved
- [ ] Performance maintained or improved

## Implementation Benefits

### Before (Prop Drilling)
```typescript
// AudioPlayer.tsx
<PlayerContent
  currentTrack={currentTrack}
  accentColor={accentColor}
  onPlay={handlePlay}
  onPause={handlePause}
  // ... 20+ more props
/>

// PlayerContent.tsx
<SpotifyPlayerControls
  currentTrack={props.currentTrack}
  accentColor={props.accentColor}
  onPlay={props.onPlay}
  onPause={props.onPause}
  // ... passing through 20+ props
/>
```

### After (Context)
```typescript
// AudioPlayer.tsx
<PlayerProvider value={contextValue}>
  <PlayerContent />
</PlayerProvider>

// PlayerContent.tsx
<SpotifyPlayerControls />

// SpotifyPlayerControls.tsx
const { track } = usePlayerContext();
const { playback } = usePlayerActions();
```

## Context Performance Optimization

### Prevent Unnecessary Re-renders
```typescript
const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { track, playlist, ui } = usePlayerState();

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    track,
    playlist,
    ui
  }), [track, playlist, ui]);

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
    </PlayerContext.Provider>
  );
};
```

### Selective Context Subscriptions
```typescript
// Only re-render when current track changes
const useCurrentTrackOnly = () => {
  const { track } = usePlayerContext();
  return useMemo(() => track.current, [track.current]);
};
```

## Advanced Features (Optional)
- **Context Middleware**: Add logging, analytics, or debugging middleware
- **Context Persistence**: Persist context state to localStorage
- **Context DevTools**: Add React DevTools integration
- **Context Testing**: Add context testing utilities
- **Context Composition**: Compose multiple contexts efficiently

## Notes
- Consider context splitting strategy to minimize re-renders
- Test context performance with large playlists
- Ensure proper context provider nesting order
- Add TypeScript strict mode for context interfaces
- Consider using React Query or SWR for server state management