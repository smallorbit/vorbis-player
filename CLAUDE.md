# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI assistants when working with code in this repository.

## Project Overview

**Vorbis Player** is a React-based music player with customizable visual effects, background visualizers, and a sleek, unified interface. It supports multiple music providers — currently **Spotify** (streaming, Premium required) and **Dropbox** (personal music files) — with a pluggable provider architecture that allows adding more sources without app-level coupling.

### Key Features
- **Multi-Provider Architecture**: Pluggable `AuthProvider` / `CatalogProvider` / `PlaybackProvider` interfaces; Spotify and Dropbox ship as first-party adapters
- **Spotify Integration**: Full Web Playback SDK integration with playlist, album, and Liked Songs support
- **Dropbox Integration**: OAuth 2.0 PKCE auth; folder-based album discovery; HTML5 Audio streaming via temporary links; ID3 tag metadata enrichment; IndexedDB art + catalog cache
- **Visual Effects System**: Customizable glow effects, album art filters (brightness, contrast, saturation, sepia, hue rotation, blur)
- **Background Visualizers**: 2 active visualizer types (Particles, Geometric), enabled by default
- **Fully Responsive Design**: Fluid sizing with aspect-ratio calculations, container queries, and mobile-optimized layout
- **Playlist Management**: Search, sort, filter, and pin playlists and albums with multiple sort criteria
- **Album Art Flip Menu**: Tap album art to flip and reveal quick-access controls (color chooser, glow toggle, visualizer toggle, visualizer style selector)
- **Bottom Bar**: Fixed bar with volume, shuffle, visual effects menu, back to library, playlist, zen mode
- **Swipe Gestures**: Horizontal swipe on album art for track navigation; vertical swipe on album art for zen mode (up = exit zen, down = enter zen). Drawers are controlled by menu buttons only.
- **Interactive Track Info**: Clickable artist/album names with popovers linking to Spotify and library filtering
- **IndexedDB Caching**: Persistent library cache with background sync engine for instant startup
- **Keyboard Shortcuts**: Context-aware keyboard control system (13 shortcuts with device-specific behavior)
- **Performance Optimized**: Web Workers, LRU caching, IndexedDB persistence, lazy loading, hardware-accelerated animations

## Build Verification

Always verify the build compiles cleanly (`npm run build` or equivalent) after removing dependencies, refactoring imports, or making multi-file changes. Check for dangling references in config files like `vite.config.ts`, `tsconfig.json`, etc.

This is a TypeScript project. After any refactor or feature implementation, ensure there are no TypeScript compilation errors before committing. Run `npx tsc --noEmit` as a verification step.

## UI & CSS Guidelines

When modifying CSS layout or styling, avoid making additional 'clever' adjustments beyond what was requested. If the user asks to constrain width or center an element, do exactly that — don't add spacers, override calculated dimensions, or restructure containers unless explicitly asked. If multiple approaches may be needed, describe them first before implementing.

When asked to implement a UI change, make the minimal change first, confirm it works visually, then iterate. Do not combine multiple layout changes (e.g., centering + animation + spacing) into a single large edit.

## Git & PR Workflow

When creating PRs, always run the full test suite first. The project uses Vitest for unit tests. Run `npm test` before `git push` and before creating any PR.

## Worktree Setup

