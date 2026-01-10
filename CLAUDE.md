# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI assistants when working with code in this repository.

## Project Overview

**Vorbis Player** is a React-based Spotify music player with customizable visual effects, background visualizers, and a sleek, unified interface. The app streams music from a user's Spotify account (Premium required) with beautiful album artwork, dynamic color theming, customizable visual effects, and animated background visualizers for an immersive music listening experience.

### Key Features
- **Spotify Integration**: Full Web Playback SDK integration with playlist and Liked Songs support
- **Visual Effects System**: Customizable glow effects, album art filters (brightness, contrast, saturation, sepia, hue rotation, blur)
- **Background Visualizers**: 2 active visualizer types (Particles, Geometric) - 2 deprecated visualizers exist but are not used
- **Responsive Design**: Fixed 768px x 880px layout with mobile optimization
- **Keyboard Shortcuts**: Comprehensive keyboard control system
- **Performance Optimized**: Web Workers, LRU caching, lazy loading, hardware-accelerated animations

## Recent Major Updates

### 🎵 Liked Songs Feature (Latest)
- **New Playlist Type**: Added support for playing user's Spotify Liked Songs collection
- **Automatic Shuffle**: Liked Songs are automatically shuffled for music discovery experience
- **Enhanced UI**: Special heart icon and styling for Liked Songs option in playlist selection
- **API Integration**: New functions `getLikedSongs()`, `checkTrackSaved()`, `saveTrack()`, `unsaveTrack()` in spotify.ts
- **Playlist Manager**: Updated `usePlaylistManager.ts` to handle liked songs with shuffle functionality

### 🚀 Performance Optimizations
- **Button Responsiveness**: 70-80% improvement in button click response (200-500ms → 50-100ms)
- **Glow Feature Performance**: 75% improvement in glow animation overhead (40-60% degradation → 10-15% impact)
- **GPU-Accelerated Animations**: CSS variables with hardware acceleration for smooth 60fps glow effects
- **Web Worker Canvas Processing**: 80-90% reduction in main thread blocking during image processing with `imageProcessor.worker.ts`
- **Optimized Re-renders**: 30-40% reduction in unnecessary component re-renders with enhanced React.memo patterns
- **Virtual Scrolling**: 20-30% improvement in visual effects menu responsiveness using react-window
- **Debounced State Updates**: 150ms debouncing prevents excessive re-renders during rapid user interactions
- **Bundle Size Reduction**: 35-45% smaller bundle through code splitting and lazy loading
- **Loading Performance**: 30-40% faster initial load times with resource preloading and caching
- **Color Extraction**: 50-60% faster track transitions with intelligent caching system in `colorExtractor.ts`
- **Memory Usage**: 20-30% reduction in memory footprint through optimized animations and worker processing
- **Playlist Selection Progressive Loading**: Near-instant display of cached playlist/album data with background refresh in `PlaylistSelection.tsx`
- **Image Lazy Loading**: Intersection Observer-based image loading for playlist/album artwork (50px viewport margin)
- **Request Cancellation**: AbortController implementation prevents memory leaks and unnecessary network requests on component unmount
- **Optimized API Calls**: Separate `getLikedSongsCount()` function for lightweight count-only requests

