# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI assistants when working with code in this repository.

## Project Overview

**Vorbis Player** is a React/TypeScript music player with customizable visual effects and a pluggable provider architecture. Supports **Spotify** (streaming, Premium required) and **Dropbox** (personal files via HTML5 Audio), including cross-provider queues.

Key capabilities: multi-provider auth/catalog/playback adapters, unified liked songs, cross-provider playback handoff, Last.fm-powered radio queue generation, background visualizers, album art flip menu, bottom bar, swipe gestures (queue drawer / full-screen library), keyboard shortcuts, IndexedDB caching, responsive layout.

## Build Verification

Always verify the build compiles cleanly after removing dependencies, refactoring imports, or making multi-file changes:

```bash
npx tsc -b --noEmit       # TypeScript check
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
cp ../.env.local .env.local
```

Worktrees don't inherit `node_modules`. `.env.local` contains Spotify credentials needed for tests. Verify with `npm run test:run`.

## Development Commands

```bash
npm run dev            # Start dev server
npm run build          # Build for production
npm run lint           # Lint
npm run test           # Watch mode
npm run test:run       # Run once
npm run test:coverage  # Coverage
npm run deploy         # Deploy to production
npm run deploy:preview # Deploy preview
```

## Architecture

### Queue vs playlist (terminology)

- **Queue** — tracks scheduled to play next (reorder/remove in `QueueDrawer` / `QueueBottomSheet`; list UI in `QueueTrackList.tsx`).
- **Playlist** — a library **collection** from a provider (Spotify playlist, Dropbox folder-as-album, Liked Songs, etc.), browsed via `PlaylistSelection` and loaded through `usePlaylistManager` / catalog APIs.

### Source Layout