When creating or working in a git worktree, perform these setup steps immediately to ensure the environment is ready for development and testing:

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables from main repo
cp ../.env .env.local
```

These setup steps are required because:
- **npm install**: Worktrees don't inherit `node_modules` from the main repository; each worktree needs its own dependency installation
- **Environment file**: The `.env.local` file contains Spotify API credentials needed for authentication, local development, and tests. Copy it from the main repo directory (use `../` to reference the main repo from the worktree)

After completing these steps, you can proceed with development commands and running tests. Verify the setup by running `npm run test:run` to confirm the test suite passes.

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

## Architecture

### Directory Structure

```
vorbis-player/
├── src/
│   ├── components/              # React components (~42 files)
│   │   ├── controls/            # Player control sub-components
│   │   │   ├── EffectsControls.tsx
│   │   │   ├── PlaybackControls.tsx
│   │   │   ├── TimelineControls.tsx
│   │   │   ├── TrackInfo.tsx
│   │   │   ├── TrackInfoPopover.tsx  # Artist/album context menu popover
│   │   │   ├── VolumeControl.tsx
│   │   │   └── styled.ts
│   │   ├── styled/              # styled-components UI library
│   │   │   ├── Alert.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Drawer.tsx       # Shared drawer primitives (overlay, grip, transitions)
│   │   │   ├── ScrollArea.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── index.ts
│   │   ├── visualizers/         # Background visualizer components
│   │   │   ├── ParticleVisualizer.tsx
│   │   │   └── GeometricVisualizer.tsx
│   │   ├── AlbumArtBackside.tsx # Flip menu back face (color, glow, visualizer controls)
│   │   ├── BottomBar/          # Bottom bar (volume, shuffle, visual effects, library, playlist)
│   │   │   ├── index.tsx
│   │   │   └── styled.ts
│   │   ├── VisualEffectsMenu/
│   │   │   ├── index.tsx
│   │   │   └── styled.ts
│   │   ├── icons/
│   │   │   └── QuickActionIcons.tsx  # SVG icon components for bottom bar and shared UI
│   │   ├── __tests__/
│   │   │   └── KeyboardShortcutsIntegration.test.tsx
│   │   ├── AccentColorBackground.tsx
│   │   ├── AccentColorGlowOverlay.tsx
│   │   ├── AlbumArt.tsx
│   │   ├── AlbumArtFilters.tsx
│   │   ├── AudioPlayer.tsx
│   │   ├── BackgroundVisualizer.tsx
│   │   ├── ColorPickerPopover.tsx
│   │   ├── EyedropperOverlay.tsx
│   │   ├── KeyboardShortcutsHelp.tsx
│   │   ├── LibraryDrawer.tsx    # Full-screen library browser (top drawer)
│   │   ├── LikeButton.tsx
│   │   ├── PerformanceProfiler.tsx
│   │   ├── PlayerContent.tsx
│   │   ├── PlayerStateRenderer.tsx
│   │   ├── Playlist.tsx
│   │   ├── PlaylistBottomSheet.tsx  # Mobile playlist view (bottom sheet)
│   │   ├── PlaylistDrawer.tsx
│   │   ├── PlaylistSelection.tsx
│   │   ├── SpotifyPlayerControls.tsx
│   │   ├── TimelineSlider.tsx
│   │   └── VisualEffectsPerformanceMonitor.tsx
│   ├── constants/               # Shared constants
│   │   └── playlist.ts         # ALBUM_ID_PREFIX, LIKED_SONGS_ID, helpers
│   ├── providers/               # Multi-provider system
│   │   ├── registry.ts          # ProviderRegistryImpl singleton — providers register on import
│   │   ├── __tests__/
│   │   │   ├── registry.test.ts
│   │   │   └── dropboxAdapters.test.ts
│   │   ├── spotify/             # Spotify provider adapters
│   │   │   ├── spotifyAuthAdapter.ts
│   │   │   ├── spotifyCatalogAdapter.ts
│   │   │   ├── spotifyPlaybackAdapter.ts
│   │   │   ├── spotifyProvider.ts   # Builds & registers ProviderDescriptor for Spotify
│   │   │   └── index.ts
│   │   └── dropbox/             # Dropbox provider adapters
│   │       ├── dropboxAuthAdapter.ts    # OAuth 2.0 PKCE flow, token storage/refresh
│   │       ├── dropboxCatalogAdapter.ts # Folder scan → MediaCollection/MediaTrack; art fetching
│   │       ├── dropboxPlaybackAdapter.ts # HTML5 Audio streaming; ID3 enrichment; link refresh
│   │       ├── dropboxProvider.ts       # Builds & registers ProviderDescriptor for Dropbox
│   │       ├── dropboxArtCache.ts       # IndexedDB cache for album art data URLs (7-day TTL)
│   │       ├── dropboxCatalogCache.ts   # IndexedDB cache for collection list (1-hour TTL)
│   │       ├── __tests__/
│   │       │   └── dropboxCatalogCache.test.ts
│   │       └── index.ts
│   ├── hooks/                   # Custom React hooks (22 hooks)
│   │   ├── __tests__/
│   │   │   ├── useCustomAccentColors.test.ts
│   │   │   ├── useKeyboardShortcuts.test.ts
│   │   │   ├── useLibrarySync.test.ts
│   │   │   ├── useLocalStorage.test.ts
│   │   │   ├── usePinnedItems.test.ts
│   │   │   ├── usePlayerState.test.ts
│   │   │   └── useSwipeGesture.test.ts
│   │   ├── useAccentColor.ts
│   │   ├── useAnimationFrame.ts
│   │   ├── useAutoAdvance.ts
│   │   ├── useCanvasVisualizer.ts
│   │   ├── useCustomAccentColors.ts
│   │   ├── useImageProcessingWorker.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useLibrarySync.ts    # Background library sync with IndexedDB cache
│   │   ├── useLikeTrack.ts      # Like/unlike track with optimistic UI
│   │   ├── useLocalStorage.ts
│   │   ├── usePlaylistManager.ts
│   │   ├── usePinnedItems.ts    # Pin/unpin playlists and albums (max 4 per tab)
│   │   ├── usePlayerLogic.ts
│   │   ├── usePlayerSizing.ts
│   │   ├── usePlayerState.ts
│   │   ├── useProfilerData.ts
│   │   ├── useSpotifyControls.ts
│   │   ├── useSpotifyPlayback.ts
│   │   ├── useSwipeGesture.ts           # Horizontal swipe for track navigation
│   │   ├── useVerticalSwipeGesture.ts   # Vertical swipe for zen mode on album art
│   │   ├── useVisualEffectsState.ts
│   │   └── useVolume.ts
│   ├── services/                # External service integrations
│   │   ├── spotify.ts           # Spotify Web API
│   │   ├── spotifyPlayer.ts     # Spotify Web Playback SDK
│   │   └── cache/               # IndexedDB-based library caching
│   │       ├── __tests__/
│   │       │   ├── libraryCache.test.ts
│   │       │   └── librarySyncEngine.test.ts
│   │       ├── cacheTypes.ts    # Cache type definitions
│   │       ├── libraryCache.ts  # IndexedDB persistence layer
│   │       └── librarySyncEngine.ts  # Background sync engine
│   ├── utils/                   # Utility functions
│   │   ├── __tests__/
│   │   │   ├── colorUtils.test.ts
│   │   │   ├── playlistFilters.test.ts
│   │   │   └── sizingUtils.test.ts
│   │   ├── colorExtractor.ts
│   │   ├── colorUtils.ts
│   │   ├── featureDetection.ts
│   │   ├── performanceMonitor.ts
│   │   ├── playlistFilters.ts
│   │   ├── sizingUtils.ts
│   │   ├── visualEffectsPerformance.ts
│   │   └── visualizerUtils.ts
│   ├── workers/                 # Web Workers
│   │   └── imageProcessor.worker.ts
│   ├── types/                   # TypeScript definitions
│   │   ├── domain.ts            # ProviderId, MediaTrack, MediaCollection, CollectionRef, PlaybackState
│   │   ├── providers.ts         # AuthProvider, CatalogProvider, PlaybackProvider, ProviderDescriptor, ProviderRegistry
│   │   ├── filters.ts
│   │   ├── spotify.d.ts
│   │   ├── styled.d.ts
│   │   └── visualizer.d.ts
│   ├── styles/                  # Global styles & theme
│   │   ├── modules/
│   │   │   ├── Button.module.css
│   │   │   └── Card.module.css
│   │   ├── ThemeProvider.tsx
│   │   ├── theme.ts
│   │   ├── utils.ts
│   │   ├── breakpoints.css
│   │   ├── container-queries.css
│   │   ├── glow-animations.css
│   │   └── progressive-enhancement.css
│   ├── lib/                     # Helper functions
│   │   └── utils.ts
│   ├── assets/                  # Static assets
│   └── test/                    # Test setup
│       └── setup.ts
├── docs/
│   ├── development/
│   │   ├── ai-agent-wip.md
│   │   └── dynamic-contrast-implementation.md
│   ├── deployment/
│   │   └── deploy-to-vercel.md
│   ├── analysis/
│   │   └── ANALYSIS.md
│   └── implementation-plans/
│       ├── expandable-fab-menu.md
│       ├── library-sort-search-filter.md
│       ├── mobile-bottom-menu.md
│       ├── mobile-library-drawer.md
│       └── swipe-album-navigation.md
├── CLAUDE.md                    # This file
├── .claude/
│   └── rules/
│       ├── generate_prd.md
│       ├── generate_tasks_from_prd.md
│       └── process_tasks.md
├── scripts/                     # Build and deployment scripts
└── [config files]
```

### Component Hierarchy

```
App.tsx (OAuth authentication, AppContainer with flex centering)
└── AudioPlayer (Container with min-height: 100dvh + flex centering)
    ├── AccentColorBackground (position: fixed, z-index: 0)
    ├── BackgroundVisualizer (position: fixed, z-index: 1)
    │   ├── ParticleVisualizer (active)
    │   └── GeometricVisualizer (active)
    └── PlayerStateRenderer (loading/error/playlist selection)
        ├── PlaylistSelection (search, sort, filter, pin, lazy-loaded images)
        └── PlayerContent (main playing interface)
            └── ContentWrapper (position: relative, overflow: visible, container queries)
                ├── PlayerContainer (flex column, always centered)
                │   ├── CardContent (album art zone, swipe gestures)
                │   │   └── ClickableAlbumArtContainer (3D flip on tap)
                │   │       └── FlipInner
                │   │           ├── AlbumArt (front face, aspect-ratio: 1, max-width: 700px)
                │   │           │   ├── AlbumArtFilters (CSS filter application)
                │   │           │   └── AccentColorGlowOverlay
                │   │           └── AlbumArtBackside (back face: color, glow, visualizer controls)
                │   └── SpotifyPlayerControls (always visible)
                │       ├── TrackInfo (clickable artist/album with popovers)
                │       ├── PlaybackControls (prev/play/next)
                │       └── TimelineControls
                │           ├── TimelineSlider
                │           ├── VolumeControl
                │           └── LikeButton
                ├── BottomBar (portal to document.body, fixed at bottom)
                │   ├── VolumeControl
                │   ├── Shuffle Toggle
                │   ├── Visual Effects Menu (gear icon)
                │   ├── Back to Library
                │   ├── Show Playlist Toggle
                │   └── Zen Mode Toggle (desktop/tablet)
                ├── VisualEffectsMenu (lazy loaded)
                ├── LibraryDrawer (top drawer, lazy loaded)
                │   └── PlaylistSelection (search, sort, filter, pin)
                ├── PlaylistBottomSheet (mobile only, bottom sheet, lazy loaded)
                │   └── Playlist (current tracks)
                ├── PlaylistDrawer (desktop/tablet, lazy loaded)
                └── KeyboardShortcutsHelp (lazy loaded)
