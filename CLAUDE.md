# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI assistants when working with code in this repository.

## Project Overview

**Vorbis Player** is a React/TypeScript music player with customizable visual effects and a pluggable provider architecture. Supports **Spotify** (streaming, Premium required) and **Dropbox** (personal files via HTML5 Audio).

Key capabilities: multi-provider auth/catalog/playback adapters, background visualizers, album art flip menu, bottom bar, swipe gestures (drawer toggles), keyboard shortcuts, IndexedDB caching, responsive layout.

## Build Verification

Always verify the build compiles cleanly after removing dependencies, refactoring imports, or making multi-file changes:

```bash
npx tsc --noEmit       # TypeScript check
npm run build          # Full build
```

Check for dangling references in `vite.config.ts`, `tsconfig.json`, etc.

## UI & CSS Guidelines

When modifying CSS layout or styling, avoid making additional 'clever' adjustments beyond what was requested. If the user asks to constrain width or center an element, do exactly that — don't add spacers, override calculated dimensions, or restructure containers unless explicitly asked.

Make the minimal change first, confirm it works visually, then iterate. Do not combine multiple layout changes into a single large edit.

## Git & PR Workflow

Run `npm test` before `git push` and before creating any PR.

## Worktree Setup

When creating or working in a git worktree:

```bash
npm install
cp ../.env .env.local
```

Worktrees don't inherit `node_modules`. `.env.local` contains Spotify credentials needed for tests. Verify with `npm run test:run`.

## Development Commands

```bash
npm run dev            # Start dev server
tsc -b && vite build   # Build for production
npm run lint           # Lint
npm run test           # Watch mode
npm run test:run       # Run once
npm run test:coverage  # Coverage
npm run deploy         # Deploy to production
npm run deploy:preview # Deploy preview
```

## Architecture

### Source Layout

```
src/
├── components/      # React components (~42 files); controls/, styled/, visualizers/ subdirs
├── constants/       # playlist.ts — ALBUM_ID_PREFIX, LIKED_SONGS_ID, helpers
├── providers/       # Multi-provider system; spotify/ and dropbox/ subdirs
├── hooks/           # 22 custom hooks
├── services/        # spotify.ts (auth + API), spotifyPlayer.ts (lazy SDK loading + playback), cache/ (IndexedDB)
├── utils/           # colorExtractor, colorUtils, sizingUtils, playlistFilters, etc.
├── workers/         # imageProcessor.worker.ts
├── types/           # domain.ts, providers.ts, filters.ts
├── styles/          # theme.ts, ThemeProvider, CSS modules, global styles
└── lib/utils.ts
```

### Layout Architecture (Critical)

The centering system is a flex chain:

```
AppContainer (flexCenter, min-height: 100dvh)
  → AudioPlayer (flexCenter, min-height: 100dvh)
    → ContentWrapper (position: relative, z-index: 2, overflow: visible)
      → PlayerContainer (flex column, centered)
```

- **`ContentWrapper` must use `position: relative`** — not absolute — so parent flex containers can center it
- **`overflow: visible` is required on ContentWrapper** — `container-type: inline-size` creates containment that clips absolutely-positioned children
- **`100dvh`** throughout to handle iOS address bar changes
- **BottomBar** renders via `createPortal()` to `document.body`, fixed at bottom
- **Drawers** use fixed positioning with slide animations and swipe-to-dismiss; vertical swipes on album art toggle playlist (up) and library (down) drawers
- **BackgroundVisualizer and AccentColorBackground** are `position: fixed` with low z-index, don't affect layout

### Multi-Provider Architecture

Defined in `src/types/providers.ts` and `src/types/domain.ts`.

**Provider interfaces**: `AuthProvider`, `CatalogProvider`, `PlaybackProvider`
**Registration**: `src/providers/registry.ts` — singleton `providerRegistry`; providers self-register on import
**Dropbox** only registers when `VITE_DROPBOX_CLIENT_ID` is set

**Domain types** (`src/types/domain.ts`):
- `MediaTrack` — provider-agnostic track with `playbackRef`
- `MediaCollection` — provider-agnostic collection (playlist or album)
- `CollectionRef` — `{ provider, kind, id }`; serialized via `collectionRefToKey` / `keyToCollectionRef`

**Capability-aware UI**: check `activeDescriptor.capabilities` before rendering provider-specific controls (`hasSaveTrack`, `hasExternalLink`, `hasLikedCollection`). Both Spotify and Dropbox support `hasSaveTrack` and `hasLikedCollection`.

**Dropbox folder structure**:
```
Dropbox root/
└── <Artist>/<Album>/
    ├── cover.jpg     # also: album.jpg, folder.jpg, front.jpg
    └── 01 - Track.mp3
```
Folders containing audio files become albums; parent folder = artist. A synthetic "All Music" collection is always prepended.