```
src/
├── components/      # React components (~33 files); key subdirs: BottomBar/, controls/, icons/, PlayerContent/, PlaylistSelection/, styled/, VisualEffectsMenu/, VisualizerDebugPanel/, visualizers/
├── constants/       # playlist.ts, zenAnimation.ts, storage.ts
├── providers/       # Multi-provider system; spotify/ and dropbox/ subdirs
├── hooks/           # 30 custom hooks
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
- **Drawers** use fixed positioning with slide animations and swipe-to-dismiss; vertical swipes on album art toggle the **queue** (up) drawer (`QueueDrawer` / `QueueBottomSheet`)
- **Full-screen library** — the library browser opens as `LibraryPage` (a full-screen view), not a drawer. `showLibrary` state in `usePlayerLogic` gates it; `handleOpenLibrary` / `handleCloseLibrary` toggle it. `LibraryPage` is rendered in `AudioPlayer.tsx` via `React.lazy` when `showLibrary` is true.
- **Opening the library**: swipe down on album art, BottomBar library button, or keyboard `↓` / `L`. Opening library closes the queue drawer.
- **Filter state** for the library persists to localStorage via `useLocalStorage`. Keys are prefixed `vorbis-player-library-*` (e.g., `vorbis-player-library-search`, `vorbis-player-library-provider-filters`, `vorbis-player-library-genres`). Opening the library from the QAP "Browse Library" button clears these keys before navigating.
- **Recently Played history** is tracked by `useRecentlyPlayedCollections` (`src/hooks/useRecentlyPlayedCollections.ts`). It exposes `history: RecentlyPlayedEntry[]` and `record(ref, name)`. Successful collection loads via `useCollectionLoader.loadCollection` call `record` automatically. History is stored under `vorbis-player-recently-played` (localStorage), capped at 5 entries, deduped by `CollectionRef` key, newest first. `FilterSidebar` renders a "Recently Played" section with up to 5 clickable shortcuts on desktop; the section is hidden when history is empty.
- **Mobile library overlay** renders `MobileLibraryBottomBar` (full-width search input + trailing sort dropdown) instead of the provider chip row. Mobile intentionally bypasses `providerFilters` — `ignoreProviderFilters = isMobile` in `useLibraryRoot.ts` ensures items from every enabled provider are always shown. Desktop behavior is unchanged: `FilterSidebar` provides provider chips, sort, genre, and recently-played controls.
- **Idle/home view** — when no track is loaded, `PlayerStateRenderer` shows the library browser (`LibraryPage`) by default. The Quick Access Panel (QAP) is opt-in: toggled via the "Quick Access Panel" On/Off control in the settings panel (gear icon, `VisualEffectsMenu`). The preference is stored under the `vorbis-player-qap-enabled` localStorage key (default `false`) via `useQapEnabled()`. `PlayerStateRenderer` initializes `showLibrary` to `!qapEnabled` and routes accordingly.
- **ResumeCard** — passed as the `footer` prop to `LibraryPage`, allowing users to resume a previous session regardless of whether QAP is enabled.
- **BackgroundVisualizer and AccentColorBackground** are `position: fixed` with low z-index, don't affect layout
- **Zen mode overlays** (`ZenClickZoneOverlay`, `ZenLikeOverlay`): hover-activated on desktop (pointer devices only), hidden when flip menu is open (`isFlipped`), with vertical dead zones (top/bottom 20% of album art ignored). Mobile zen uses touch gestures instead (`useZenTouchGestures`). BottomBar in zen mode shows via grip pill tap with tap-outside-to-dismiss backdrop.

### Multi-Provider Architecture

#### Provider Model

Defined in `src/types/providers.ts` and `src/types/domain.ts`.

**Provider interfaces**: `AuthProvider`, `CatalogProvider`, `PlaybackProvider`
**Registration**: `src/providers/registry.ts` — singleton `providerRegistry`; providers self-register on import
**Dropbox** only registers when `VITE_DROPBOX_CLIENT_ID` is set

**Domain types** (`src/types/domain.ts`):
- `MediaTrack` — provider-agnostic track with `playbackRef`
- `MediaCollection` — provider-agnostic collection (playlist or album)
- `CollectionRef` — `{ provider, kind, id }`; serialized via `collectionRefToKey` / `keyToCollectionRef`

**Capability-aware UI**: check `activeDescriptor.capabilities` before rendering provider-specific controls (`hasSaveTrack`, `hasExternalLink`, `hasLikedCollection`). Both Spotify and Dropbox support `hasSaveTrack` and `hasLikedCollection`.

**Unified playback across providers**:
- Queue items are represented as provider-agnostic `MediaTrack` records and can mix Spotify + Dropbox tracks in one queue.
- Provider model:
  - **Active provider** = selected provider context for browsing/catalog actions.
  - **Driving provider** = provider currently controlling audio output.
  - These can differ in mixed queues (Unified Liked Songs, radio, cross-provider handoff).
- Playback controls (`play`, `pause`, `next`, `previous`) route via the **driving provider**, not just the active provider.
- Provider state subscriptions are multiplexed and filtered by the **driving provider** so visualizer/play state stays in sync.
- Routing structure:
  - `useProviderPlayback` resolves provider per index (`track.provider` → `drivingProviderRef` → `activeDescriptor.id` fallback).
  - `usePlayerLogic` owns control actions and playback-state synchronization using `getDrivingProviderId()`.
  - `useAutoAdvance` advances based on events from the current driving provider.
- Unified liked songs can merge liked tracks from all connected providers and sort by `addedAt`.

**Radio generation**:
- Radio is a one-shot action (not a sticky toggle) that builds a playlist from the current track.
- `useRadio` + `radioService` generate suggestions from Last.fm, then match against the active provider catalog.
- Unmatched suggestions can be resolved via Spotify search (`spotifyResolver`) when authenticated.
- Provider switches during radio now follow the same driving-provider routing (no special queue handoff modal).
- **Track name context menu**: clicking the track name (in both normal and zen mode) opens a `TrackRadioPopover` with a single "Play {trackName} Radio" option. This mirrors the existing artist/album popover pattern (`TrackInfoPopover`). The option is disabled with a tooltip when Last.fm is not configured. Components: `TrackRadioPopover.tsx` (popover wrapper), `TrackInfo.tsx` (normal mode), `AlbumArtSection.tsx` (zen mode).

#### Provider Implementation Details

**Dropbox folder structure**:
```
Dropbox root/
└── <Artist>/<Album>/
    ├── cover.jpg     # also: album.jpg, folder.jpg, front.jpg
    └── 01 - Track.mp3
