# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI assistants when working with code in this repository.

## Project Overview

**Vorbis Player** is a React-based Spotify music player with customizable visual effects, background visualizers, and a sleek, unified interface. The app streams music from a user's Spotify account (Premium required) with beautiful album artwork, dynamic color theming, customizable visual effects, and animated background visualizers for an immersive music listening experience.

### Key Features
- **Spotify Integration**: Full Web Playback SDK integration with playlist, album, and Liked Songs support
- **Visual Effects System**: Customizable glow effects, album art filters (brightness, contrast, saturation, sepia, hue rotation, blur)
- **Background Visualizers**: 2 active visualizer types (Particles, Geometric)
- **Fully Responsive Design**: Fluid sizing with aspect-ratio calculations, container queries, and mobile-optimized layout
- **Playlist Management**: Search, sort, and filter playlists and albums with multiple sort criteria
- **Keyboard Shortcuts**: Comprehensive keyboard control system (17 shortcuts)
- **Performance Optimized**: Web Workers, LRU caching, lazy loading, hardware-accelerated animations

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
│   ├── components/              # React components (43 files)
│   │   ├── controls/            # Player control sub-components
│   │   │   ├── EffectsControls.tsx
│   │   │   ├── PlaybackControls.tsx
│   │   │   ├── TimelineControls.tsx
│   │   │   ├── TrackInfo.tsx
│   │   │   ├── VolumeControl.tsx
│   │   │   └── styled.ts
│   │   ├── styled/              # styled-components UI library
│   │   │   ├── Alert.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── ScrollArea.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── index.ts
│   │   ├── visualizers/         # Background visualizer components
│   │   │   ├── ParticleVisualizer.tsx
│   │   │   └── GeometricVisualizer.tsx
│   │   ├── VisualEffectsMenu/
│   │   │   ├── index.tsx
│   │   │   └── styled.ts
│   │   ├── MobileBottomMenu/       # Mobile bottom menu components
│   │   │   ├── index.tsx
│   │   │   ├── MenuContent.tsx
│   │   │   └── styled.ts
│   │   ├── DesktopBottomMenu/      # Desktop bottom menu components
│   │   │   ├── index.tsx
│   │   │   ├── MenuContent.tsx
│   │   │   └── styled.ts
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
│   │   ├── LeftQuickActionsPanel.tsx
│   │   ├── LikeButton.tsx
│   │   ├── PerformanceProfiler.tsx
│   │   ├── PlayerContent.tsx
│   │   ├── PlayerControls.tsx
│   │   ├── PlayerStateRenderer.tsx
│   │   ├── Playlist.tsx
│   │   ├── PlaylistDrawer.tsx
│   │   ├── PlaylistSelection.tsx
│   │   ├── QuickActionsPanel.tsx
│   │   ├── SpotifyPlayerControls.tsx
│   │   ├── TimelineSlider.tsx
│   │   └── VisualEffectsPerformanceMonitor.tsx
│   ├── hooks/                   # Custom React hooks (17 hooks)
│   │   ├── __tests__/
│   │   │   ├── useCustomAccentColors.test.ts
│   │   │   ├── useKeyboardShortcuts.test.ts
│   │   │   ├── useLocalStorage.test.ts
│   │   │   └── usePlayerState.test.ts
│   │   ├── useAccentColor.ts
│   │   ├── useAnimationFrame.ts
│   │   ├── useAutoAdvance.ts
│   │   ├── useCanvasVisualizer.ts
│   │   ├── useCustomAccentColors.ts
│   │   ├── useImageProcessingWorker.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useLocalStorage.ts
│   │   ├── usePlaylistManager.ts
│   │   ├── usePlayerLogic.ts
│   │   ├── usePlayerSizing.ts
│   │   ├── usePlayerState.ts
│   │   ├── useProfilerData.ts
│   │   ├── useSpotifyControls.ts
│   │   ├── useSpotifyPlayback.ts
│   │   ├── useVisualEffectsState.ts
│   │   └── useVolume.ts
│   ├── services/                # External service integrations
│   │   ├── spotify.ts           # Spotify Web API
│   │   └── spotifyPlayer.ts     # Spotify Web Playback SDK
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
│   │   └── ai-agent-wip.md
│   ├── deployment/
│   │   └── deploy-to-vercel.md
│   ├── analysis/
│   │   └── ANALYSIS.md
│   └── implementation-plans/
│       └── library-sort-search-filter.md
├── CLAUDE.md                    # This file
├── .claude/
│   └── rules/
│       ├── generate_prd.md
│       ├── generate_tasks_from_prd.md
│       └── process_tasks.md
├── proxy-server/                # Proxy server for development
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
        ├── PlaylistSelection (search, sort, filter, lazy-loaded images)
        └── PlayerContent (main playing interface)
            └── ContentWrapper (position: relative, overflow: visible, container queries)
                ├── PlayerContainer (flex column, always centered)
                │   ├── CardContent (album art zone)
                │   │   └── ClickableAlbumArtContainer
                │   │       └── AlbumArt (aspect-ratio: 1, max-width: 700px)
                │   │           ├── AlbumArtFilters (CSS filter application)
                │   │           └── AccentColorGlowOverlay
                │   └── AnimatedControlsContainer (slide-down animation)
                │       └── SpotifyPlayerControls
                │           ├── TrackInfo (song name/artist)
                │           ├── PlaybackControls (prev/play/next)
                │           └── TimelineControls
                │               ├── TimelineSlider
                │               ├── VolumeControl
                │               └── LikeButton
                └── BottomMenu (fixed bottom, portaled to body)
                    ├── MobileBottomMenu (mobile only)
                    │   ├── Glow Toggle
                    │   ├── Visual Effects Menu Toggle
                    │   ├── ColorPickerPopover
                    │   ├── Back to Library
                    │   └── Playlist Drawer Toggle
                    └── DesktopBottomMenu (desktop/tablet)
                        ├── Glow Toggle
                        ├── Background Visualizer Toggle
                        ├── Visual Effects Menu Toggle
                        ├── ColorPickerPopover
                        ├── Back to Library
                        └── Playlist Drawer Toggle