**Dropbox Liked Songs**: Stored in IndexedDB (`vorbis-dropbox-art` database v3, `likes` store). Mutations dispatch `vorbis-dropbox-likes-changed` events for real-time UI updates. Settings menu exposes Export/Import (JSON) and Refresh Metadata operations.

**Token refresh**: Both providers preserve refresh tokens during transient failures and proactively refresh before expiry. Spotify uses a 5-minute buffer; Dropbox uses a 60-second buffer. On 401/400 errors Dropbox performs full logout; on 5xx or network errors it preserves the refresh token for retry.

**Spotify SDK loading**: The Spotify Web Playback SDK is loaded lazily by `SpotifyPlayerService.loadSDK()` — no global script tag in `index.html`. The SDK is only injected when the Spotify provider activates.

### Responsive Sizing

Breakpoints and exact values are in `src/styles/theme.ts`. Sizing calculations are in `src/utils/sizingUtils.ts` and `src/hooks/usePlayerSizing.ts`.

- Mobile: < 700px, Tablet: 700–1024px, Desktop: ≥ 1024px
- Uses `usePlayerSizing` hook for viewport-aware dimensions

### Keyboard Shortcuts

Centralized in `useKeyboardShortcuts.ts`. Uses `pointer: fine` / `hover: hover` media queries (not viewport width) to detect device type.

| Key | Desktop | Touch-only |
|-----|---------|------------|
| `Space` | Play/Pause | Play/Pause |
| `←` / `→` | Prev/Next track | Prev/Next track |
| `↑` / `P` | Toggle playlist | Volume up (↑ only) |
| `↓` / `L` | Toggle library | Volume down (↓ only) |
| `V` / `G` / `S` / `T` | Visualizer / Glow / Shuffle / Translucence | same |
| `O` / `K` / `M` | Effects menu / Like / Mute | same |
| `?` / `/` | Keyboard help | same |
| `Escape` | Close all menus | same |

`P` and `L` are device-independent alternatives for drawer toggles. `↑`/`↓` have cross-dismiss behavior.

## Tech Stack

React 18, TypeScript 5, Vite 6, styled-components 6, Radix UI, react-window
Testing: Vitest, @testing-library/react, jsdom
Build: ES2020, esbuild, manual chunks (vendor/radix/styled)

## Environment Configuration

Required in `.env.local`:
```
VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
```

Optional (enables Dropbox):
```
VITE_DROPBOX_CLIENT_ID="your_dropbox_app_key"
```

Vite dev server: host `127.0.0.1`, port `3000` (required for Spotify OAuth).
Path alias: `@/` → `./src/` (e.g. `import { x } from '@/hooks/usePlayerState'`).

## Coding Conventions

- Functional components with hooks; `React.memo` for optimization
- One component per file, named exports; keep files under 500 lines
- styled-components with `src/styles/theme.ts`; hardware-accelerated animations
- Container queries as primary responsive strategy, media queries as fallback
- `useLocalStorage` hook for persistence with `'vorbis-player-'` key prefix
- Strict TypeScript; `import type` when possible; types in `src/types/`

## Common Issues & Solutions

**Layout:**
- Player not centered → `ContentWrapper` must use `position: relative`
- Elements clipped → ensure `overflow: visible` on `ContentWrapper`
- Mobile viewport bouncing → use `100dvh` not `100vh`

**Spotify:**
- Auth issues → use `127.0.0.1` not `localhost`
- Track skipping → auto-skip handles 403 Restriction Violated errors
- Expired tokens → refresh token is preserved; `isAuthenticated()` returns true if refresh token exists

**Dropbox:**
- Provider not visible → `VITE_DROPBOX_CLIENT_ID` must be set; restart dev server
- No collections → audio files must be in subfolders (root-level files are skipped)
- Stale catalog → 1-hour IndexedDB TTL; clear site data to force refresh
- Art missing → place `cover.jpg` (or `folder.jpg`, `album.jpg`, `front.jpg`) alongside audio files
- Liked songs missing → check IndexedDB `likes` store; use Settings → Refresh Metadata to re-sync
- Auth loop → on 401/400 Dropbox performs full logout; on 5xx/network errors refresh token is preserved for retry

**Visual Effects:**
- Album art filters not working → always pass `albumFilters={albumFilters}` to `AlbumArt`

## Testing Guidelines

Run with `npm run test:run`. Tests are colocated with source files in `__tests__/` subdirectories.

- Verify actual behavior, not mock implementations
- Every test should have meaningful assertions

## Command Instructions

- `/commit` — Commit current changes, split into logical commits
- `/doc` — Update README.md
- `/comdoc` — Update README.md then commit

**Documentation updates**: Update this file when adding new architectural patterns or conventions.

**Git workflow**: Feature branches from main (`feature/name`, `fix/name`). Atomic commits with conventional format. Reference issue numbers.

## AI Workflow Rules

For structured feature development, see `.claude/rules/`:
- `generate_prd.md` — PRD creation
- `generate_tasks_from_prd.md` — Task breakdown
- `process_tasks.md` — Task execution with commits
