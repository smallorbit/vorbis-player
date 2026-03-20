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
- Prop drilling minimized via context providers and orchestration hooks (`usePlayerLogic`, provider-aware handlers)
- All components should be TypeScript with proper typing

### State Management
- Use context-driven state (`TrackContext`, `CurrentTrackContext`, `ProviderContext`, `ColorContext`, `VisualEffectsContext`)
- Use `usePlayerLogic` as the orchestration layer for playback actions and provider-aware routing
- Use focused hooks for specific behavior (`usePlaylistManager`, `useSpotifyPlayback`, `useAutoAdvance`, `useRadio`, etc.)
- localStorage for persistent settings (visual effects, user preferences)
- Group related state in objects to minimize re-renders

### Provider Routing Model (Important)
- **Active provider** = selected provider context for browsing/catalog actions.
- **Driving provider** = provider currently controlling audio playback.
- In mixed queues, active and driving providers can differ.
- Route playback controls/state by driving provider:
  - `useSpotifyPlayback` resolves provider in order: `track.provider` -> driving provider ref -> active provider fallback.
  - `usePlayerLogic` owns play/pause/next/prev and playback-state sync using driving-provider resolution.
  - `useAutoAdvance` advances from events emitted by the driving provider.

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
- Lazy load heavy components (VisualEffectsMenu, QueueDrawer, QueueBottomSheet)
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
- **QueueDrawer** / **QueueBottomSheet** - Queue (up-next tracks) on desktop/tablet vs mobile
- **QueueTrackList** - Track list inside queue surfaces (lazy-loaded); reorder/remove/edit modes
- **VisualEffectsMenu** - Visual effects controls
- **PlaylistSelection** - Library playlist/album picker with Liked Songs support

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

### Liked Songs (Unified + Provider-Specific)
- Uses special ID `'liked-songs'`
- Unified liked songs can merge liked tracks across connected providers when enabled
- Provider capabilities (`hasLikedCollection`) determine which providers participate
- Preserve provider identity per track for playback/album routing in mixed queues

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

### Updating Cross-Provider Playback Flow
1. Keep active-vs-driving provider behavior explicit (do not assume they are equal)
2. Update provider resolution in `useSpotifyPlayback` and keep fallback order consistent
3. Ensure `usePlayerLogic` routes `play/pause/next/previous` via the driving provider
4. Confirm provider subscription filtering still follows the driving provider
5. Test transitions in mixed queues (Unified Liked Songs, radio, provider switches)

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

### Cross-Provider Playback / UI Desync
- Distinguish active provider (catalog context) from driving provider (actual playback source)
- If visualizer/play state is wrong, verify provider-state events are filtered by driving provider
- If next/previous behaves incorrectly, verify provider resolution order in `useSpotifyPlayback`
- Reproduce with mixed queues (Spotify + Dropbox) to catch routing regressions

### Radio + Provider Switching
- Radio queue generation uses active provider catalog plus optional Spotify resolution for unmatched tracks
- Provider switching during/after radio should follow standard driving-provider routing
- No special provider-switch handoff modal should appear for radio transitions

### Dropbox Collection Issues
- Dropbox album/folder IDs are path-based; do not route Spotify album IDs to Dropbox catalog calls
- For album actions from mixed queues, route using the current track's provider
- If likes/metadata appear stale, check IndexedDB cache state and refresh metadata flow

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
- Update `CLAUDE.md` (root directory) if adding new concepts/patterns
- Update `docs/development/ai-agent-wip.md` with current progress

## Environment Variables

Required in `.env.local`:
```
VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
```