### 🎨 UI/UX Improvements
- **Updated Screenshots**: New interface screenshots showing current design
- **Enhanced Styling**: Improved responsive design and visual consistency
- **Better Error Handling**: More graceful error states and user feedback
- **Optimized Icons**: Consistent sizing across all control icons
- **Component Refactoring**: SpotifyPlayerControls decomposed into focused sub-components

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
│   ├── components/           # React components
│   │   ├── controls/        # Refactored player control sub-components
│   │   │   ├── EffectsControls.tsx
│   │   │   ├── PlaybackControls.tsx
│   │   │   ├── TimelineControls.tsx
│   │   │   ├── TrackInfo.tsx
│   │   │   ├── VolumeControl.tsx
│   │   │   └── styled.ts
│   │   ├── styled/          # styled-components UI library
│   │   ├── ui/              # Radix UI component wrappers
│   │   ├── visualizers/     # Background visualizer components
│   │   │   ├── ParticleVisualizer.tsx
│   │   │   ├── GeometricVisualizer.tsx
│   │   │   ├── GradientFlowVisualizer.tsx
│   │   │   └── WaveformVisualizer.tsx
│   │   ├── VisualEffectsMenu/
│   │   ├── __tests__/       # Component tests
│   │   └── [other components]
│   ├── hooks/               # Custom React hooks (17 hooks total)
│   │   └── __tests__/       # Hook tests
│   ├── services/            # External service integrations
│   │   ├── spotify.ts       # Spotify Web API
│   │   └── spotifyPlayer.ts # Spotify Web Playback SDK
│   ├── utils/               # Utility functions
│   │   ├── colorExtractor.ts
│   │   ├── performanceMonitor.ts
│   │   ├── sizingUtils.ts
│   │   ├── visualEffectsPerformance.ts
│   │   └── __tests__/
│   ├── workers/             # Web Workers
│   │   └── imageProcessor.worker.ts
│   ├── types/               # TypeScript definitions
│   ├── styles/              # Global styles & theme
│   ├── lib/                 # Helper functions
│   ├── assets/              # Static assets
│   └── test/                # Test setup
├── docs/
│   ├── development/         # Developer documentation
│   │   └── ai-agent-wip.md  # Current work tracking
│   ├── deployment/          # Deployment guides
│   └── analysis/            # Analysis documents
├── CLAUDE.md                # This file (AI assistant guidance - root directory per Anthropic best practices)
├── .claude/
│   └── rules/               # AI workflow rules
│       ├── generate_prd.md
│       ├── generate_tasks_from_prd.md
│       └── process_tasks.md
├── proxy-server/            # Proxy server for development
└── [config files]
```

### Component Hierarchy

```
App.tsx (OAuth authentication)
└── AudioPlayer (main orchestrator with centralized state)
    └── PlayerStateRenderer (loading/error/playlist selection states)
        └── PlayerContent (main playing interface)
            ├── BackgroundVisualizer (animated background)
            │   ├── ParticleVisualizer
            │   ├── GeometricVisualizer
            │   ├── GradientFlowVisualizer
            │   └── WaveformVisualizer
            ├── LeftQuickActionsPanel (quick visual effects toggles)
            ├── AlbumArt (artwork with filters & effects)
            │   ├── AlbumArtFilters (CSS filter application)
            │   └── AccentColorGlowOverlay (glow effect)
            ├── SpotifyPlayerControls (three-column layout)
            │   ├── TrackInfo (left - song/artist)
            │   ├── ControlsToolbar (center - play/pause/skip)
            │   │   ├── PlaybackControls
            │   │   └── EffectsControls
            │   └── TimelineControls (bottom - timeline/volume/like)
            │       ├── TimelineSlider
            │       ├── VolumeControl
            │       ├── LikeButton
            │       └── ColorPickerPopover
            ├── PlaylistDrawer (sliding track list)
            ├── VisualEffectsMenu (visual effects configuration)
            └── KeyboardShortcutsHelp (help overlay)