```

### Layout Architecture (Critical)

The centering system uses a flex chain from root to player content:

```
AppContainer (flexCenter, min-height: 100dvh)
  → Container/AudioPlayer (flexCenter, min-height: 100dvh)
    → ContentWrapper (position: relative, z-index: 2, overflow: visible)
      → PlayerContainer (flex column, centered)
```

**Important layout callouts:**
- **`ContentWrapper` must use `position: relative`** (not absolute) so parent flex containers can center it
- **`overflow: visible` is required on ContentWrapper** because `container-type: inline-size` establishes containment that would clip absolutely-positioned elements
- **Vertical centering** relies on the flex chain from root to ContentWrapper — the player (album art + controls) is always centered as a unit
- **`100dvh`** (dynamic viewport height) is used throughout to account for iOS/mobile browser address bar changes
- **BottomBar** uses `createPortal()` to render to `document.body`, positioned fixed at bottom
- **Drawers** (LibraryDrawer, PlaylistDrawer, PlaylistBottomSheet) use fixed positioning with smooth slide animations and swipe-to-dismiss
- **BackgroundVisualizer and AccentColorBackground** are `position: fixed` with low z-index values and do not affect layout flow

**UI Control Layout**:
- **Album Art Flip Menu**: Tap album art to trigger 3D flip (rotateY 180deg); back face shows AlbumArtBackside with color swatches, glow toggle, visualizer toggle, visualizer style selector. In zen mode, tap does play/pause instead.
- **Bottom Bar**: Fixed bar with volume, shuffle, visual effects (gear), back to library, playlist, zen mode. Renders via portal to document.body.
- **Controls always visible**: Player controls (track info, playback, timeline) are always shown — no compact/expanded toggle

### Responsive Sizing System

The app uses a fluid responsive sizing system via `usePlayerSizing` hook and `sizingUtils.ts`:

**Breakpoints** (from `theme.ts`):
- xs: 320px (very small phones)
- sm: 375px (standard phones)
- md: 480px (large phones)
- lg: 700px (tablets / desktop threshold)
- xl: 1280px (desktop)
- 2xl: 1536px (large desktop)
- 3xl: 1920px (ultra-wide)

**Device Detection** (`usePlayerSizing.ts`):
- Mobile: viewport width < 700px
- Tablet: viewport width 700px - 1024px
- Desktop: viewport width >= 1024px

**Viewport Usage**:
- Mobile: 98% width / 95% height (maximizes album art for immersive experience)
- Desktop/Tablet: 90% width / 90% height

**Padding** (`calculateOptimalPadding` in `sizingUtils.ts`):
- < 320px: 2px
- < 375px: 4px
- < 480px: 6px
- < 700px: 10px
- >= 700px: 16px (1rem)

**Aspect Ratio** (calculated dynamically based on viewport ratio):
- Very tall (< 0.75): 0.6
- Portrait (< 1.0): 0.8
- Square/landscape tablet (< 1.5): 0.86
- Landscape (< 2.0): 0.9
- Ultra-wide (>= 2.0): 1.2

### Hook-Based State Management

The application uses a centralized state management approach with custom React hooks (22 total):

**Core State Hooks**:
- **usePlayerState.ts** - Central state management with grouped state objects (track, playlist, color, visualEffects)
- **usePlayerLogic.ts** - High-level player orchestration and business logic
- **usePlayerSizing.ts** - Responsive sizing calculations for mobile/tablet/desktop breakpoints

**Spotify Integration Hooks**:
- **usePlaylistManager.ts** - Playlist loading & Liked Songs management with shuffle functionality
- **useSpotifyPlayback.ts** - Spotify Web Playback SDK control and track management
- **useSpotifyControls.ts** - Volume, timeline, and playback controls

**Playback & Audio Hooks**:
- **useAutoAdvance.ts** - Auto-advance logic for seamless track progression
- **useVolume.ts** - Volume state management with localStorage persistence
- **useLikeTrack.ts** - Like/unlike track with optimistic UI updates

**Visual Effects Hooks**:
- **useAccentColor.ts** - Dynamic color extraction from album artwork using LRU cache
- **useCustomAccentColors.ts** - Per-album color overrides with localStorage persistence
- **useVisualEffectsState.ts** - Glow and filter state management

**Performance & Processing Hooks**:
- **useImageProcessingWorker.ts** - Web Worker integration for image processing
- **useProfilerData.ts** - Performance profiling and metrics collection
- **useCanvasVisualizer.ts** - Canvas-based visualizer management
- **useAnimationFrame.ts** - RequestAnimationFrame wrapper for smooth animations

**UI & Interaction Hooks**:
- **useKeyboardShortcuts.ts** - Context-aware keyboard shortcut handling with pointer input detection
- **useLocalStorage.ts** - Generic localStorage hook with error handling and type safety
- **useSwipeGesture.ts** - Horizontal swipe gesture detection for track navigation (mobile/tablet)
- **useVerticalSwipeGesture.ts** - Vertical swipe gesture detection for zen mode on album art (up = exit zen, down = enter zen)

**Library & Data Hooks**:
- **useLibrarySync.ts** - Background library sync with IndexedDB cache, exposes playlists/albums/sync state
- **usePinnedItems.ts** - Pin/unpin playlists and albums (max 4 per tab), persisted in localStorage

### Multi-Provider Architecture

The app uses a pluggable provider system defined in `src/types/providers.ts` and `src/types/domain.ts`. Each music source implements three adapter interfaces and is registered with the singleton `ProviderRegistry`.

**Domain types** (`src/types/domain.ts`):
- `ProviderId` — `'spotify' | 'dropbox'` (union extended per new provider)
- `MediaTrack` — provider-agnostic track (id, name, artists, album, albumId, durationMs, image, playbackRef)
- `MediaCollection` — provider-agnostic collection (id, provider, kind, name, trackCount, imageUrl, ownerName)
- `CollectionRef` — stable key for a collection `{ provider, kind, id }`; serialised via `collectionRefToKey` / `keyToCollectionRef`
- `PlaybackState` — current position, duration, isPlaying, currentTrackId, trackMetadata (for live ID3 updates)

**Provider contracts** (`src/types/providers.ts`):
- `AuthProvider` — `isAuthenticated()`, `getAccessToken()`, `ensureValidToken()`, `beginLogin()`, `handleCallback(url)`, `logout()`
- `CatalogProvider` — `listCollections(signal?)`, `listTracks(collectionRef, signal?)`
- `PlaybackProvider` — `initialize()`, `playTrack(track)`, `pause()`, `resume()`, `seek(ms)`, `setVolume(0-1)`, `getState()`, `subscribe(listener)`, `destroy()`
- `ProviderDescriptor` — `{ id, name, capabilities, auth, catalog, playback }`. Capabilities: `hasLikedCollection`, `hasSaveTrack`, `hasExternalLink`
- `ProviderRegistry` — `register(descriptor)`, `get(id)`, `getAll()`, `has(id)`

**Provider registration** (`src/providers/registry.ts`):
- Singleton `providerRegistry` instance
- Providers register themselves at module load time (imported from `src/providers/spotify/index.ts` and `src/providers/dropbox/index.ts`)
- Dropbox is only registered if `VITE_DROPBOX_CLIENT_ID` is set in the environment

**Dropbox Provider** (`src/providers/dropbox/`):

| File | Responsibility |
|------|---------------|
| `dropboxAuthAdapter.ts` | OAuth 2.0 PKCE: generates code verifier/challenge, redirects to Dropbox, exchanges code for token, stores tokens in `localStorage` (`vorbis-player-dropbox-token`, `vorbis-player-dropbox-refresh-token`), refreshes on 401 |
| `dropboxCatalogAdapter.ts` | Recursively lists Dropbox app root via `files/list_folder`; maps folders containing audio files to `MediaCollection` (kind `album`); fetches and caches cover art as base64 data URLs; parses track number and name from filenames |
| `dropboxPlaybackAdapter.ts` | Resolves `playbackRef.ref` (Dropbox path) to a temporary link via `files/get_temporary_link`; plays via HTML5 `Audio`; enriches metadata in background by fetching first 256 KB and parsing ID3 tags (`src/utils/id3Parser.ts`); polls every 250 ms for timeline updates |
| `dropboxArtCache.ts` | IndexedDB (`vorbis-dropbox-art`, store `art`) for album art data URLs with 7-day TTL |
| `dropboxCatalogCache.ts` | IndexedDB (same DB, store `catalog`) for collection list with 1-hour TTL |
| `dropboxProvider.ts` | Assembles adapters into `ProviderDescriptor`; capabilities: `hasLikedCollection: false`, `hasSaveTrack: false`, `hasExternalLink: false`; registers with `providerRegistry` |

**Expected Dropbox folder structure**:
```
Dropbox root/
└── <Artist>/
    └── <Album>/
        ├── cover.jpg       # album art (also: album.jpg, folder.jpg, front.jpg)
        ├── 01 - Track.mp3
        └── 02 - Track.mp3
