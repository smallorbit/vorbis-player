# AGENTS.md - Vorbis Player Development Guide

## Build & Test Commands

```bash
npm run dev              # Start Vite dev server (port 3000)
npm run build           # Build: tsc -b && vite build
npm run lint            # Run ESLint on all files
npm run test            # Run Vitest in watch mode
npm run test:run        # Run tests once (single-file: npm run test:run src/path/to/file.test.ts)
npm run test:ui         # Run Vitest with UI dashboard
npm run test:coverage   # Generate coverage report
npm run preview         # Preview production build
```

## Codebase Structure

**Project**: React 18 + TypeScript + Vite Spotify music player with visual effects.

**Key Directories**:
- `src/components/` - React components (AudioPlayer, AlbumArt, PlaylistDrawer, etc.)
- `src/hooks/` - Custom hooks (usePlayerState, usePlaylistManager, useSpotifyPlayback, etc.)
- `src/services/` - API integration (spotify.ts, spotifyPlayer.ts)
- `src/utils/` - Utilities (colorExtractor, colorUtils, sizingUtils, performanceMonitor)
- `src/workers/` - Web Worker (imageProcessor.worker.ts for canvas processing)
- `src/types/` - TypeScript interfaces and types

**Tech Stack**: React 18, styled-components, Radix UI, Vitest, React Testing Library

## Code Style & Conventions

**Imports**: Use `@/*` path alias for src imports (configured in tsconfig.json). Order: React → libraries → services → utils → types.

**Naming**: PascalCase for components/types, camelCase for functions/variables/hooks. Prefix hooks with `use`.

**Components**: Functional components with React.memo for performance-critical components. Use styled-components for styling.

**State Management**: Centralized hooks (usePlayerState) with localStorage persistence. Avoid prop drilling; use context where needed.

**Types**: Strict TypeScript - no `any`. Define interfaces in src/types/ for reusable types. Export types from service files.

**Errors**: Use try-catch in async operations. Log errors to console with context. Graceful UI fallbacks for API failures.

**Testing**: Vitest + React Testing Library. Test files colocated or in `__tests__/`. Mock Spotify API in tests.

**Performance**: React.memo for expensive components. Lazy loading with React.lazy(). CSS filters for hardware acceleration.

**Command Notes**: `/commit` = stage and commit changes logically; `/doc` = update README.md; `/comdoc` = both in order.