```

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
- **useImageProcessingWorker.ts** - Web Worker integration for image processing (80-90% reduction in main thread blocking)
- **useProfilerData.ts** - Performance profiling and metrics collection
- **useCanvasVisualizer.ts** - Canvas-based visualizer management
- **useAnimationFrame.ts** - RequestAnimationFrame wrapper for smooth animations

**UI & Interaction Hooks**:
- **useKeyboardShortcuts.ts** - Centralized keyboard shortcut handling system
- **useLocalStorage.ts** - Generic localStorage hook with error handling and type safety

### Service Layer

**Spotify Services**:
- **spotify.ts** - Spotify Web API integration for playlists and authentication, includes comprehensive track library management functions:
  - `getUserPlaylists()`: Gets user's playlists
  - `getPlaylistTracks(playlistId)`: Gets tracks from specific playlist
  - `getLikedSongs(limit)`: Gets user's liked songs with pagination
  - `checkTrackSaved(trackId)`: Checks if track is saved in user's library
  - `saveTrack(trackId)`: Saves track to user's library
  - `unsaveTrack(trackId)`: Removes track from user's library
- **spotifyPlayer.ts** - Spotify Web Playback SDK wrapper with state management

### Utilities

**Core Utilities** (from src/utils/):
- **colorExtractor.ts** - LRU-cached color extraction with improved performance
- **colorUtils.ts** - Color manipulation utilities
- **sizingUtils.ts** - Responsive sizing calculations
- **performanceMonitor.ts** - Performance tracking
- **visualEffectsPerformance.ts** - Visual effects performance utilities
- **featureDetection.ts** - Browser feature detection

## Key Implementation Details

### Authentication Flow

- **Spotify Integration**: Uses PKCE OAuth flow for secure authentication with required scopes
- **Music Streaming**: Streams from user's Spotify playlists and Liked Songs using Web Playback SDK (Premium required)
- **Liked Songs Access**: Full access to user's Spotify Liked Songs collection with automatic shuffle
- **Token Management**: Automatic token refresh for long-term authentication sessions
- **Authentication Flow**: Handles callback at `http://127.0.0.1:3000/auth/spotify/callback`
- **Required Scopes**: streaming, user-read-email, user-read-private, user-read-playback-state, user-library-read, user-library-modify

### Playback System

- **Auto-Play & Continuous Playback**: Automatically starts first song and seamlessly advances through tracks
- **Infinite Playlist**: Loops back to beginning when reaching the end of your music collection
- **Track Selection Sync**: When users click playlist items vs. use audio player next/prev buttons
- **Auto-play progression**: Seamless advancement between tracks with end-of-song detection
- **State Management**: Uses `isInitialLoad` flag and proper useEffect dependency ordering to prevent initialization errors

### Visual Effects System

**Glow Effects**:
- Controlled via `useVisualEffectsState` hook with per-album settings stored in localStorage
- GPU-accelerated CSS animations for smooth 60fps performance
- Configurable intensity (Less/Normal/More) and rate (Slower/Normal/Faster)
- Optional accent color background overlay
- 75% improvement in performance overhead (40-60% → 10-15% impact)

**Album Art Filters**:
- Real-time CSS filters applied to album artwork:
  - Brightness, contrast, saturation, hue rotation
  - Blur, sepia effects
  - Smooth transitions with 0.3s ease timing
- Individual sliders for each filter type with real-time preview
- Persistent settings in localStorage (key: 'vorbis-player-album-filters')
- Dynamic theming: slider thumbs use extracted dominant color
- One-click reset to restore default filter values
- Hardware-accelerated for optimal performance

**Color System**:
- **ColorPickerPopover**: Custom accent colors per track with visual color picker
- **EyedropperOverlay**: Interactive color picking directly from album art
- **Dynamic Extraction**: Automatic dominant color extraction with LRU caching (50-60% faster transitions)
- **Color Persistence**: Per-track color overrides saved in localStorage

### Background Visualizers

The application includes 2 active visualizer types (4 files exist, but 2 are deprecated):

**Active Visualizers**:

**ParticleVisualizer** (`src/components/visualizers/ParticleVisualizer.tsx`):
- Animated particle system with physics simulation
- Particles respond to music tempo and accent colors
- Configurable density and animation speed
- Default fallback for deprecated visualizers

**GeometricVisualizer** (`src/components/visualizers/GeometricVisualizer.tsx`):
- Rotating geometric shapes and patterns
- Synchronized with album accent colors
- Smooth rotation and scaling animations

**Deprecated Visualizers** (files exist but fallback to ParticleVisualizer):

**GradientFlowVisualizer** (`src/components/visualizers/GradientFlowVisualizer.tsx`):
- Deprecated - currently falls back to ParticleVisualizer (line 63-64 in BackgroundVisualizer.tsx)
- File exists but not actively used