```
Folders containing audio files become albums; parent folder = artist. A synthetic "All Music" collection is always prepended.

**Dropbox Liked Songs**: Stored in IndexedDB (`vorbis-dropbox-art` database v3, `likes` store). Mutations dispatch `vorbis-dropbox-likes-changed` events for real-time UI updates. Settings menu exposes Export/Import (JSON) and Refresh Metadata operations.

**Dropbox preferences sync**: Pins (unified playlists/albums) and accent overrides/custom colors are synced to `/.vorbis/preferences.json`. Merge is last-write-wins by `updatedAt`. `dropboxPreferencesSync.ts` provides `initPreferencesSync(auth)`, `getPreferencesSync()`, `initialSync()`, and `schedulePush()` (2s debounce). PinnedItemsContext and ColorContext call `schedulePush()` after local changes; App and provider trigger `initialSync()` after Dropbox OAuth and when already authenticated.

**Token refresh**: Both providers preserve refresh tokens during transient failures and proactively refresh before expiry. Spotify uses a 5-minute buffer; Dropbox uses a 60-second buffer. On 401/400 errors Dropbox performs full logout; on 5xx or network errors it preserves the refresh token for retry.

**Spotify SDK loading**: The Spotify Web Playback SDK is loaded lazily by `SpotifyPlayerService.loadSDK()` — no global script tag in `index.html`. The SDK is only injected when the Spotify provider activates.

**Spotify API batching**: `checkTrackSaved` in `src/services/spotify/tracks.ts` uses microtask-based batching — concurrent calls within the same render cycle are collected and flushed as a single `/me/tracks/contains` request (up to 50 IDs per Spotify API limit), preventing 429 rate limiting.

### Playback Flow

User action to audio output follows this chain:

1. **User triggers play/next/previous** — `usePlayerLogic` dispatches via `handlePlay` / `handleNext` / `handlePrevious`
2. **Provider resolution** — `useProviderPlayback.playTrack(index)` resolves the provider for the track at that index: `track.provider` → `drivingProviderRef` → `activeDescriptor.id` fallback
3. **Cross-provider handoff** — `pausePreviousProvider()` pauses the old provider if the driving provider changed, then updates `currentPlaybackProviderRef`
4. **Adapter playback** — calls `descriptor.playback.playTrack(mediaTrack)` on the resolved `PlaybackProvider` (Spotify SDK or HTML5 Audio)
5. **Next-track pre-warm** — after successful play, `prepareTrack()` is called on the next track's provider
6. **State subscription** — `usePlaybackSubscription` subscribes to all registered providers, filters events by driving provider, and syncs `isPlaying`, `playbackPosition`, and `currentTrackIndex` back to React state. Uses `expectedTrackIdRef` to ignore stale provider index updates during transitions. Also listens for `visibilitychange` events — when the tab returns to foreground, it clears `expectedTrackIdRef` (stale transition guards) and calls `getState()` on the driving provider to resync track info, album art, and playback position.
7. **Auto-advance** — `useAutoAdvance` subscribes to all providers and detects track end via two signals: `timeRemaining <= endThreshold` (near-end) or `wasPlaying && isPaused && position === 0` (natural end). A 5-second cooldown (`PLAY_COOLDOWN_MS`) prevents false triggers during buffering
8. **Error recovery** — `UnavailableTrackError` and generic errors trigger auto-skip to the next track when `skipOnError` is true. `AuthExpiredError` surfaces a re-auth prompt

Key files: `usePlayerLogic.ts` → `useProviderPlayback.ts` → `PlaybackProvider` (interface in `types/providers.ts`) → `usePlaybackSubscription.ts` → `useAutoAdvance.ts`

### Queue Mutation Flow

Queue state lives in `TrackContext` (`tracks`, `originalTracks`, `currentTrackIndex`, `shuffleEnabled`) and is mutated through `TrackOperations` (defined in `types/trackOperations.ts`). A parallel `mediaTracksRef` keeps an imperative mirror for index-based playback without waiting for React renders.

**Loading a collection** (`useCollectionLoader.loadCollection`):
- Resolves the target provider and collection ref
- Fetches tracks via `catalog.listTracks(collectionRef)`
- Calls `applyTracks()` which stores `originalTracks`, optionally shuffles, sets `tracks` + `mediaTracksRef`, resets `currentTrackIndex` to 0, then calls `playTrack(0)`
- Unified Liked Songs path merges tracks from all connected providers sorted by `addedAt`

**Adding to queue** (`useQueueManagement.handleAddToQueue`):
- If queue is empty, delegates to `loadCollection` (full load + autoplay)
- Otherwise fetches tracks via `catalog.listTracks` and appends to `tracks`, `originalTracks`, and `mediaTracksRef` without resetting `currentTrackIndex`
- Deduplicates by track ID before appending — tracks already in the queue are skipped

**Removing from queue** (`handleRemoveFromQueue`):
- Blocks removal of the currently playing track (`index === currentTrackIndex`)
- Removes by index from `tracks`, by ID from `originalTracks` and `mediaTracksRef`
- Decrements `currentTrackIndex` if the removed track was before the current one
- If only one track remains, calls `handleBackToLibrary` (full reset)

**Reordering** (`handleReorderQueue`):
- Uses `moveItemInArray` on `tracks`, then syncs `mediaTracksRef` via `reorderMediaTracksToMatchTracks`
- Recalculates `currentTrackIndex` by finding the playing track's ID in the new order
- Only updates `originalTracks` when shuffle is off

**Shuffle interaction** (`TrackContext.handleShuffleToggle`):
- Enable: shuffles `originalTracks` (excluding current track), places current track first, resets index to 0
- Disable: restores `originalTracks`, finds current track's original index
- Persisted via `useLocalStorage`

**Queue change notification**: `usePlayerLogic` calls `descriptor.playback.onQueueChanged?(tracks, currentTrackIndex)` whenever `tracks` or `currentTrackIndex` change, allowing providers with native queue sync (Spotify) to stay aligned.

### Background Visualizers

Four animated background styles, selectable via the flip menu's Speed/Style controls. All share a `speed` prop (multiplier from `VisualEffectsContext`) and per-visualizer tuning in `src/constants/visualizerDebugConfig.ts`.

| Style key | Component | Description |
|-----------|-----------|-------------|
| `fireflies` | `ParticleVisualizer` | Drifting particles with pulsing opacity |
| `comet` | `TrailVisualizer` | Ships leaving fading particle trails |
| `wave` | `WaveVisualizer` | Layered sine waves spread vertically |
| `grid` | `GridWaveVisualizer` | Dot grid distorted by traveling waves |

Type: `VisualizerStyle` in `src/types/visualizer.d.ts`. Components in `src/components/visualizers/`.

### Debug logging (optional)

Debug logging uses the [`debug`](https://www.npmjs.com/package/debug) package via `src/lib/debugLog.ts` with namespace `vorbis:*`. See `docs/troubleshooting.md` for usage.

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
| `↑` / `Q` | Toggle queue | Volume up (↑ only) |
| `↓` / `L` | Toggle library | Volume down (↓ only) |
| `V` / `G` / `S` / `T` | Visualizer / Glow / Shuffle / Translucence | same |
| `Z` | Toggle zen mode | same |
| `O` / `K` / `M` | Effects menu / Like / Mute | same |
| `?` / `/` | Keyboard help | same |
| `Escape` | Close all menus | same |

`Q` and `L` are device-independent alternatives for drawer toggles. `↑`/`↓` have cross-dismiss behavior.

## Tech Stack

See README.md for the full tech stack.

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

Optional (enables radio recommendations):
```
VITE_LASTFM_API_KEY="your_lastfm_api_key"
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

