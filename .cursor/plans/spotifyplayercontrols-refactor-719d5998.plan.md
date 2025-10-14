<!-- 719d5998-ffda-4d8f-86f4-027ccdc09cb0 fb9840db-131a-41a5-a342-549d66ce1eaf -->
# SpotifyPlayerControls Refactoring Plan

## Overview

Decompose the 516-line `SpotifyPlayerControls.tsx` into focused, maintainable components with extracted hooks and styled components, improving the component interface.

## Component Structure

### New Files to Create

1. **`src/hooks/useCustomAccentColors.ts`**

- Extract custom accent color logic (lines 282, 312-366)
- Manage localStorage persistence
- Handle color overrides per track
- Export: `{ customColors, handleColorChange, handleCustomColor }`

2. **`src/components/controls/styled.ts`**

- Extract all styled components (lines 15-224)
- `ControlButton`, `VolumeButton`, `TrackInfoRow`, `TrackInfoLeft/Center/Right`
- `TimelineLeft/Right`, `TrackInfoOnlyRow`, `PlayerTrackName/Artist`
- `PlayerControlsContainer`

3. **`src/components/controls/TrackInfo.tsx`**

- Extract track display section (lines 372-375)
- Props: `{ track, isMobile, isTablet }`
- Displays song name and artist

4. **`src/components/controls/PlaybackControls.tsx`**

- Extract playback buttons (lines 382-404)
- Props: `{ onPrevious, onPlay, onPause, onNext, isPlaying, accentColor, isMobile, isTablet }`
- Previous, Play/Pause, Next buttons

5. **`src/components/controls/VolumeControl.tsx`**

- Extract volume button (lines 465-483)
- Props: `{ isMuted, volume, onClick, isMobile, isTablet }`
- Volume icon states with mute/unmute

6. **`src/components/controls/ControlsToolbar.tsx`**

- Extract controls row (lines 378-412)
- Combines PlaybackControls + PlaylistButton
- Props: `{ playbackProps, onShowPlaylist, accentColor, isMobile, isTablet }`

7. **`src/components/controls/EffectsControls.tsx`**

- Extract visual effects controls (lines 417-452)
- Glow toggle + Visual effects menu button
- Props: `{ glowEnabled, onGlowToggle, showVisualEffects, onShowVisualEffects, accentColor, isMobile, isTablet }`

8. **`src/components/controls/TimelineControls.tsx`**

- Extract timeline row (lines 415-509)
- Combines EffectsControls + ColorPicker + VolumeControl + TimelineSlider + LikeButton
- Props: `{ timelineProps, effectsProps, colorProps, volumeProps, likeProps }`

9. **`src/components/SpotifyPlayerControls.tsx` (refactored)**

- Main orchestrator component
- Compose all sub-components
- Manage state via hooks
- Cleaner props interface

## Implementation Steps

### Phase 1: Extract Hooks

- Create `useCustomAccentColors` hook
- Move localStorage logic and state management
- Test hook in isolation

### Phase 2: Extract Styled Components

- Create `src/components/controls/styled.ts`
- Move all styled-components definitions
- Ensure proper theme typing

### Phase 3: Create Presentational Components

- Extract `TrackInfo` component
- Extract `PlaybackControls` component
- Extract `VolumeControl` component
- Extract `EffectsControls` component
- Each should be memoized with custom comparison functions

### Phase 4: Create Composite Components

- Create `ControlsToolbar` (combines playback + playlist button)
- Create `TimelineControls` (combines timeline row elements)
- Maintain proper prop drilling and composition

### Phase 5: Refactor Main Component

- Update `SpotifyPlayerControls` to use new sub-components
- Simplify props interface (group related props)
- Update imports and exports
- Ensure backward compatibility is intentionally broken with better API

### Phase 6: Cleanup

- Remove old styled components from main file
- Update any imports in parent components
- Verify all functionality works
- Check for linter errors

## Key Improvements

1. **Separation of Concerns**: Logic, styles, and presentation separated
2. **Reusability**: Sub-components can be used independently
3. **Maintainability**: Each file < 150 lines, focused responsibility
4. **Testing**: Smaller components easier to test
5. **Performance**: Memoization at component boundaries
6. **Better API**: Grouped props reduce prop drilling

## Files Modified

- `src/components/SpotifyPlayerControls.tsx` (refactored)

## Files Created

- `src/hooks/useCustomAccentColors.ts`
- `src/components/controls/styled.ts`
- `src/components/controls/TrackInfo.tsx`
- `src/components/controls/PlaybackControls.tsx`
- `src/components/controls/VolumeControl.tsx`
- `src/components/controls/ControlsToolbar.tsx`
- `src/components/controls/EffectsControls.tsx`
- `src/components/controls/TimelineControls.tsx`

### To-dos

- [ ] Create useCustomAccentColors hook with localStorage logic
- [ ] Create controls/styled.ts with all styled components
- [ ] Create TrackInfo component for song name and artist display
- [ ] Create PlaybackControls component with prev/play/next buttons
- [ ] Create VolumeControl component with volume button and icon states
- [ ] Create EffectsControls component with glow toggle and visual effects button
- [ ] Create ControlsToolbar composite component
- [ ] Create TimelineControls composite component
- [ ] Refactor main SpotifyPlayerControls to compose sub-components with improved props interface
- [ ] Test all functionality and check for linter errors