**WaveformVisualizer** (`src/components/visualizers/WaveformVisualizer.tsx`):
- Deprecated - currently falls back to ParticleVisualizer (line 59-61 in BackgroundVisualizer.tsx)
- File exists but not actively used

**Configuration**:
- Toggle on/off via LeftQuickActionsPanel or VisualEffectsMenu
- Intensity slider (0-100%) for animation strength
- Style selection in VisualEffectsMenu (only 'particles' and 'geometric' are active)
- Performance: Uses requestAnimationFrame and Canvas API for smooth 60fps rendering
- Managed by `BackgroundVisualizer.tsx` component (lines 51-68)

### Keyboard Shortcuts System

Comprehensive keyboard control system managed by `useKeyboardShortcuts` hook (lines 66-228):

**Playback Controls**:
- `Space` (line 106-109): Play/Pause toggle
- `←` ArrowLeft (line 116-119): Previous track
- `→` ArrowRight (line 111-114): Next track
- `↑` ArrowUp (line 182-188): Volume up (if handler provided)
- `↓` ArrowDown (line 190-196): Volume down (if handler provided)

**Menu & UI Controls**:
- `P` (line 122-127): Toggle playlist drawer
- `O` (line 137-143): Open visual effects menu
- `Escape` (line 162-166): Close all menus (playlist drawer and visual effects)
- `/` or `?` (line 153-159): Show keyboard shortcuts help overlay

**Visual Effects Controls**:
- `G` (line 145-151): Toggle glow effect
- `V` (line 129-135): Toggle background visualizer (NOT visual effects menu)

**Other Controls**:
- `L` (line 174-180): Like/unlike current track
- `M` (line 169-172): Mute/unmute
- `D` (line 199-204): Toggle debug mode (only if `enableDebugMode` option is enabled)

**Implementation Details**:
- Centralized in `src/hooks/useKeyboardShortcuts.ts`
- Event delegation for optimal performance
- Prevents conflicts with text input fields, textareas, and contentEditable elements (lines 92-101)
- Visual help overlay component: `KeyboardShortcutsHelp.tsx`
- Prevents default browser behavior for all handled keys
- Does not interfere with Ctrl/Cmd+Key browser shortcuts

### Playlist Management

- **Playlist Selection**: 'liked-songs' special playlist ID for Liked Songs
- **Automatic Shuffle**: Liked Songs are automatically shuffled using `shuffleArray()` helper function
- **API Integration**: New Spotify API functions for liked songs management
- **UI Integration**: Special heart icon and "Shuffle enabled" indicator in playlist selection
- **Performance**: Limits to 200 tracks for optimal performance

## Tech Stack

**Frontend Framework**:
- **React 18.3.1**: Functional components with hooks, React.memo for optimization
- **TypeScript 5.8.3**: Full type safety with strict mode enabled
- **Vite 6.3.5**: Build tool with HMR, ES2020 target, optimized chunking

**Styling & UI**:
- **styled-components 6.1.12**: CSS-in-JS with TypeScript support and theme system
- **Radix UI**: Accessible component primitives (@radix-ui/react-scroll-area)
- **CSS Features**: Custom properties, backdrop-filter, hardware-accelerated transforms

**Audio & Music**:
- **Spotify Web Playback SDK**: Premium audio streaming
- **Spotify Web API**: Playlist management, track library, user data
- **Authentication**: PKCE OAuth 2.0 flow

**Visual Effects**:
- **Canvas API**: Background visualizers with requestAnimationFrame
- **CSS Filters**: Hardware-accelerated brightness, contrast, saturation, blur, sepia
- **Web Workers**: Image processing (imageProcessor.worker.ts)
- **Color Extraction**: LRU-cached dominant color extraction

**State Management**:
- **React Hooks**: 17 custom hooks for feature-specific state
- **localStorage**: Persistent user preferences and visual settings
- **Centralized State**: usePlayerState hook for global app state

**Performance**:
- **Lazy Loading**: Code splitting for heavy components
- **LRU Caching**: Color extraction cache (100 item limit)
- **Debouncing**: 150ms debounce for rapid state updates
- **Memoization**: React.memo on AlbumArt, VisualEffectsMenu, heavy components
- **Bundle Optimization**: Manual chunking (vendor, radix, styled)

