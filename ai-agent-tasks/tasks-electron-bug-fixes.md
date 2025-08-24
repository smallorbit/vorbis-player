# Tasks: Electron Bug Fixes

## Relevant Files

- `src/components/AudioPlayer.tsx` - Main audio player component that manages Electron-specific rendering and state. Contains the logic for handling playlist and visual effects in Electron mode.
- `src/components/LibraryNavigation.tsx` - Library navigation component that needs an exit/close button to return to the main player view.
- `src/components/SpotifyPlayerControls.tsx` - Player controls component containing the playlist and visual effects buttons that need to work properly in Electron mode.
- `src/hooks/usePlayerState.ts` - State management hook that controls showPlaylist and showVisualEffects states.
- `src/utils/environment.ts` - Utility to detect if running in Electron mode.

### Notes

- All testing should be done specifically in Electron mode (`npm run electron:dev`)
- The bugs only affect Electron mode, not web mode
- Use the existing state management patterns in the codebase
- Maintain consistency with the existing UI/UX design patterns
- Test each fix independently before moving to the next

## Tasks

- [ ] 1.0 Fix Playlist Button (Music Library Toggle)
  - [ ] 1.1 Analyze current playlist button implementation in SpotifyPlayerControls.tsx
  - [ ] 1.2 Identify the handleShowPlaylist function in AudioPlayer.tsx and understand current behavior
  - [ ] 1.3 Update handleShowPlaylist to properly switch LibraryNavigation to Spotify view when clicked
  - [ ] 1.4 Ensure showPlaylist state correctly controls the activeSource prop in LibraryNavigation
  - [ ] 1.5 Update LibraryNavigation to respond to showPlaylist changes by switching to 'spotify' source
  - [ ] 1.6 Test playlist button toggles between local music view and Spotify playlist view
  - [ ] 1.7 Verify the button works correctly in both directions (show and hide playlist)
  
- [ ] 2.0 Add Library Exit Functionality
  - [ ] 2.1 Design the exit button placement in LibraryNavigation.tsx (header or floating button)
  - [ ] 2.2 Create a "Close Library" or "Back to Player" button component with appropriate styling
  - [ ] 2.3 Add state management for library visibility (separate from playlist visibility)
  - [ ] 2.4 Implement handleCloseLibrary function that minimizes/hides the library navigation
  - [ ] 2.5 Connect the close button to the handler function
  - [ ] 2.6 Ensure the close action doesn't interrupt current music playback
  - [ ] 2.7 Test that the exit button returns user to main player view
  - [ ] 2.8 Verify the library can be reopened after closing
  
- [ ] 3.0 Fix Visual Effects Menu Button
  - [ ] 3.1 Locate the visual effects button in SpotifyPlayerControls.tsx (line ~358-374)
  - [ ] 3.2 Identify why VisualEffectsMenu is not rendering properly in Electron mode
  - [ ] 3.3 Fix the Electron render path in AudioPlayer.tsx to include VisualEffectsMenu outside the visualEffectsEnabled conditional
  - [ ] 3.4 Ensure onShowVisualEffects handler properly toggles the visual effects menu visibility
  - [ ] 3.5 Update the visual effects button to show active state when menu is open
  - [ ] 3.6 Test visual effects button opens the side drawer menu
  - [ ] 3.7 Verify all visual effects controls work properly when menu is open
  - [ ] 3.8 Ensure the visual effects can be closed via the menu's close button or ESC key

## Implementation Notes

### Bug 1: Playlist Button Fix Details
The playlist button currently calls `handleShowPlaylist()` which only sets `showPlaylist(true)` but doesn't properly switch the LibraryNavigation to show Spotify playlists. The fix requires:
- Making `showPlaylist` control the `activeSource` prop of LibraryNavigation
- Ensuring the 'spotify' source is selected when playlist button is clicked
- The button should toggle between local library view and Spotify playlist view

### Bug 2: Library Exit Implementation Details  
Currently, there's no way to exit the library without selecting a song. The solution needs:
- A prominent close/exit button (suggest top-right of LibraryNavigation header)
- State to control library visibility independent of music selection
- Proper handling to not interrupt playback when closing library
- Button should be styled consistently with the rest of the interface

### Bug 3: Visual Effects Menu Fix Details
The visual effects button exists but doesn't work in Electron mode because:
- The VisualEffectsMenu is conditionally rendered based on `visualEffectsEnabled` in Electron mode
- The button calls `onShowVisualEffects` but this doesn't toggle the menu visibility properly
- Need to ensure the menu renders and responds to the button click in Electron mode
- The menu should slide in from the right side as designed

### Testing Strategy
1. **Test in Electron mode only**: `npm run electron:dev`
2. **Test each bug fix independently**: Complete and test one bug before moving to the next
3. **Test edge cases**: 
   - Multiple rapid button clicks
   - Opening/closing menus while music is playing
   - Switching between different library views
4. **Regression testing**: Ensure fixes don't break existing web mode functionality

### Code Style Guidelines
- Follow existing patterns in the codebase
- Use useCallback for event handlers
- Maintain consistent styling with existing buttons and menus
- Add appropriate ARIA labels for accessibility
- Use existing styled-components patterns
