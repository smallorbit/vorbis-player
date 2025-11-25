# AGENTS.md - AI Agent Commands & Conventions

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
tsc -b && vite build

# Lint code
npm run lint

# Preview production build
npm run preview

# Testing
npm run test           # Run tests in watch mode
npm run test:run       # Run tests once
npm run test:ui        # Run tests with UI
npm run test:coverage  # Run tests with coverage

# Deployment
npm run deploy         # Deploy to production
npm run deploy:preview # Deploy preview
```

## Special Commands

- `/commit` - Commit current working changes to the current branch. Split into logically related commits in correct sequential order.
- `/doc` - Update README.md with changes.
- `/comdoc` - Update README.md, then commit changes (/doc + /commit).

## Code Style & Patterns

### React Components
- Use functional components with hooks
- Apply `React.memo()` to heavy components (AlbumArt, VisualEffectsMenu, etc.)
- Prop drilling minimized via `usePlayerState` central state management hook
- All components should be TypeScript with proper typing

### State Management
- Use `usePlayerState` for centralized state (track, playlist, color, visualEffects)
- Use custom hooks for specific features (usePlaylistManager, useSpotifyPlayback, etc.)
- localStorage for persistent settings (visual effects, user preferences)
- Group related state in objects to minimize re-renders

### Styling
- Use `styled-components` with TypeScript
- Follow theme from theme.ts
- Use CSS custom properties for colors extracted from album art
- Apply hardware acceleration for animations (transform, opacity)

### File Organization
```
src/
├── components/       # React components
├── hooks/           # Custom React hooks
├── services/        # API & external integrations (spotify.ts, spotifyPlayer.ts)
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
├── styles/          # Global styles & theme
└── assets/          # Static assets
```

### Performance Considerations
- Lazy load heavy components (VisualEffectsMenu, PlaylistDrawer)
- Cache color extraction with LRU cache in colorExtractor.ts
- Use Web Workers for image processing (imageProcessor.worker.ts)
- Debounce rapid state updates (150ms standard)
- Minimize bundle size with code splitting

## Component Hierarchy

**App.tsx** → **AudioPlayer** → **PlayerStateRenderer** → **PlayerContent**
- **AlbumArt** - Album artwork with visual effects
- **SpotifyPlayerControls** - Three-column control interface
  - TrackInfo (left)
  - ControlsToolbar (center)
  - TimelineControls (bottom)

Related UI:
- **PlaylistDrawer** - Sliding drawer with tracks
- **VisualEffectsMenu** - Visual effects controls
- **PlaylistSelection** - Playlist picker with Liked Songs support

## Spotify Integration

### Required Scopes
- `streaming` - Play audio
- `user-read-email` - Email access
- `user-read-private` - Profile access
- `user-read-playback-state` - Playback state
- `user-library-read` - Liked songs access
- `user-library-modify` - Save/unsave tracks

### Key Functions (spotify.ts)
- `getUserPlaylists()` - Get user's playlists
- `getPlaylistTracks(playlistId)` - Get tracks from playlist
- `getLikedSongs(limit)` - Get user's liked songs
- `checkTrackSaved(trackId)` - Check if saved
- `saveTrack(trackId)` - Save track
- `unsaveTrack(trackId)` - Remove from library

### Liked Songs Playlist
- Uses special ID `'liked-songs'`
- Automatically shuffled on selection
- Limits to 200 tracks for performance

## Common Workflows

### Adding a New Visual Effect
1. Add state to `useVisualEffectsState.ts`
2. Add UI control to `VisualEffectsMenu.tsx`
3. Apply effect in `AlbumArt.tsx` filter styles
4. Add to localStorage persistence
5. Test performance impact

### Adding a New Spotify Playlist Feature
1. Add API function to `spotify.ts` with error handling
2. Add playlist loading to `usePlaylistManager.ts`
3. Add UI selection option to `PlaylistSelection.tsx`
4. Update `useSpotifyPlayback.ts` if needed for playback changes
5. Test with various playlist sizes

### Fixing Performance Issues
1. Check React DevTools Profiler for unnecessary re-renders
2. Review colorExtractor.ts cache hit rates
3. Verify lazy loading is working (DevTools Network tab)
4. Profile with Lighthouse (CWV metrics)
5. Use performanceMonitor.ts to track custom metrics

## Debugging Tips

### Spotify Playback Issues
- Check Web Playback SDK initialization in spotifyPlayer.ts
- Verify token is valid and scopes are authorized
- Check browser console for SDK errors
- Ensure Premium account for streaming

### Visual Effects Not Applying
- Verify albumFilters prop passed to AlbumArt component
- Check filter values in localStorage (key: 'vorbis-player-album-filters')
- Ensure CSS filters syntax is correct in colorUtils.ts
- Profile GPU usage if animations are laggy

### Type Errors
- Filter interfaces should use `boolean` for invert property
- Track type must include all Spotify API properties
- PlaylistItem and TrackItem types must be consistent

## Git Workflow

- Create feature branches from main
- Make logical commits with clear messages
- Use `/commit` command to handle multiple related changes
- Update `docs/development/CLAUDE.md` if adding new concepts/patterns
- Update `docs/development/ai-agent-wip.md` with current progress

## Environment Variables

Required in `.env.local`:
```
VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
```