**Testing**:
- **Vitest 3.2.4**: Fast unit testing with Vite integration
- **@testing-library/react 16.3.0**: Component testing utilities
- **jsdom 26.1.0**: DOM simulation for tests
- **@vitest/coverage-v8**: Code coverage reporting

**Development Tools**:
- **ESLint 9.25.0**: Code linting with TypeScript support
- **Concurrently 8.2.2**: Run multiple dev servers
- **TypeScript ESLint**: Type-aware linting rules

**Build Configuration**:
- **Target**: ES2020 for modern browser features
- **Minification**: esbuild for fast builds
- **Sourcemaps**: Disabled in production for smaller bundles
- **Asset Inlining**: <4KB files inlined as base64
- **CSS Code Splitting**: Separate CSS chunks for faster loads

## Build & Configuration

### Vite Configuration (`vite.config.ts`)

**Manual Chunk Splitting**:
```javascript
manualChunks: {
  vendor: ['react', 'react-dom'],           // Core React bundle
  radix: ['@radix-ui/react-scroll-area'],   // Radix UI components
  styled: ['styled-components']              // Styling library
}
```

**Development Server**:
- Host: `127.0.0.1` (required for Spotify OAuth)
- Port: `3000`
- HMR enabled for fast development

**Build Optimizations**:
- CSS code splitting enabled
- Minification: esbuild (faster than terser)
- Chunk size warning limit: 1000KB
- Asset inline limit: 4KB

### TypeScript Configuration