```
Folders that directly contain audio files are treated as albums; their parent folder name becomes the artist. A synthetic "All Music" collection (kind `folder`, id `''`) is always prepended.

**Capability-aware UI**: components check `activeDescriptor.capabilities` before rendering provider-specific controls. `hasSaveTrack: false` hides the Like button; `hasExternalLink: false` hides "Open in Spotify"-style links.

### Service Layer

**Spotify Services**:
- **spotify.ts** - Spotify Web API integration:
  - `getUserPlaylists()`: Gets user's playlists
  - `getPlaylistTracks(playlistId)`: Gets tracks from specific playlist
  - `getLikedSongs(limit)`: Gets user's liked songs with pagination
  - `getLikedSongsCount()`: Lightweight count-only request
  - `checkTrackSaved(trackId)`: Checks if track is saved in user's library
  - `saveTrack(trackId)`: Saves track to user's library
  - `unsaveTrack(trackId)`: Removes track from user's library
  - `getCachedData()`: Returns cached playlist/album data for progressive loading
- **spotifyPlayer.ts** - Spotify Web Playback SDK wrapper with state management

**Cache Services** (`services/cache/`):
- **libraryCache.ts** - IndexedDB-based persistent cache for playlists, albums, and track lists. Falls back to in-memory Maps if IndexedDB is unavailable. Supports incremental updates.
- **librarySyncEngine.ts** - Background sync engine that polls Spotify API every ~90 seconds. Uses lightweight change detection (count comparison, snapshot IDs) before fetching full data. Two-tier track caching: in-memory L1 (10 min TTL) + IndexedDB L2 (24 hour TTL).
- **cacheTypes.ts** - TypeScript interfaces: `CachedPlaylistInfo`, `CachedTrackList`, `LibraryCacheMeta`, `LibraryChanges`, `SyncState`

### Utilities

- **colorExtractor.ts** - LRU-cached color extraction from album artwork (100 item cache limit)
- **colorUtils.ts** - Color manipulation utilities (contrast calculation, hex conversion)
- **sizingUtils.ts** - Responsive sizing calculations (viewport info, player dimensions, padding, fluid sizing)
- **playlistFilters.ts** - Playlist/album search, sort, filter, and pin partitioning logic (`partitionByPinned`)
- **visualizerUtils.ts** - Visualizer helper functions
- **performanceMonitor.ts** - Performance tracking utilities
- **visualEffectsPerformance.ts** - Visual effects performance utilities
- **featureDetection.ts** - Browser feature detection (WebGL, backdrop-filter, etc.)

### Constants

- **constants/playlist.ts** - Shared playlist constants: `ALBUM_ID_PREFIX`, `LIKED_SONGS_ID`, `LIKED_SONGS_NAME`, and helper functions (`isAlbumId`, `extractAlbumId`, `toAlbumPlaylistId`)

## Key Implementation Details

### Authentication Flow

- **PKCE OAuth Flow**: Secure authentication with Spotify
- **Required Scopes**: streaming, user-read-email, user-read-private, user-read-playback-state, user-library-read, user-library-modify
- **Callback URL**: `http://127.0.0.1:3000/auth/spotify/callback`
- **Token Management**: Automatic token refresh for long-term sessions

