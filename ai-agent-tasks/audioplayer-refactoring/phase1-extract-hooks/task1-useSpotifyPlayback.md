# Task 1: Extract useSpotifyPlayback Hook

## Objective
Extract the complex `playTrack` function (lines 146-196) and related Spotify playback logic into a reusable custom hook.

## Current Issues
- 50-line `playTrack` function embedded in component
- Complex async logic with nested try-catch blocks
- Multiple setTimeout calls and state management
- Device activation logic mixed with track playing

## Files to Modify
- **Create**: `src/hooks/useSpotifyPlayback.ts`
- **Modify**: `src/components/AudioPlayer.tsx` (remove playTrack function, use hook)

## Implementation Steps

### Step 1: Create the Hook File
Create `src/hooks/useSpotifyPlayback.ts` with the following structure:

```typescript
import { useCallback } from 'react';
import { spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';

interface UseSpotifyPlaybackProps {
  tracks: SpotifyTrack[];
  setCurrentTrackIndex: (index: number) => void;
}

export const useSpotifyPlayback = ({ tracks, setCurrentTrackIndex }: UseSpotifyPlaybackProps) => {
  // Extract playTrack logic here
  // Extract device activation logic
  // Extract resume logic

  return {
    playTrack,
    resumePlayback,
    activateDevice
  };
};
```

### Step 2: Extract Core Logic
Move the following logic from AudioPlayer.tsx:146-196:
- Authentication check
- Track URI playing via `spotifyPlayer.playTrack()`
- State management for `currentTrackIndex`
- Device activation with timeout
- Resume logic with error handling

### Step 3: Break Down Complex Logic
Split the current `playTrack` function into smaller functions:
- `playTrack(index: number)` - Main entry point
- `activateDevice()` - Device activation logic
- `handlePlaybackResume()` - Resume logic with timeout

### Step 4: Update AudioPlayer.tsx
Replace the current `playTrack` function with:
```typescript
const { playTrack } = useSpotifyPlayback({
  tracks,
  setCurrentTrackIndex
});
```

### Step 5: Update Dependencies
Update all references to `playTrack` in AudioPlayer.tsx:
- `handleNext` function usage
- `handlePrevious` function usage
- `usePlaylistManager` hook dependency
- Auto-advance logic usage

## Testing Requirements

### Unit Tests
- [ ] Hook returns expected functions
- [ ] `playTrack` handles valid track indices
- [ ] `playTrack` handles invalid indices gracefully
- [ ] Authentication check works correctly
- [ ] Device activation logic functions properly

### Integration Tests
- [ ] Hook works with AudioPlayer component
- [ ] Track playback functions as before
- [ ] Error handling maintains existing behavior
- [ ] State updates work correctly

### Manual Testing
- [ ] Play button starts tracks correctly
- [ ] Next/Previous buttons work
- [ ] Auto-advance functionality preserved
- [ ] Error states display appropriately

## Dependencies
- None (this is the foundational hook for the initiative)

## Success Criteria
- [ ] `playTrack` function removed from AudioPlayer.tsx
- [ ] All playback functionality preserved
- [ ] Hook is reusable and well-typed
- [ ] Error handling maintained
- [ ] Performance not degraded

## Notes
- This hook will be used by the `useAutoAdvance` hook in Task 2
- Consider extracting common Spotify API patterns for reuse
- Ensure proper cleanup of timeouts and intervals
- Maintain existing error handling patterns for consistency