**Path Aliases** (`tsconfig.json`):
```json
{
  "baseUrl": ".",
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

**Usage**: Import with `@/` prefix for clean imports:
```typescript
import { usePlayerState } from '@/hooks/usePlayerState'
import { extractColors } from '@/utils/colorExtractor'
```

**Project References**:
- `tsconfig.app.json` - Application code configuration
- `tsconfig.node.json` - Node.js configuration for build scripts

### ESLint Configuration (`eslint.config.js`)

**Plugins**:
- `@eslint/js` - Core JavaScript rules
- `typescript-eslint` - TypeScript-specific rules
- `eslint-plugin-react-hooks` - React Hooks rules
- `eslint-plugin-react-refresh` - React Fast Refresh rules

**Rules**:
- React Hooks rules enforced (dependencies, exhaustive-deps)
- React Refresh: warn on non-component exports
- TypeScript: recommended rules enabled

## Common Issues & Solutions

### Liked Songs Not Loading
- **Root Cause**: Missing user-library-read scope or no liked songs in account
- **Solution**: Verify Spotify app scopes and ensure user has liked songs
- **Location**: Check `spotify.ts` getLikedSongs() function

### Album Art Filters Not Working
- **Root Cause**: Missing `albumFilters` prop in AlbumArt component
- **Solution**: Always pass `albumFilters={albumFilters}` to AlbumArt component
- **Location**: AudioPlayer.tsx line ~704

### Performance Issues
- **Color Extraction**: Ensure colorExtractor.ts cache is properly implemented
- **Component Re-renders**: Verify React.memo is applied to heavy components
- **Bundle Size**: Check that lazy loading is properly configured

### Type Inconsistencies
- **Filter Types**: Ensure filter interfaces match between components
- **Invert Property**: AlbumArtFilters expects boolean, VisualEffectsMenu uses number
- **Solution**: Standardize on single type across all filter components

### Development Workflow
- **Single server**: Use `npm run dev` for development
- **Visual effects testing**: Test all filter combinations for performance
- **Component hierarchy**: AudioPlayer → AlbumArt → AlbumArtFilters for filter application
- **Performance monitoring**: Use React DevTools Profiler for performance analysis

## Performance Optimizations

### Key Metrics to Track
- **First Contentful Paint (FCP)**: Target < 1.5s
- **Largest Contentful Paint (LCP)**: Target < 2.5s
- **Time to Interactive (TTI)**: Target < 3.5s
- **Bundle Size**: Target < 500KB gzipped
- **Track Transition Time**: Target < 200ms

### Tools for Monitoring
- **Lighthouse**: For Core Web Vitals monitoring
- **Bundle Analyzer**: For bundle size analysis
- **React DevTools Profiler**: For component performance
- **Web Vitals Library**: For real-user monitoring

### Implemented Optimizations
- **Color Extraction Caching**: LRU cache in `colorExtractor.ts` with 100 item limit for 50-60% faster transitions
- **Component Memoization**: React.memo applied to heavy components like AlbumArt, VisualEffectsMenu, and PlaylistImage
- **Lazy Loading**: VisualEffectsMenu and other heavy components loaded on-demand
- **Progressive Loading**: PlaylistSelection shows cached data immediately, then refreshes in background (see `getCachedData()` in `spotify.ts`)
- **Intersection Observer**: Image lazy loading in PlaylistSelection with 50px viewport margin for optimal performance
- **Request Cancellation**: AbortController pattern prevents memory leaks and unnecessary API calls
- **Resource Hints**: DNS prefetch and preconnect for Spotify API and image CDNs
- **Bundle Optimization**: Code splitting and tree-shaking for reduced bundle size

## Testing & Test Coverage

### Active Tests
The project maintains the following test suites:

- **src/hooks/__tests__/useKeyboardShortcuts.test.ts** - Keyboard shortcut handling and event delegation
- **src/hooks/__tests__/useLocalStorage.test.ts** - localStorage hook functionality and error handling
- **src/hooks/__tests__/useCustomAccentColors.test.ts** - Custom accent color management and overrides
- **src/hooks/__tests__/usePlayerState.test.ts** - Central state management and color persistence
- **src/utils/__tests__/sizingUtils.test.ts** - Responsive sizing calculations across breakpoints
- **src/components/__tests__/KeyboardShortcutsIntegration.test.tsx** - Keyboard integration with UI

### Removed Tests (Stale/Unreliable)
As of November 28, 2025, the following outdated test files were removed to improve codebase health:

- **src/services/__tests__/spotify-api.test.ts** - Tested mock implementations instead of real code
- **src/tests/visualEffectsPerformance.test.ts** - Artificial performance tests with unreliable mocks
- **src/hooks/__tests__/usePlayerLogic.test.ts** - Only 3 trivial tests without meaningful coverage
- **src/__tests__/localStorageCleanup.test.ts** - Cleanup functionality no longer relevant
- **src/components/__tests__/PlayerContent.test.tsx** - Minimal assertions, incomplete tests

These removals eliminate false test coverage and reduce maintenance burden.

### Running Tests
```bash
npm run test           # Run tests in watch mode
npm run test:run       # Run tests once
npm run test:ui        # Run tests with UI
npm run test:coverage  # Run tests with coverage
```

### Testing Guidelines
- Tests should verify actual behavior, not mock implementations
- Performance tests should use real browser APIs when possible
- Every test should have meaningful assertions
- Remove tests that don't provide value

## Environment Configuration

Required environment variables in `.env.local`:

```
VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
```

## AI Workflow Rules

For structured feature development workflows, see detailed rules in `.claude/rules/`:

- **`.claude/rules/generate_prd.md`** - Guide for creating Product Requirements Documents (PRDs) through clarifying questions and structured documentation
- **`.claude/rules/generate_tasks_from_prd.md`** - Breaking PRDs into parent/sub-task hierarchies with two-phase generation (parent tasks → sub-tasks)
- **`.claude/rules/process_tasks.md`** - Step-by-step task execution protocol with git commits after completing parent tasks

These rules define workflows for PRD creation, task breakdown, and implementation tracking when working on larger features.

## Coding Conventions & Best Practices

### React Component Patterns

**Functional Components with Hooks**:
```typescript
import React from 'react';
import { usePlayerState } from '@/hooks/usePlayerState';