### Playback System

- **Auto-Play & Continuous Playback**: Automatically starts first song and seamlessly advances through tracks
- **Infinite Playlist**: Loops back to beginning when reaching the end
- **Auto-Skip**: Automatically skips unavailable tracks with 403 Restriction Violated errors
- **Track Selection Sync**: Handles playlist item clicks vs. next/prev controls
- **Swipe Navigation**: Horizontal swipe on album art to navigate tracks (mobile/tablet), with direction locking, velocity detection, and snap-back animation
- **Album Art Tap**: Tap album art to flip and show quick-access controls (color, glow, visualizer). In zen mode, tap does play/pause instead. Flip resets on track change.
- **State Management**: Uses `isInitialLoad` flag and proper useEffect dependency ordering

### Visual Effects System

**Glow Effects**:
- Controlled via `useVisualEffectsState` hook
- GPU-accelerated CSS animations for smooth 60fps
- Configurable intensity (Less/Normal/More) and rate (Slower/Normal/Faster)
- Optional accent color background overlay
- Per-album settings stored in localStorage

**Album Art Filters**:
- Real-time CSS filters: brightness, contrast, saturation, hue rotation, blur, sepia
- Individual sliders with real-time preview
- Persistent settings in localStorage (key: 'vorbis-player-album-filters')
- Dynamic theming: slider thumbs use extracted dominant color
- One-click reset to defaults

