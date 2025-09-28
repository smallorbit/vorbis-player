# Task 3: Extract useAccentColor Hook

## Objective
Extract the color extraction and accent color management logic (lines 293-315, 360-391) into a dedicated custom hook.

## Current Issues
- Color extraction logic embedded in useEffect
- Complex accent color override handling spread across multiple functions
- Manual color extraction with fallback logic
- Tight coupling between color management and component state

## Files to Modify
- **Create**: `src/hooks/useAccentColor.ts`
- **Modify**: `src/components/AudioPlayer.tsx` (remove color extraction useEffect and handleAccentColorChange)

## Implementation Steps

### Step 1: Create the Hook File
Create `src/hooks/useAccentColor.ts` with the following structure:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { extractDominantColor } from '../utils/colorExtractor';
import { theme } from '../styles/theme';

interface UseAccentColorProps {
  currentTrack: SpotifyTrack | null;
  initialOverrides?: Record<string, string>;
}

export const useAccentColor = ({
  currentTrack,
  initialOverrides = {}
}: UseAccentColorProps) => {
  // State for current accent color
  // State for color overrides
  // Color extraction logic
  // Override management functions

  return {
    accentColor,
    accentColorOverrides,
    setAccentColorOverride,
    resetAccentColorOverride,
    setAccentColorOverrides
  };
};
```

### Step 2: Extract Color Extraction Logic
Move the color extraction logic from AudioPlayer.tsx:293-315:
- Check for existing overrides first
- Extract color from `currentTrack.image` using `extractDominantColor`
- Fallback to `theme.colors.accent` on error or no image
- Handle async color extraction with proper error handling

### Step 3: Extract Override Management
Move the accent color override logic from AudioPlayer.tsx:360-391:
- `handleAccentColorChange` function becomes `setAccentColorOverride`
- Reset logic for 'RESET_TO_DEFAULT' special value
- Override storage in state object keyed by track ID

### Step 4: Simplify Color Override Logic
Break down the complex `handleAccentColorChange` into smaller functions:
- `setAccentColorOverride(trackId: string, color: string)` - Set override for specific track
- `resetAccentColorOverride(trackId: string)` - Reset track to extracted color
- `extractColorForTrack(track: SpotifyTrack)` - Extract color for given track

### Step 5: Add Color Extraction Optimization
Enhance with performance optimizations:
- Memoize color extraction results
- Skip re-extraction if track image hasn't changed
- Debounce rapid track changes to prevent excessive extraction

### Step 6: Update AudioPlayer.tsx
Replace the current color management with:
```typescript
const {
  accentColor,
  accentColorOverrides,
  setAccentColorOverride,
  resetAccentColorOverride,
  setAccentColorOverrides
} = useAccentColor({
  currentTrack,
  initialOverrides: {} // Could load from localStorage
});
```

## Testing Requirements

### Unit Tests
- [ ] Hook extracts colors correctly from track images
- [ ] Hook handles missing images gracefully
- [ ] Override management functions work correctly
- [ ] Reset functionality restores extracted colors
- [ ] Fallback to theme color when extraction fails

### Integration Tests
- [ ] Hook integrates with AudioPlayer component
- [ ] Color changes trigger UI updates
- [ ] Override persistence works correctly
- [ ] Performance optimizations don't break functionality

### Manual Testing
- [ ] Accent colors update when tracks change
- [ ] Color overrides can be set and reset
- [ ] Fallback colors display when extraction fails
- [ ] Performance is acceptable for rapid track changes

## Dependencies
- None (independent of other Phase 1 tasks)

## Success Criteria
- [ ] Color extraction useEffect removed from AudioPlayer.tsx
- [ ] `handleAccentColorChange` function removed from AudioPlayer.tsx
- [ ] All color management functionality preserved
- [ ] Hook is reusable and well-typed
- [ ] Performance maintained or improved

## Implementation Details

### Color Extraction with Caching
```typescript
const [colorCache, setColorCache] = useState<Record<string, string>>({});

const extractColorForTrack = useCallback(async (track: SpotifyTrack) => {
  if (!track.image) return theme.colors.accent;

  // Check cache first
  if (colorCache[track.id]) {
    return colorCache[track.id];
  }

  try {
    const dominantColor = await extractDominantColor(track.image);
    const color = dominantColor?.hex || theme.colors.accent;

    // Cache the result
    setColorCache(prev => ({ ...prev, [track.id]: color }));
    return color;
  } catch {
    return theme.colors.accent;
  }
}, [colorCache]);
```

### Override Management
```typescript
const setAccentColorOverride = useCallback((trackId: string, color: string) => {
  setAccentColorOverrides(prev => ({ ...prev, [trackId]: color }));
}, []);

const resetAccentColorOverride = useCallback(async (trackId: string) => {
  // Remove override
  setAccentColorOverrides(prev => {
    const newOverrides = { ...prev };
    delete newOverrides[trackId];
    return newOverrides;
  });

  // Re-extract color for current track if it matches
  if (currentTrack?.id === trackId) {
    const extractedColor = await extractColorForTrack(currentTrack);
    setAccentColor(extractedColor);
  }
}, [currentTrack, extractColorForTrack]);
```

## Advanced Features (Optional)
- **Color History**: Track recently used colors
- **Color Validation**: Ensure sufficient contrast for accessibility
- **Preload Colors**: Extract colors for upcoming tracks
- **Color Preferences**: User-defined color preferences per artist/album

## Notes
- Consider persisting color overrides to localStorage
- Ensure proper cleanup of async operations
- Test with various image formats and sizes
- Consider adding color theme generation (complementary colors, etc.)