export const MyComponent: React.FC = () => {
  const { trackState, setTrackState } = usePlayerState();

  return <div>{/* component JSX */}</div>;
};
```

**Performance Optimization**:
- Apply `React.memo()` to heavy components (AlbumArt, VisualEffectsMenu)
- Use `useMemo()` for expensive calculations
- Use `useCallback()` for event handlers passed to child components
- Minimize prop drilling via `usePlayerState` centralized hook

**Component Organization**:
- One component per file
- Co-locate sub-components in dedicated directories
- Export components as named exports
- Keep component files under 500 lines (refactor if larger)

### State Management Patterns

**Grouped State for Related Data**:
```typescript
// Good: Grouped state reduces re-renders
const [trackState, setTrackState] = useState({
  currentTrack: null,
  isPlaying: false,
  progress: 0
});

// Avoid: Separate state causes multiple re-renders
const [currentTrack, setCurrentTrack] = useState(null);
const [isPlaying, setIsPlaying] = useState(false);
const [progress, setProgress] = useState(0);
```

**localStorage Persistence**:
- Use `useLocalStorage` hook for type-safe persistence
- Prefix keys with 'vorbis-player-' for namespacing
- Handle parse errors gracefully
- Provide sensible defaults

### Styling Conventions

**styled-components Best Practices**:
```typescript
import styled from 'styled-components';

// Use theme for consistency
const Button = styled.button`
  background: ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
`;

// Hardware acceleration for animations
const AnimatedBox = styled.div`
  transform: translateZ(0);
  will-change: transform, opacity;
  transition: transform 0.3s ease;
`;
```

**CSS Custom Properties for Dynamic Colors**:
```typescript
// Set CSS variables from extracted colors
document.documentElement.style.setProperty('--accent-color', accentColor);

// Use in styled-components
const AccentBox = styled.div`
  background: var(--accent-color, #3b82f6);
`;
```

### Performance Best Practices

**Debouncing Rapid Updates**:
```typescript
import { debounce } from 'lodash';

const debouncedUpdate = useMemo(
  () => debounce((value) => setState(value), 150),
  []
);
```

**Lazy Loading Components**:
```typescript
const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu'));

<Suspense fallback={<Skeleton />}>
  <VisualEffectsMenu />