**Color System**:
- **ColorPickerPopover**: Custom accent colors per album with visual color picker
- **EyedropperOverlay**: Interactive color picking directly from album art
- **Dynamic Extraction**: Automatic dominant color extraction with LRU caching
- **Color Persistence**: Per-album color overrides saved in localStorage (changed from per-track)

### Background Visualizers

**Available Visualizers**:
- **ParticleVisualizer**: Animated particle system with physics, responds to accent colors
- **GeometricVisualizer**: Rotating geometric shapes synchronized with accent colors

**Configuration**: Toggle on/off, intensity slider (0-100%), style selection. Uses requestAnimationFrame and Canvas API.

### Keyboard Shortcuts

| Key | Action (Desktop) | Action (Touch-only) |
|-----|-------------------|---------------------|
| `Space` | Play/Pause | Play/Pause |
| `ArrowRight` | Next track | Next track |
| `ArrowLeft` | Previous track | Previous track |
| `ArrowUp` / `P` | Toggle playlist drawer | Volume up (ArrowUp only) |
| `ArrowDown` / `L` | Toggle library drawer | Volume down (ArrowDown only) |
| `V` | Toggle background visualizer | Toggle background visualizer |
| `G` | Toggle glow effect | Toggle glow effect |
| `S` | Toggle shuffle | Toggle shuffle |
| `T` | Toggle translucence | Toggle translucence |
| `O` | Open visual effects menu | Open visual effects menu |
| `K` | Like/unlike current track | Like/unlike current track |
| `M` | Mute/unmute | Mute/unmute |
| `/` or `?` | Show keyboard shortcuts help | Show keyboard shortcuts help |
| `Escape` | Close all menus | Close all menus |

Centralized in `useKeyboardShortcuts.ts`. Uses pointer input detection (`pointer: fine` / `hover: hover` media queries) instead of viewport width to determine device type. `P` and `L` are always-available alternatives for playlist/library toggles (not device-dependent like ArrowUp/ArrowDown). ArrowUp/ArrowDown have cross-dismiss behavior: opening one drawer closes the other. Prevents conflicts with text inputs and Ctrl/Cmd shortcuts.

### Playlist Management

- **Search**: Real-time search across playlist/album names with debouncing
- **Sort (Playlists)**: Recently added, Name (A-Z), Name (Z-A)
- **Sort (Albums)**: Recently added, Name, Artist, Release date (newest/oldest)
- **Filter (Albums)**: Filter by decade (1980s through present), filter by artist (click artist name in album grid)
- **View Modes**: Toggle between Playlists and Albums tabs
- **Pinning**: Pin up to 4 playlists and 4 albums to the top of their respective tabs, persisted in localStorage
- **Liked Songs**: Special playlist with automatic shuffle, heart icon indicator
- **IndexedDB Caching**: Persistent library cache with background sync engine (replaces localStorage TTL cache). Warm start from IndexedDB, background polling every ~90 seconds.
- **Lazy Images**: Intersection Observer-based image loading (50px margin)
- **Library Drawer**: Full-screen top drawer for browsing playlists/albums with swipe-to-dismiss, 2-column album art grid on mobile, max-width constrained on desktop
- **Interactive Track Info**: Clickable artist names show popover with "Browse albums in library" and "View on Spotify" options. Clickable album names show "Play album" and "View on Spotify" options.

