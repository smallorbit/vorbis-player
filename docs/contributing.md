# Contributing

Guide for developers who want to contribute to Vorbis Player.

## Development Setup

1. Clone the repo and install dependencies:

   ```bash
   git clone git@github.com:smallorbit/vorbis-player.git
   cd vorbis-player
   npm install
   ```

2. Copy the environment file and add your credentials (see [Getting Started](./getting-started.md)):

   ```bash
   cp .env.example .env.local
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

## Available Scripts

```bash
npm run dev            # Start development server (127.0.0.1:3000)
npm run build          # Build for production (tsc -b && vite build)
npm run lint           # Run ESLint
npm run preview        # Preview production build
npm run test           # Run tests in watch mode
npm run test:run       # Run tests once
npm run test:ui        # Run tests with UI
npm run test:coverage  # Run tests with coverage
npm run deploy         # Deploy to production (Vercel)
npm run deploy:preview # Deploy preview (Vercel)
```

## Project Structure

```
src/
├── components/              # React components (~42 files)
│   ├── AudioPlayer.tsx      # Main orchestrator with centralized state
│   ├── PlayerContent.tsx    # Main player layout (centering, responsive sizing)
│   ├── PlayerStateRenderer.tsx  # Loading/error and library collection selection states
│   ├── AlbumArt.tsx         # Album artwork with filters & glow effects
│   ├── PlaylistSelection.tsx    # Playlist/album browser with search/sort/filter/pin
│   ├── SpotifyPlayerControls.tsx # Player control interface
│   ├── LibraryDrawer.tsx    # Full-screen library browser drawer
│   ├── QueueDrawer.tsx      # Queue (up-next) side drawer (desktop/tablet)
│   ├── QueueBottomSheet.tsx # Queue bottom sheet (mobile)
│   ├── QueueTrackList.tsx   # Queue track list (reorder/remove); lazy-loaded by queue surfaces
│   ├── ColorPickerPopover.tsx   # Per-album color picker
│   ├── AlbumArtBackside.tsx     # Flip menu back face
│   ├── BottomBar/               # Bottom bar components
│   ├── controls/            # Player control sub-components
│   ├── styled/              # Reusable styled-components library
│   ├── icons/               # SVG icon components
│   ├── visualizers/         # Background visualizer components
│   └── VisualEffectsMenu/   # Visual effects configuration panel
├── constants/               # Shared constants (playlist IDs, prefixes)
├── hooks/                   # 22 custom React hooks
├── providers/               # Multi-provider system
│   ├── registry.ts          # Singleton ProviderRegistry
│   ├── spotify/             # Spotify auth, catalog, playback adapters
│   └── dropbox/             # Dropbox auth, catalog, playback adapters + art/catalog cache
├── services/                # Spotify API, Playback SDK, IndexedDB cache
├── utils/                   # Utility functions (color, sizing, filters)
├── styles/                  # Theme, global styles, CSS animations
├── types/                   # TypeScript definitions (domain.ts, providers.ts)
├── workers/                 # Web Workers (image processing)
└── lib/                     # Helper functions
```

## Tech Stack

- **Frontend**: React 18 + TypeScript 5 + Vite 6
- **Styling**: styled-components 6 with theme system + Radix UI primitives
- **Audio**: Spotify Web Playback SDK (lazy-loaded) + Web API; HTML5 Audio for Dropbox
- **Authentication**: PKCE OAuth 2.0 (Spotify and Dropbox)
- **Testing**: Vitest + React Testing Library + jsdom
- **Performance**: Web Workers, LRU caching, IndexedDB persistence, lazy loading, container queries
- **Build**: ES2020 target, esbuild, manual chunks (vendor/radix/styled)

## Coding Conventions

- Functional components with hooks; `React.memo` for optimization
- One component per file, named exports; keep files under 500 lines
- styled-components with `src/styles/theme.ts`; hardware-accelerated animations
- Container queries as primary responsive strategy, media queries as fallback
- `useLocalStorage` hook for persistence with `'vorbis-player-'` key prefix
- Strict TypeScript; `import type` when possible; types in `src/types/`
- Path alias: `@/` maps to `./src/`

## Testing

Tests are colocated with source files in `__tests__/` subdirectories.

```bash
npm run test:run       # Run once
npm run test           # Watch mode
npm run test:coverage  # With coverage report
```

Guidelines:

- Verify actual behavior, not mock implementations
- Every test should have meaningful assertions
- Run `npm test` before pushing and before creating any PR

## Git Workflow

- Feature branches from main: `feature/name`, `fix/name`
- Atomic commits with conventional format (`feat:`, `fix:`, `refactor:`, etc.)
- Reference issue numbers in commit messages
- Run `npm run test:run` and `npm run build` before pushing

## Architecture Overview

For a deeper understanding of the codebase architecture (layout system, multi-provider system, responsive sizing, etc.), see `CLAUDE.md` in the project root.
