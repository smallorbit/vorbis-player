# Task 2: Extract PlayerControls Component

## Objective
Create a wrapper component that manages all player control-related state and handlers, simplifying the interface between AudioPlayer and SpotifyPlayerControls.

## Current Issues
- Multiple control-related handlers scattered in AudioPlayer
- Complex props interface for SpotifyPlayerControls
- Control state management mixed with main component logic
- No centralized control event handling

## Files to Modify
- **Create**: `src/components/PlayerControls.tsx`
- **Modify**: `src/components/AudioPlayer.tsx` (replace direct SpotifyPlayerControls usage)
- **Modify**: `src/components/PlayerContent.tsx` (use PlayerControls instead of SpotifyPlayerControls)

## Implementation Steps

### Step 1: Create the PlayerControls Component
Create `src/components/PlayerControls.tsx` with the following structure:

```typescript
import React from 'react';
import SpotifyPlayerControls from './SpotifyPlayerControls';

interface PlayerControlsProps {
  currentTrack: SpotifyTrack | null;
  accentColor: string;
  trackCount: number;
  visualEffectsEnabled: boolean;
  // Simplified handler interface
  onPlayback: {
    play: () => void;
    pause: () => void;
    next: () => void;
    previous: () => void;
  };
  onUI: {
    showPlaylist: () => void;
    showVisualEffects: () => void;
    toggleVisualEffects: () => void;
  };
  onAccentColorChange: (color: string) => void;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({ ... }) => {
  return (
    <SpotifyPlayerControls
      currentTrack={currentTrack}
      accentColor={accentColor}
      onPlay={onPlayback.play}
      onPause={onPlayback.pause}
      onNext={onPlayback.next}
      onPrevious={onPlayback.previous}
      onShowPlaylist={onUI.showPlaylist}
      trackCount={trackCount}
      onAccentColorChange={onAccentColorChange}
      onShowVisualEffects={onUI.showVisualEffects}
      glowEnabled={visualEffectsEnabled}
      onGlowToggle={onUI.toggleVisualEffects}
    />
  );
};
```

### Step 2: Group Handler Props
Organize handlers into logical groups to reduce prop drilling:

```typescript
interface PlaybackHandlers {
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
}

interface UIHandlers {
  showPlaylist: () => void;
  showVisualEffects: () => void;
  toggleVisualEffects: () => void;
}
```

### Step 3: Add Control State Management
Enhance the component with local control state:

```typescript
const PlayerControls: React.FC<PlayerControlsProps> = (props) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

  // Control state logic
  const handlePlayClick = useCallback(() => {
    setIsPlaying(true);
    props.onPlayback.play();
  }, [props.onPlayback.play]);

  const handlePauseClick = useCallback(() => {
    setIsPlaying(false);
    props.onPlayback.pause();
  }, [props.onPlayback.pause]);

  // Additional control logic
};
```

### Step 4: Add Keyboard Shortcuts
Integrate keyboard shortcuts for controls:

```typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        isPlaying ? handlePauseClick() : handlePlayClick();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        props.onPlayback.previous();
        break;
      case 'ArrowRight':
        event.preventDefault();
        props.onPlayback.next();
        break;
      // Additional shortcuts
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [isPlaying, handlePlayClick, handlePauseClick, props.onPlayback]);
```

### Step 5: Add Control Validation
Add validation for control actions:

```typescript
const handleNext = useCallback(() => {
  if (props.trackCount > 0) {
    props.onPlayback.next();
  }
}, [props.onPlayback.next, props.trackCount]);

const handlePrevious = useCallback(() => {
  if (props.trackCount > 0) {
    props.onPlayback.previous();
  }
}, [props.onPlayback.previous, props.trackCount]);
```

### Step 6: Update PlayerContent.tsx
Replace SpotifyPlayerControls usage with PlayerControls:

```typescript
<PlayerControls
  currentTrack={track.current}
  accentColor={ui.accentColor}
  trackCount={track.list.length}
  visualEffectsEnabled={effects.enabled}
  onPlayback={{
    play: handlers.onPlay,
    pause: handlers.onPause,
    next: handlers.onNext,
    previous: handlers.onPrevious
  }}
  onUI={{
    showPlaylist: handlers.onShowPlaylist,
    showVisualEffects: handlers.onShowVisualEffects,
    toggleVisualEffects: handlers.onGlowToggle
  }}
  onAccentColorChange={handlers.onAccentColorChange}
/>
```

## Testing Requirements

### Unit Tests
- [ ] Component renders SpotifyPlayerControls correctly
- [ ] Handler props are passed through correctly
- [ ] Keyboard shortcuts work as expected
- [ ] Control validation prevents invalid actions
- [ ] State management works correctly

### Integration Tests
- [ ] Component integrates with PlayerContent
- [ ] Handlers are called from parent components correctly
- [ ] Keyboard shortcuts don't conflict with other components
- [ ] Control state synchronizes with actual playback state

### Manual Testing
- [ ] All control buttons work correctly
- [ ] Keyboard shortcuts function properly
- [ ] Visual effects toggle works
- [ ] Playlist controls function correctly
- [ ] Accent color changes work

## Dependencies
- **Optional**: Can be done independently of other tasks
- **Recommended**: Complete Task 1 (PlayerContent) first for better integration

## Success Criteria
- [ ] PlayerControls component successfully wraps SpotifyPlayerControls
- [ ] Handler prop interface is simplified and grouped
- [ ] Keyboard shortcuts are implemented
- [ ] Control validation is added
- [ ] All existing functionality preserved

## Implementation Details

### Keyboard Shortcut Mapping
```typescript
const KEYBOARD_SHORTCUTS = {
  PLAY_PAUSE: 'Space',
  NEXT_TRACK: 'ArrowRight',
  PREVIOUS_TRACK: 'ArrowLeft',
  TOGGLE_PLAYLIST: 'KeyP',
  TOGGLE_VISUAL_EFFECTS: 'KeyV',
  VOLUME_UP: 'ArrowUp',
  VOLUME_DOWN: 'ArrowDown',
  MUTE: 'KeyM'
} as const;
```

### Handler Grouping Pattern
```typescript
// Instead of passing 10+ individual handlers
const handlers = {
  playback: {
    play: handlePlay,
    pause: handlePause,
    next: handleNext,
    previous: handlePrevious
  },
  ui: {
    showPlaylist: handleShowPlaylist,
    showVisualEffects: handleShowVisualEffects,
    toggleVisualEffects: handleVisualEffectsToggle
  },
  settings: {
    changeAccentColor: handleAccentColorChange
  }
};
```

### Control State Synchronization
```typescript
// Sync with actual Spotify player state
useEffect(() => {
  const updateControlState = (state: SpotifyPlaybackState | null) => {
    if (state) {
      setIsPlaying(!state.paused);
      setVolume(state.volume);
    }
  };

  spotifyPlayer.onPlayerStateChanged(updateControlState);
  return () => spotifyPlayer.removePlayerStateListener(updateControlState);
}, []);
```

## Advanced Features (Optional)
- **Control History**: Track recently used controls for accessibility
- **Custom Shortcuts**: User-configurable keyboard shortcuts
- **Control Animation**: Visual feedback for control interactions
- **Touch Gestures**: Swipe gestures for mobile control
- **Voice Commands**: Basic voice control integration

## Notes
- Consider adding haptic feedback for mobile devices
- Ensure keyboard shortcuts don't interfere with form inputs
- Add proper ARIA labels for accessibility
- Test control responsiveness on different devices
- Consider adding control state persistence