## Tech Stack

**Core**:
- React 18.3.1, TypeScript 5.8.3, Vite 6.3.5
- styled-components 6.1.12, Radix UI (@radix-ui/react-scroll-area)
- react-window 1.8.11 (virtual scrolling)

**Audio**: Spotify Web Playback SDK + Web API with PKCE OAuth 2.0

**Testing**: Vitest 3.2.4, @testing-library/react 16.3.0, jsdom 26.1.0, @vitest/coverage-v8

**Linting**: ESLint 9.25.0, typescript-eslint 8.30.1

**Build**: ES2020 target, esbuild minification, manual chunks (vendor, radix, styled), CSS code splitting

## Build & Configuration

### Vite Configuration (`vite.config.ts`)

- Host: `127.0.0.1`, Port: `3000` (required for Spotify OAuth)
- Manual chunks: vendor (react, react-dom), radix, styled
- CSS code splitting enabled
- Asset inline limit: 4KB
- Chunk size warning limit: 1000KB

### TypeScript Configuration

**Path Aliases** (`tsconfig.json`):
```json
{ "baseUrl": ".", "paths": { "@/*": ["./src/*"] } }
```
Use `@/` prefix for clean imports: `import { usePlayerState } from '@/hooks/usePlayerState'`

## Testing

### Active Test Suites (16 files)

**Provider Tests**:
- `src/providers/__tests__/registry.test.ts` - ProviderRegistry get/getAll/has logic
- `src/providers/__tests__/dropboxAdapters.test.ts` - Dropbox auth, catalog, and playback adapter behaviour
- `src/providers/dropbox/__tests__/dropboxCatalogCache.test.ts` - IndexedDB catalog cache TTL and CRUD

**Hook Tests**:
- `src/hooks/__tests__/useKeyboardShortcuts.test.ts` - Keyboard shortcut handling and event delegation
- `src/hooks/__tests__/useLocalStorage.test.ts` - localStorage hook functionality and error handling
- `src/hooks/__tests__/useCustomAccentColors.test.ts` - Custom accent color management
- `src/hooks/__tests__/usePlayerState.test.ts` - Central state management and color persistence
- `src/hooks/__tests__/useLibrarySync.test.ts` - Background library sync with IndexedDB cache
- `src/hooks/__tests__/usePinnedItems.test.ts` - Pin/unpin playlists and albums
- `src/hooks/__tests__/useSwipeGesture.test.ts` - Swipe gesture detection

**Service Tests**:
- `src/services/cache/__tests__/libraryCache.test.ts` - IndexedDB cache layer operations
- `src/services/cache/__tests__/librarySyncEngine.test.ts` - Background sync engine logic

**Utility Tests**:
- `src/utils/__tests__/sizingUtils.test.ts` - Responsive sizing calculations across breakpoints
- `src/utils/__tests__/colorUtils.test.ts` - Color manipulation utilities
- `src/utils/__tests__/playlistFilters.test.ts` - Playlist search/sort/filter logic

**Component Tests**:
- `src/components/__tests__/KeyboardShortcutsIntegration.test.tsx` - Keyboard integration with UI

### Testing Guidelines
- Tests should verify actual behavior, not mock implementations
- Every test should have meaningful assertions
- Remove tests that don't provide value

## Common Issues & Solutions

### Layout & Centering
- **Player not centered**: ContentWrapper must use `position: relative` (not absolute) so parent flex containers can center it.
- **Elements clipped**: Ensure `overflow: visible` is set on ContentWrapper. The `container-type: inline-size` creates containment that can clip absolutely-positioned children.
- **Mobile viewport bouncing**: Use `100dvh` instead of `100vh` to account for iOS address bar changes.
- **Bottom bar z-index**: BottomBar renders via portal to `document.body` — ensure z-index doesn't conflict with drawer overlays.

### Spotify Integration
- **Liked Songs not loading**: Verify user-library-read scope and that user has liked songs
- **Authentication issues**: Use `127.0.0.1` not `localhost` for OAuth callback
- **Track skipping**: Auto-skip handles 403 Restriction Violated errors for unavailable tracks

### Dropbox Integration
- **Dropbox option not visible**: `VITE_DROPBOX_CLIENT_ID` must be set in `.env.local`; the provider is only registered when this var is present. Restart the dev server after adding it.
- **Auth callback fails**: Ensure `http://127.0.0.1:3000/auth/dropbox/callback` (or the production equivalent) is listed in the Dropbox app's **Redirect URIs** in the developer console.
- **No collections / no tracks**: Confirm the Dropbox account contains audio files (`.mp3`, `.flac`, `.ogg`, `.m4a`, `.wav`, `.aac`, `.opus`) in folders. Files at the root level without a parent folder are skipped by the album-detection logic.
- **Art not loading**: Place `cover.jpg` (or `folder.jpg`, `album.jpg`, `front.jpg`) in the same directory as audio files. Art is cached in IndexedDB (`vorbis-dropbox-art`) with a 7-day TTL; clearing site data forces a re-fetch.
- **Stale catalog**: The collection list is cached in IndexedDB for 1 hour. To force a refresh, call `clearCatalogCache()` from `src/providers/dropbox/dropboxCatalogCache.ts` or clear site data.
- **Token expired**: `DropboxAuthAdapter.refreshAccessToken()` is called automatically on 401. If refresh fails (e.g. refresh token revoked), the user is logged out and must reconnect from App Settings.