</Suspense>
```

**LRU Cache Pattern** (see `colorExtractor.ts`):
- Limit cache size (100 items)
- Use Map for O(1) lookups
- Evict least recently used items

### TypeScript Conventions

**Strict Type Safety**:
- Enable strict mode in tsconfig.json
- Avoid `any` types (use `unknown` if needed)
- Define interfaces for component props
- Use type guards for runtime checks

**Type Definitions**:
- Place types in `src/types/` directory
- Use `.d.ts` files for declaration-only types
- Import types with `import type` syntax when possible

### Error Handling

**Spotify API Errors**:
```typescript
try {
  const data = await spotify.getUserPlaylists();
} catch (error) {
  console.error('Failed to fetch playlists:', error);
  // Show user-friendly error message
  setError('Could not load playlists. Please try again.');
}
```

**Graceful Degradation**:
- Provide fallbacks for missing features
- Handle localStorage quota errors
- Detect WebGL support for visualizers
- Use feature detection (see `featureDetection.ts`)

### Testing Guidelines

**What to Test**:
- Custom hooks (state management, side effects)
- Utility functions (color extraction, sizing calculations)
- User interactions (keyboard shortcuts, click handlers)
- Integration points (localStorage, Spotify API mocks)

**What NOT to Test**:
- Mock implementations instead of real code
- Trivial getter/setter functions
- Third-party library internals
- Purely visual styling

**Test Structure**:
```typescript
describe('useKeyboardShortcuts', () => {
  it('should play/pause on spacebar', () => {
    // Arrange
    const { result } = renderHook(() => useKeyboardShortcuts());

    // Act
    fireEvent.keyDown(window, { key: ' ' });

    // Assert
    expect(mockTogglePlayback).toHaveBeenCalled();
  });
});
```

## Recent Activity & Changes

### Latest Commits (December 2025)
- **31b7227**: docs: Add testing section and update WIP tracking (#76)
- **4b4130b**: Remove stale and outdated test files (#75)
- **a7994c2**: cleanup: remove temporary task planning and refactoring docs (#74)
- **e8d3e54**: enhance support for keyboard shortcuts
- **de7ac84**: refactor: vfx components and state management (#72)
- **3b6fb0a**: refactor: consolidate keyboard shortcuts into centralized hook (#71)

### Current WIP (from `ai-agent-wip.md`)
- **Completed**: Quick Actions Panel rounded corners fix (Issue #58)
- **Completed**: Player sizing strategy overhaul (responsive design)
- **In Progress**: Background color consistency across screens (Issue #60)
- **Testing Phase**: Cross-device testing for responsive design

### Major Refactorings
1. **Keyboard Shortcuts Consolidation**: Centralized all shortcuts into `useKeyboardShortcuts` hook
2. **VFX Components**: Refactored visual effects into modular components
3. **Player Controls**: Decomposed into sub-components (TrackInfo, PlaybackControls, TimelineControls)
4. **State Management**: Migrated to centralized `usePlayerState` hook

## Command Instructions

### Special Commands
- `/commit` - Commit current working changes to the current branch. Split into logically related commits in correct sequential order
- `/doc` - Update README.md with changes
- `/comdoc` - Update README.md, then commit changes (/doc + /commit in that order)

### Documentation Updates
- Update `CLAUDE.md` (this file, in root directory) when adding new patterns, conventions, or architectural decisions
- Update `docs/development/ai-agent-wip.md` with current progress and task status
- Update `README.md` for user-facing features and setup instructions

### Git Workflow
- Create feature branches from main
- Use descriptive branch names: `feature/name`, `fix/name`, `refactor/name`
- Make logical, atomic commits with clear messages
- Reference issue numbers in commits: `fix: correct glow animation (#58)`
- Update documentation before committing large features

## AI Assistant Guidelines

### When Making Changes
1. **Read First**: Always read files before editing
2. **Understand Context**: Review related components and hooks
3. **Check Types**: Ensure TypeScript types are correct
4. **Test Locally**: Run `npm run test` and `npm run build`
5. **Follow Patterns**: Match existing code style and conventions
6. **Update Docs**: Update CLAUDE.md if adding new patterns

### Common Workflows

**Adding a New Feature**:
1. Read relevant existing code (components, hooks, services)
2. Create/update necessary hooks in `src/hooks/`
3. Create/update components in `src/components/`
4. Add TypeScript types in `src/types/`
5. Add tests in `__tests__/` directories
6. Update documentation (README.md, CLAUDE.md)
7. Test build and lint: `npm run build && npm run lint`
8. Commit changes with clear message

**Fixing a Bug**:
1. Reproduce and understand the issue
2. Locate the bug in relevant files
3. Fix with minimal changes
4. Add test to prevent regression
5. Verify fix doesn't break other features
6. Commit with descriptive message

**Performance Optimization**:
1. Profile with React DevTools and Lighthouse
2. Identify bottlenecks (re-renders, expensive calculations)
3. Apply optimizations (memoization, lazy loading, caching)
4. Measure improvement
5. Document optimization in code comments
6. Update CLAUDE.md if introducing new patterns

### Files to Reference

**For Component Structure**: `src/components/AudioPlayer.tsx`
**For Hook Patterns**: `src/hooks/usePlayerState.ts`
**For Spotify Integration**: `src/services/spotify.ts`, `src/services/spotifyPlayer.ts`
**For Performance**: `src/utils/colorExtractor.ts`, `src/utils/performanceMonitor.ts`
**For Styling**: `src/components/styled/`, theme files
**For Testing**: `src/hooks/__tests__/usePlayerState.test.ts`

### Related Documentation
- **AGENTS.md**: Quick reference for AI agent commands and conventions
- **README.md**: User-facing documentation and setup guide
- **ai-agent-wip.md**: Current work in progress tracking
- **.claude/rules/**: Structured workflow rules for PRD generation and task processing