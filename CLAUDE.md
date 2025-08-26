# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vorbis Player** is a hybrid music player that supports both Spotify streaming and local music file playback. It features a unified interface with customizable visual effects, dynamic color theming, and seamless switching between Spotify and local music libraries.

## Development Commands

```bash
# Core Development
npm run dev                  # Start development server
npm run build               # Build for production (tsc -b && vite build)
npm run lint                # Run ESLint
npm run preview             # Preview production build

# Testing
npm run test                # Run tests in watch mode
npm run test:run            # Run tests once
npm run test:ui             # Run tests with UI
npm run test:coverage       # Run tests with coverage

# Electron (Desktop App)
npm run electron:dev        # Run Electron app in development
npm run electron:build      # Build Electron assets
npm run electron:pack       # Package Electron app
npm run electron:dist       # Create distributable

# Deployment
npm run deploy              # Deploy to production (Vercel)
npm run deploy:preview      # Deploy preview build
```

## High-Level Architecture

### Dual Playback System
The app features a **unified player service** (`unifiedPlayer.ts`) that abstracts two playback sources:
- **Spotify Streaming**: Via Web Playback SDK (requires Premium)
- **Local Files**: Via Web Audio API with Electron file system access

### Core Application Flow

```
App.tsx
├── Spotify OAuth Authentication
├── ElectronTitleBar (if in Electron)
└── AudioPlayerComponent
    ├── LibraryNavigation (Spotify/Local toggle)
    ├── PlaylistSelection / LocalLibraryDrawer
    ├── AlbumArt (with visual effects)
    ├── SpotifyPlayerControls
    └── Various modals (Settings, Volume, Visual Effects)
```

### Key Services Architecture

1. **Unified Player** (`unifiedPlayer.ts`)
   - Manages both Spotify and local playback
   - Emits unified events for UI updates
   - Maintains consistent state across sources

2. **Spotify Services**
   - `spotify.ts`: API integration, auth, playlists, liked songs
   - `spotifyPlayer.ts`: Web Playback SDK wrapper

3. **Local Music Services** (Electron-only)
   - `localAudioPlayer.ts`: Web Audio API playback
   - `localLibraryScanner.ts`: File system scanning
   - `localLibraryDatabase.ts`: SQLite database for metadata
   - `albumArtManager.ts`: Album art extraction/management

4. **Visual Effects System**
   - `colorExtractor.ts`: LRU-cached color extraction
   - Real-time CSS filters on album artwork
   - Hardware-accelerated animations

## Environment Configuration

Required `.env.local`:
```
VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
```

## Critical Implementation Details

### Local Music Library (Electron Mode)

- **Database**: SQLite with better-sqlite3 for track metadata
- **File Scanning**: Chokidar for real-time file monitoring
- **Metadata Extraction**: music-metadata library for audio file parsing
- **Album Art**: Sharp for image processing and caching
- **IPC Communication**: Electron IPC for main/renderer process communication
- **Supported Formats**: MP3, M4A, FLAC, OGG, WAV

### State Management Patterns

- **Playback State**: Managed by `usePlayerState` hook
- **Playlist Management**: `usePlaylistManager` hook with Liked Songs shuffle
- **Visual Effects**: Persisted in localStorage
- **Volume**: Cross-session persistence
- **Library Mode**: Toggle between Spotify and Local sources

### Performance Optimizations

- **Component Memoization**: React.memo on heavy components
- **Lazy Loading**: Dynamic imports for modals and drawers
- **Color Extraction Cache**: LRU cache (100 items) for 50-60% faster transitions
- **Web Worker Processing**: For image processing in glow effects
- **Debounced Updates**: 150ms debounce on rapid state changes
- **Virtual Scrolling**: react-window for large lists

### Testing Strategy

- **Unit Tests**: Vitest with React Testing Library
- **Integration Tests**: API mocking with vi.fn()
- **Performance Tests**: Visual effects performance monitoring
- **Test Coverage**: Available via `npm run test:coverage`

## Common Development Tasks

### Adding a New Visual Effect
1. Update `AlbumArtFilters` interface in types
2. Add filter controls to `VisualEffectsMenu`
3. Apply CSS filter in `AlbumArt` component
4. Ensure localStorage persistence

### Modifying Playback Logic
1. Update both `spotifyPlayer.ts` and `localAudioPlayer.ts` if needed
2. Ensure `unifiedPlayer.ts` properly handles both sources
3. Update UI components listening to player events

### Working with Electron Features
1. Check `isElectron()` utility before using Electron APIs
2. Add IPC handlers in `electron/main.ts`
3. Expose APIs via `electron/preload.ts`
4. Type definitions in `src/types/electron.d.ts`

## Known Issues & Solutions

### Electron Mode Database Issues
- Ensure better-sqlite3 is properly built for your platform
- Run `npm run postinstall` after dependency changes

### Spotify Playback Not Working
- Verify Premium account status
- Check device transfer in `spotifyPlayer.ts`
- Ensure proper scopes in authentication

### Visual Effects Performance
- Monitor with React DevTools Profiler
- Check hardware acceleration in browser
- Verify CSS filter optimization

## Project-Specific Conventions

- **Icon Sizing**: All control icons use consistent 1.5rem sizing
- **Glass Morphism**: Backdrop blur with semi-transparent backgrounds
- **Accent Colors**: Dynamically extracted from album artwork
- **Error Handling**: Graceful fallbacks with user-friendly messages
- **Accessibility**: Full keyboard navigation and ARIA compliance

## Recent Major Features

### Local Music Library Support
- Full local file playback with metadata extraction
- SQLite database for library management
- Real-time file system monitoring
- Album art extraction and caching

### Enhanced Visual Effects
- GPU-accelerated glow animations
- Web Worker image processing
- Optimized filter performance
- Persistent user preferences

### Unified Player Interface
- Seamless switching between Spotify and local playback
- Consistent controls and UI regardless of source
- Unified event system for state management