### Visual Effects
- **Album art filters not working**: Always pass `albumFilters={albumFilters}` to AlbumArt component

### Performance
- **Color extraction**: Ensure LRU cache in colorExtractor.ts is functioning (100 item limit)
- **Re-renders**: Verify React.memo with custom comparison functions on heavy components
- **Bundle size**: Check lazy loading and code splitting configuration
- **IndexedDB cache**: If library data is stale, check `useLibrarySync` hook and `librarySyncEngine` for sync errors. Cache falls back to in-memory if IndexedDB is unavailable.

## Environment Configuration

Required in `.env.local`:
```
VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
```

Optional — add to enable Dropbox:
```
VITE_DROPBOX_CLIENT_ID="your_dropbox_app_key"
```

When `VITE_DROPBOX_CLIENT_ID` is absent the Dropbox provider module is not registered and the setting to connect Dropbox does not appear in the UI. The redirect URI for Dropbox is derived at runtime from `window.location.origin` (e.g. `http://127.0.0.1:3000/auth/dropbox/callback`) — this must be added to the Dropbox app's allowed redirect URIs in the [Dropbox Developer Console](https://www.dropbox.com/developers/apps).

## Coding Conventions

### React Patterns
- Functional components with hooks, React.memo for optimization
- One component per file, named exports
- Co-locate sub-components in dedicated directories
- Keep component files under 500 lines

### State Management
- Grouped state objects to reduce re-renders
- `useLocalStorage` hook for persistence with 'vorbis-player-' key prefix
- Props vs hook state hierarchy for keyboard shortcut synchronization

### Styling
- styled-components with theme system (`theme.ts`)
- Hardware-accelerated animations (`transform: translateZ(0)`, `will-change`)
- CSS custom properties for dynamic colors
- Container queries as primary responsive strategy, media queries as fallback

### TypeScript
- Strict mode enabled
- Types in `src/types/` directory
- Interfaces for component props
- `import type` syntax when possible

## Command Instructions

### Special Commands
- `/commit` - Commit current working changes, split into logical commits
- `/doc` - Update README.md with changes
- `/comdoc` - Update README.md, then commit changes

### Documentation Updates
- Update `CLAUDE.md` (this file) when adding new patterns, conventions, or architectural decisions
- Update `docs/development/ai-agent-wip.md` with current progress
- Update `README.md` for user-facing features and setup instructions

### Git Workflow
- Feature branches from main: `feature/name`, `fix/name`, `refactor/name`
- Logical, atomic commits with clear messages
- Reference issue numbers: `fix: correct glow animation (#58)`

## AI Assistant Guidelines

### When Making Changes
1. **Read First**: Always read files before editing
2. **Understand Context**: Review related components and hooks
3. **Check Types**: Ensure TypeScript types are correct
4. **Test Locally**: Run `npm run test:run` and `tsc -b && vite build`
5. **Follow Patterns**: Match existing code style
6. **Update Docs**: Update CLAUDE.md if adding new patterns

### Files to Reference
- **Layout Architecture**: `src/components/PlayerContent.tsx` (ContentWrapper, PlayerContainer)
- **Responsive Sizing**: `src/hooks/usePlayerSizing.ts`, `src/utils/sizingUtils.ts`
- **Component Structure**: `src/components/AudioPlayer.tsx`
- **Hook Patterns**: `src/hooks/usePlayerState.ts`
- **Spotify Integration**: `src/services/spotify.ts`, `src/services/spotifyPlayer.ts`
- **Cache Layer**: `src/services/cache/libraryCache.ts`, `src/services/cache/librarySyncEngine.ts`
- **Theme & Styling**: `src/styles/theme.ts`, `src/styles/utils.ts`
- **Playlist Features**: `src/components/PlaylistSelection.tsx`, `src/utils/playlistFilters.ts`
- **Album Art Flip Menu**: `src/components/AlbumArtBackside.tsx`, flip logic in `src/components/PlayerContent.tsx`
- **Bottom Bar**: `src/components/BottomBar/index.tsx`, `src/components/BottomBar/styled.ts`
- **Drawers**: `src/components/LibraryDrawer.tsx`, `src/components/PlaylistBottomSheet.tsx`, `src/components/styled/Drawer.tsx`
- **Gestures**: `src/hooks/useSwipeGesture.ts`, `src/hooks/useVerticalSwipeGesture.ts`
- **Constants**: `src/constants/playlist.ts`
- **Provider contracts**: `src/types/domain.ts`, `src/types/providers.ts`
- **Provider registry**: `src/providers/registry.ts`
- **Dropbox provider**: `src/providers/dropbox/` (auth, catalog, playback adapters + art/catalog cache)
- **Spotify provider**: `src/providers/spotify/` (auth, catalog, playback adapters)

### AI Workflow Rules
For structured feature development workflows, see `.claude/rules/`:
- `generate_prd.md` - Product Requirements Document creation
- `generate_tasks_from_prd.md` - Task breakdown from PRDs
- `process_tasks.md` - Task execution protocol with git commits
