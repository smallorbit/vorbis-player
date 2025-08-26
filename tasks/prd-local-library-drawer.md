# Product Requirements Document: Local Music Library UI Redesign

## Introduction/Overview

The local music library UI will be redesigned to function as a bottom-sliding drawer/modal that integrates seamlessly with the Vorbis Player's existing design language. This redesign will replace the current fixed sidebar implementation with a more elegant, space-efficient solution that follows the established UI patterns of the playlist drawer and visual effects menu. The new interface will provide an intuitive browsing experience for local music collections while maintaining visual consistency with the Spotify mode.

## Goals

1. **Improve Visual Consistency**: Align the local library UI with the existing Vorbis Player design system using glass morphism effects and consistent styling
2. **Enhance User Experience**: Create a more intuitive, space-efficient interface that doesn't permanently occupy screen space
3. **Optimize Browsing**: Provide a wider, more comfortable browsing area for local music collections
4. **Seamless Mode Integration**: Enable smooth transitions between Spotify and local music modes
5. **Maintain Feature Parity**: Preserve all essential functionality from the current implementation while improving presentation

## User Stories

1. **As a local music user**, I want to access my music library through a familiar playlist-like interface so that I can quickly browse and play my collection
2. **As a user switching between modes**, I want the UI to adapt seamlessly when I change from Spotify to local mode so that the experience feels unified
3. **As a user with a large library**, I want to efficiently search and filter my music by tracks, albums, or artists so that I can find what I want quickly
4. **As a new user**, I want clear onboarding guidance when my library isn't set up so that I know how to get started
5. **As a power user**, I want quick access to library management features so that I can maintain my collection easily

## Functional Requirements

1. **Drawer Behavior**
   - The drawer must slide up from the bottom of the screen with smooth animation
   - The drawer must have an overlay backdrop that closes the drawer when clicked
   - The drawer must be wider than the current 400px playlist drawer for better browsing
   - The drawer must NOT auto-close when a track is selected (unlike playlist drawer)
   - The drawer must support ESC key to close

2. **Trigger Mechanism**
   - The playlist button icon must change to a library/collection-themed icon when in local mode
   - The drawer must auto-open only when: no previous playback history exists OR library is not configured
   - The system must remember the last played track/state between sessions

3. **Content Organization**
   - The drawer must include three view modes: Tracks, Albums, Artists
   - The drawer must display library statistics (total tracks, albums, artists, duration)
   - The drawer must include a search bar that filters the current view
   - The drawer must provide access to library settings

4. **Visual Design Requirements**
   - The drawer must use glass morphism effects consistent with playlist drawer
   - Track items must display album artwork thumbnails (48x48px minimum)
   - The currently playing track must be visually highlighted with accent color
   - Track items must show format badges (FLAC, MP3, WAV, etc.)
   - The drawer must use smooth transitions and animations

5. **Track List Display**
   - Each track must show: thumbnail, title, artist, album, format badge, duration
   - Tracks must be displayed in a scrollable list
   - The list must handle large libraries efficiently (1000+ tracks)

6. **Album View Display**
   - Albums must be displayed in a responsive grid layout
   - Each album must show: artwork, album name, artist name
   - Clicking an album must queue all its tracks for playback

7. **Artist View Display**
   - Artists must be displayed in a list format
   - Each artist must show: name, album count, track count
   - Clicking an artist must queue all their tracks for playback

8. **Search Functionality**
   - Search must work across all fields: track name, artist, album, genre
   - Search must be case-insensitive
   - Search results must update in real-time as user types
   - Search must work within the currently selected view

9. **Empty State**
   - When no library is configured, display a helpful onboarding message
   - Include clear instructions on how to set up the local library
   - Provide a button to access library settings directly

10. **Mode Switching**
    - Hide Spotify playlist selection when in local mode
    - Provide access to mode switching through settings or a toggle
    - Maintain separate states for each mode

## Non-Goals (Out of Scope)

1. **Hybrid Mode**: Unified library combining Spotify and local tracks (future enhancement)
2. **Advanced Sorting**: Complex multi-field sorting options
3. **Playlist Creation**: Creating and managing local playlists
4. **Metadata Editing**: In-line editing of track metadata
5. **Folder View**: Browsing by directory structure
6. **Queue Management**: Reordering or editing the play queue
7. **Duplicate Detection**: Finding and managing duplicate tracks

## Design Considerations

1. **Component Structure**
   - Create new `LocalLibraryDrawer` component following `PlaylistDrawer` pattern
   - Reuse existing styled components where possible
   - Maintain consistent spacing and typography from theme

2. **Animation Patterns**
   - Use cubic-bezier(0.4, 0, 0.2, 1) for slide animations
   - 300ms transition duration for drawer open/close
   - Backdrop fade with opacity transition

3. **Responsive Design**
   - Full width on mobile devices (< 768px)
   - 600-700px width on desktop for optimal browsing
   - Minimum height of 50vh, maximum 80vh
   - Scrollable content area with custom scrollbar styling

4. **Icon Design**
   - New library icon for playlist button in local mode (suggestions: 📚, 🗂️, or custom SVG)
   - Consistent 1.5rem sizing for all control icons
   - Format badges with distinct colors for each audio format

## Technical Considerations

1. **Performance Optimization**
   - Implement React.memo for drawer component with custom comparison
   - Use lazy loading for the drawer component
   - Prefetch album artwork for initially visible items
   - Background lazy loading for remaining artwork
   - Consider virtual scrolling only if performance degrades with large libraries

2. **State Management**
   - Maintain drawer open/close state in AudioPlayer component
   - Share track selection and playback state with existing player logic
   - Persist last played track and mode in localStorage

3. **Data Flow**
   - Reuse existing IPC channels for local library data
   - Maintain compatibility with current database queries
   - Handle track selection through existing callback patterns

4. **Styling Architecture**
   - Extend existing theme system
   - Use styled-components for all new components
   - Ensure proper CSS layering with z-index management

5. **Accessibility**
   - Keyboard navigation support (Tab, Arrow keys, Enter, ESC)
   - ARIA labels for all interactive elements
   - Focus management when drawer opens/closes
   - Screen reader announcements for state changes

## Success Metrics

1. **User Engagement**: 50% increase in local library usage after redesign
2. **Performance**: Drawer opens within 200ms, smooth 60fps animations
3. **Usability**: 80% reduction in time to find and play a specific track
4. **Consistency**: Zero visual inconsistencies reported between modes
5. **Satisfaction**: Positive user feedback on the new interface design

## Open Questions

1. **Artwork Caching Strategy**: Should album artwork be cached to disk or only in memory?
2. **Scroll Position Memory**: Should the drawer remember scroll position between opens?
3. **Keyboard Shortcuts**: Should we add keyboard shortcuts for quick drawer access (e.g., Cmd+L)?
4. **Sort Options**: Should we add basic sorting (alphabetical, date added) in the initial version?
5. **Batch Operations**: Should we support multi-select for batch operations in future versions?

---

*Generated: 2025-08-24*
*Status: Approved for Implementation*