```

### Layout Architecture (Critical)

The centering system uses a flex chain from root to player content:

```
AppContainer (flexCenter, min-height: 100dvh)
  → Container/AudioPlayer (flexCenter, min-height: 100dvh)
    → ContentWrapper (position: relative, z-index: 2, overflow: visible)
      → PlayerContainer (translateY(-4rem) when expanded)
```

**Important layout callouts:**
- **`ContentWrapper` must use `position: relative`** (not absolute) so parent flex containers can center it
- **`overflow: visible` is required on ContentWrapper** because `container-type: inline-size` establishes containment that would clip absolutely-positioned elements
- **Vertical centering** relies on the flex chain from root to ContentWrapper — the player (album art + controls) is always centered as a unit
- **`100dvh`** (dynamic viewport height) is used throughout to account for iOS/mobile browser address bar changes
- **Bottom menus** (MobileBottomMenu, DesktopBottomMenu) use `position: fixed` at the bottom with React portals to `document.body`, centered horizontally
- **ContentWrapper padding-bottom** automatically includes space for the bottom menu height plus safe area insets to prevent content overlap
- **BackgroundVisualizer and AccentColorBackground** are `position: fixed` with low z-index values and do not affect layout flow

**UI Control Layout Changes (v2.0)**:
- **Desktop/Tablet**: Quick action buttons moved from side panels to fixed bottom menu, matching mobile layout pattern
- **Mobile**: Quick action buttons remain in fixed bottom menu (unchanged)
- **Removed**: LeftQuickActionsPanel and QuickActionsPanel side panels (desktop only)
- **New**: DesktopBottomMenu component providing unified bottom menu experience across all devices

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

The application uses a centralized state management approach with custom React hooks (17 total):

**Core State Hooks**:
- **usePlayerState.ts** - Central state management with grouped state objects (track, playlist, color, visualEffects)
- **usePlayerLogic.ts** - High-level player orchestration and business logic
- **usePlayerSizing.ts** - Responsive sizing calculations for mobile/tablet/desktop breakpoints

**Spotify Integration Hooks**:
- **usePlaylistManager.ts** - Playlist loading & Liked Songs management with shuffle functionality
- **useSpotifyPlayback.ts** - Spotify Web Playback SDK control and track management
- **useSpotifyControls.ts** - Volume, like, timeline, and playback controls

**Playback & Audio Hooks**:
- **useAutoAdvance.ts** - Auto-advance logic for seamless track progression
- **useVolume.ts** - Volume state management with localStorage persistence

**Visual Effects Hooks**:
- **useAccentColor.ts** - Dynamic color extraction from album artwork using LRU cache
- **useCustomAccentColors.ts** - Per-track color overrides with localStorage persistence
- **useVisualEffectsState.ts** - Glow and filter state management

**Performance & Processing Hooks**:
- **useImageProcessingWorker.ts** - Web Worker integration for image processing
- **useProfilerData.ts** - Performance profiling and metrics collection
- **useCanvasVisualizer.ts** - Canvas-based visualizer management
- **useAnimationFrame.ts** - RequestAnimationFrame wrapper for smooth animations

**UI & Interaction Hooks**:
- **useKeyboardShortcuts.ts** - Centralized keyboard shortcut handling system
- **useLocalStorage.ts** - Generic localStorage hook with error handling and type safety

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

### Utilities

- **colorExtractor.ts** - LRU-cached color extraction from album artwork (100 item cache limit)
- **colorUtils.ts** - Color manipulation utilities (contrast calculation, hex conversion)
- **sizingUtils.ts** - Responsive sizing calculations (viewport info, player dimensions, padding, fluid sizing)
- **playlistFilters.ts** - Playlist/album search, sort, and filter logic
- **visualizerUtils.ts** - Visualizer helper functions
- **performanceMonitor.ts** - Performance tracking utilities
- **visualEffectsPerformance.ts** - Visual effects performance utilities
- **featureDetection.ts** - Browser feature detection (WebGL, backdrop-filter, etc.)

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
- **ColorPickerPopover**: Custom accent colors per track with visual color picker
- **EyedropperOverlay**: Interactive color picking directly from album art
- **Dynamic Extraction**: Automatic dominant color extraction with LRU caching
- **Color Persistence**: Per-track color overrides saved in localStorage

### Background Visualizers

**Available Visualizers**:
- **ParticleVisualizer**: Animated particle system with physics, responds to accent colors
- **GeometricVisualizer**: Rotating geometric shapes synchronized with accent colors

**Configuration**: Toggle on/off, intensity slider (0-100%), style selection. Uses requestAnimationFrame and Canvas API.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `ArrowRight` | Next track |
| `ArrowLeft` | Previous track |
| `ArrowUp` | Volume up |
| `ArrowDown` | Volume down |
| `P` | Toggle playlist drawer |
| `V` | Toggle background visualizer |
| `G` | Toggle glow effect |
| `O` | Open visual effects menu |
| `L` | Like/unlike current track |
| `M` | Mute/unmute |
| `/` or `?` | Show keyboard shortcuts help |
| `Escape` | Close all menus |
| `D` | Toggle debug mode (if enabled) |

Centralized in `useKeyboardShortcuts.ts`. Prevents conflicts with text inputs and Ctrl/Cmd shortcuts.

### Playlist Management

- **Search**: Real-time search across playlist/album names with debouncing
- **Sort (Playlists)**: Recently added, Name (A-Z), Name (Z-A)
- **Sort (Albums)**: Recently added, Name, Artist, Release date (newest/oldest)
- **Filter (Albums)**: Filter by decade (1980s through present)
- **View Modes**: Toggle between Playlists and Albums tabs
- **Liked Songs**: Special playlist with automatic shuffle, heart icon indicator
- **Progressive Loading**: Shows cached data immediately, refreshes in background
- **Lazy Images**: Intersection Observer-based image loading (50px margin)

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

### Active Test Suites (8 files)

**Hook Tests**:
- `src/hooks/__tests__/useKeyboardShortcuts.test.ts` - Keyboard shortcut handling and event delegation
- `src/hooks/__tests__/useLocalStorage.test.ts` - localStorage hook functionality and error handling
- `src/hooks/__tests__/useCustomAccentColors.test.ts` - Custom accent color management
- `src/hooks/__tests__/usePlayerState.test.ts` - Central state management and color persistence

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
- **Side panels clipped**: Ensure `overflow: visible` is set on ContentWrapper. The `container-type: inline-size` creates containment that can clip absolutely-positioned children.
- **Player not centered**: ContentWrapper must use `position: relative` (not absolute) so parent flex containers can center it.
- **Mobile viewport bouncing**: Use `100dvh` instead of `100vh` to account for iOS address bar changes.

### Spotify Integration
- **Liked Songs not loading**: Verify user-library-read scope and that user has liked songs
- **Authentication issues**: Use `127.0.0.1` not `localhost` for OAuth callback
- **Track skipping**: Auto-skip handles 403 Restriction Violated errors for unavailable tracks

### Visual Effects
- **Album art filters not working**: Always pass `albumFilters={albumFilters}` to AlbumArt component
- **Glow bleed**: Quick access panels render above album art glow (z-index hierarchy)

### Performance
- **Color extraction**: Ensure LRU cache in colorExtractor.ts is functioning (100 item limit)
- **Re-renders**: Verify React.memo with custom comparison functions on heavy components
- **Bundle size**: Check lazy loading and code splitting configuration

## Environment Configuration

Required in `.env.local`:
```
VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
```

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
- **Theme & Styling**: `src/styles/theme.ts`, `src/styles/utils.ts`
- **Playlist Features**: `src/components/PlaylistSelection.tsx`, `src/utils/playlistFilters.ts`

### AI Workflow Rules
For structured feature development workflows, see `.claude/rules/`:
- `generate_prd.md` - Product Requirements Document creation
- `generate_tasks_from_prd.md` - Task breakdown from PRDs
- `process_tasks.md` - Task execution protocol with git commits
