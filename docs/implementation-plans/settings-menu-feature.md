# Settings Menu Feature Implementation Plan

## Overview
Convert the current standalone "Manage Videos" button into a settings icon integrated within the player controls, expanding it into a comprehensive settings menu that includes video management and other configuration options.

## Phase 1: Core Architecture & Settings Icon (Parallel Task 1)
**Agent Focus**: UI/UX and Component Structure
- Create `SettingsIcon` component following the same pattern as `PlaylistIcon`
- Design settings icon (gear/cog) with consistent styling (1.5rem SVG)
- Integrate settings icon into `ControlButtons` in `SpotifyPlayerControls`
- Add `showSettings` state management to `AudioPlayerComponent`
- Create `SettingsModal` component with dropdown/popover positioning

## Phase 2: Settings Menu Structure (Parallel Task 2)  
**Agent Focus**: Modal Architecture and Layout
- Design expandable settings menu with sections:
  - **Video Management** (existing functionality)
  - **Playback Settings** (volume preferences, auto-advance)
  - **Interface Settings** (potential future features)
- Create responsive modal design (desktop: positioned dropdown, mobile: full-screen overlay)
- Implement proper focus management and keyboard navigation
- Add backdrop blur and glass morphism effects consistent with existing modals

## Phase 3: Video Management Integration (Sequential after Phase 1)
**Agent Focus**: Existing Feature Migration
- Move video management functionality from `VideoManagementDrawer` into settings menu
- Refactor `VideoManagementDrawer` into reusable `VideoManagementSection` component
- Maintain all existing video management features:
  - Current video display and metadata
  - Video search and selection interface
  - Custom YouTube URL input
  - Settings toggles (remember choices, auto-play, backup)
- Update state management and prop threading

## Phase 4: Enhanced Settings Options (Parallel Task 3)
**Agent Focus**: Settings Expansion and Configuration
- Integrate existing `VideoManagementSettings` component
- Add playback-related settings:
  - Default volume level
  - Auto-advance preferences
  - Playlist behavior options
- Create settings persistence layer using localStorage
- Add settings export/import functionality

## Phase 5: Integration & Cleanup (Sequential Final)
**Agent Focus**: Final Integration and Cleanup
- Remove old "Manage Videos" button and `PlaylistButtonContainer`
- Update all imports and component references
- Ensure proper state management flow
- Test modal positioning and responsiveness
- Verify accessibility features (ARIA labels, keyboard navigation)

## Parallelization Strategy

### Concurrent Development Streams:
1. **Stream A**: Settings Icon & Modal Framework (Phases 1-2)
2. **Stream B**: Video Management Refactoring (Phase 3)  
3. **Stream C**: Settings Configuration System (Phase 4)

### Dependencies:
- Stream B depends on Stream A completion (needs modal framework)
- Phase 5 requires all streams to complete
- Each stream can work independently on component creation/styling

## Technical Specifications

### New Components:
- `components/SettingsIcon.tsx` - Settings gear icon with hover states
- `components/SettingsModal.tsx` - Main settings modal container
- `components/VideoManagementSection.tsx` - Refactored video management UI
- `components/SettingsSection.tsx` - Reusable settings section wrapper

### Modified Components:
- `AudioPlayer.tsx` - Remove old button, add settings state management
- `SpotifyPlayerControls.tsx` - Add SettingsIcon to ControlButtons

### Styling Consistency:
- Follow existing icon sizing (1.5rem SVG)
- Use theme accent colors and glass morphism effects
- Maintain responsive breakpoints and touch optimization
- Consistent hover/focus states with other controls

## File Structure:
```
src/components/
├── SettingsIcon.tsx          (new)
├── SettingsModal.tsx         (new) 
├── VideoManagementSection.tsx (refactored from VideoManagementDrawer)
├── SettingsSection.tsx       (new)
├── AudioPlayer.tsx           (modified)
└── SpotifyPlayerControls.tsx (modified)
```

## Testing Strategy:
- Unit tests for new components
- Integration tests for settings persistence
- Accessibility testing for modal navigation
- Responsive design testing across breakpoints
- Touch interaction testing on mobile devices

## Documentation Updates:
- Update README.md with new settings functionality
- Update CLAUDE.md architecture section
- Document new component interfaces and prop types
- Update service layer documentation for settings persistence

This plan optimizes for parallel development while maintaining clear dependencies and integration points.