For provider-specific issues (Spotify, Dropbox, Radio), see `docs/troubleshooting.md`.

## Testing Guidelines

Run with `npm run test:run`. Tests are colocated with source files in `__tests__/` subdirectories.

- Verify actual behavior, not mock implementations
- Every test should have meaningful assertions

### Test Utilities (`src/test/`)

| File | Purpose |
|------|---------|
| `setup.ts` | Global test setup: mocks `localStorage`, `sessionStorage`, `window.location`, `history`, `fetch`, `crypto` (for PKCE), `btoa`/`atob`; imports `fake-indexeddb/auto` and `@testing-library/jest-dom`; clears all mocks in `afterEach` |
| `fixtures.ts` | Factory functions for domain objects: `makeTrack()`, `makeMediaTrack()`, `makePlaylistInfo()`, `makeAlbumInfo()`, `makeProviderDescriptor()` — all accept partial overrides |
| `testWrappers.tsx` | `TestWrapper` component that nests all app context providers (`ProviderProvider`, `PlayerSizingProvider`, `TrackProvider`, `ColorProvider`, `VisualEffectsProvider`, `PinnedItemsProvider`) for component/hook tests |
| `providerTestUtils.tsx` | `ProviderWrapper` — lighter wrapper with only `ProviderProvider`, for hooks that only need provider context |

### BDD Comment Convention

Tests use `// #given`, `// #when`, `// #then` comments to mark the Arrange-Act-Assert phases:

```ts
it('loads volume from localStorage on init', () => {
  // #given
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => {
    if (key === 'vorbis-player-volume') return '75';
    return null;
  });

  // #when
  const { result } = renderHook(() => useVolume(), { wrapper: ProviderWrapper });

  // #then
  expect(result.current.volume).toBe(75);
});
```

Use this pattern in all new tests. The `#given` section is optional when there is no setup beyond what `beforeEach` provides.

## Command Instructions

- `/commit` — Commit current changes, split into logical commits
- `/doc` — Update README.md
- `/comdoc` — Update README.md then commit

**Documentation updates**: Update this file when adding new architectural patterns or conventions.

**Git workflow**: Feature branches from main (`feature/name`, `fix/name`). Atomic commits with conventional format. Reference issue numbers.

## AI Workflow Rules

For structured feature development, see `.claude/rules/`:
- `generate_prd.md` — PRD creation process: asks clarifying questions, then generates a structured requirements doc
- `generate_tasks_from_prd.md` — breaks a PRD into a detailed parent/subtask list; waits for "Go" confirmation before generating subtasks
- `process_tasks.md` — task execution protocol: one subtask at a time, with test + commit gates before marking parent complete
