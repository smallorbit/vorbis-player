# Task 2: Extract useAutoAdvance Hook

## Objective
Extract the song end detection and auto-advance functionality (lines 234-277) into a dedicated custom hook.

## Current Issues
- Complex useEffect with polling logic embedded in main component
- Manual interval management and cleanup
- Song end detection logic mixed with component lifecycle
- Tight coupling with track playing functionality

## Files to Modify
- **Create**: `src/hooks/useAutoAdvance.ts`
- **Modify**: `src/components/AudioPlayer.tsx` (remove auto-advance useEffect, use hook)

## Implementation Steps

### Step 1: Create the Hook File
Create `src/hooks/useAutoAdvance.ts` with the following structure:

```typescript
import { useEffect, useRef } from 'react';
import { spotifyPlayer } from '../services/spotifyPlayer';

interface UseAutoAdvanceProps {
  tracks: SpotifyTrack[];
  currentTrackIndex: number;
  playTrack: (index: number) => void;
  enabled?: boolean;
}

export const useAutoAdvance = ({
  tracks,
  currentTrackIndex,
  playTrack,
  enabled = true
}: UseAutoAdvanceProps) => {
  // Extract auto-advance logic here
};
```

### Step 2: Extract Song End Detection Logic
Move the following logic from AudioPlayer.tsx:234-277:
- Polling interval setup and cleanup
- Song end detection via `spotifyPlayer.getCurrentState()`
- Time remaining calculation (`duration - position`)
- End-of-song threshold logic (2000ms or 1000ms)

### Step 3: Extract Auto-Advance Logic
Move the track advancement logic:
- Next track index calculation: `(currentTrackIndex + 1) % tracks.length`
- Track playing with delay: `setTimeout(() => playTrack(nextIndex), 500)`
- `hasEnded` flag management to prevent duplicate advances

### Step 4: Improve State Management
Enhance the hook with better state management:
- Use `useRef` for `hasEnded` flag instead of closure variable
- Use `useRef` for `pollInterval` instead of closure variable
- Add proper cleanup in useEffect return function

### Step 5: Add Configuration Options
Make the hook more flexible:
- `enabled` prop to turn auto-advance on/off
- `pollInterval` prop to configure polling frequency (default 2000ms)
- `endThreshold` prop to configure end detection sensitivity (default 2000ms)

### Step 6: Update AudioPlayer.tsx
Replace the current auto-advance useEffect with:
```typescript
useAutoAdvance({
  tracks,
  currentTrackIndex,
  playTrack,
  enabled: true
});
```

## Testing Requirements

### Unit Tests
- [ ] Hook sets up polling when tracks are available
- [ ] Hook cleans up intervals on unmount
- [ ] Song end detection works correctly
- [ ] Auto-advance triggers at proper threshold
- [ ] `hasEnded` flag prevents duplicate advances
- [ ] Hook respects `enabled` configuration

### Integration Tests
- [ ] Hook works with useSpotifyPlayback hook
- [ ] Auto-advance integrates with AudioPlayer component
- [ ] Polling doesn't interfere with manual track changes
- [ ] Cleanup prevents memory leaks

### Manual Testing
- [ ] Songs automatically advance when ending
- [ ] Auto-advance doesn't trigger during manual track changes
- [ ] Loop behavior works (last track → first track)
- [ ] No duplicate track playing events

## Dependencies
- **Requires**: Task 1 (useSpotifyPlayback) must be completed first
- **Reason**: This hook depends on the `playTrack` function from useSpotifyPlayback

## Success Criteria
- [ ] Auto-advance useEffect removed from AudioPlayer.tsx
- [ ] Song end detection functionality preserved
- [ ] Auto-advance behavior identical to current implementation
- [ ] Hook is configurable and reusable
- [ ] No memory leaks from interval management

## Implementation Details

### Polling Strategy
```typescript
const pollInterval = useRef<number>();
const hasEnded = useRef(false);

useEffect(() => {
  if (!enabled || tracks.length === 0) return;

  const checkForSongEnd = async () => {
    // Song end detection logic
  };

  pollInterval.current = setInterval(checkForSongEnd, 2000);

  return () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
    }
  };
}, [tracks, currentTrackIndex, playTrack, enabled]);
```

### End Detection Logic
```typescript
const timeRemaining = duration - position;
if (!hasEnded.current &&
    duration > 0 &&
    position > 0 &&
    (timeRemaining <= 2000 || position >= duration - 1000)) {
  // Trigger auto-advance
}
```

## Notes
- Consider making polling interval configurable for different use cases
- Ensure proper error handling for Spotify API calls
- Test edge cases like very short tracks (<3 seconds)
- Consider adding optional callback for track change events