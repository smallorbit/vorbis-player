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
├── components/      # React components (~34 files); key subdirs: BottomBar/, controls/, DevBug/, icons/, LibraryDrawer/, PlayerContent/, PlaylistSelection/, QuickAccessPanel/, styled/, VisualEffectsMenu/, VisualizerDebugPanel/, visualizers/
├── constants/       # playlist.ts, zenAnimation.ts, storage.ts
├── providers/       # Multi-provider system; spotify/ and dropbox/ subdirs
├── hooks/           # 31 custom hooks
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
- **Queue Suspense fallback** — the queue drawers (`QueueDrawer`, `QueueBottomSheet`) render `QueueSkeleton` (`src/components/QueueSkeleton.tsx`) as their Suspense fallback — a row-shaped placeholder with a transform-based shimmer that respects `prefers-reduced-motion`. The lazy bundles are prefetched on first playback via `useQueueBundlePrefetch` (`src/hooks/useQueueBundlePrefetch.ts`), scheduled inside `requestIdleCallback` (with `setTimeout` fallback) once per session.
- **Full-screen library** — the library browser opens as `LibraryPage` (a full-screen view), not a drawer. `showLibrary` state in `usePlayerLogic` gates it; `handleOpenLibrary` / `handleCloseLibrary` toggle it. `LibraryPage` is rendered in `AudioPlayer.tsx` via `React.lazy` when `showLibrary` is true.
- **Opening the library**: swipe down on album art, BottomBar library button, or keyboard `↓` / `L`. Opening library closes the queue drawer.
- **Filter state** for the library persists to localStorage via `useLocalStorage`. Keys are prefixed `vorbis-player-library-*` (e.g., `vorbis-player-library-search`, `vorbis-player-library-provider-filters`, `vorbis-player-library-genres`). Opening the library from the QAP "Browse Library" button clears these keys before navigating.
- **Recently Played history** is tracked by `useRecentlyPlayedCollections` (`src/hooks/useRecentlyPlayedCollections.ts`). It exposes `history: RecentlyPlayedEntry[]` and `record(ref, name)`. Successful collection loads via `useCollectionLoader.loadCollection` call `record` automatically. History is stored under `vorbis-player-recently-played` (localStorage), capped at 5 entries, deduped by `CollectionRef` key, newest first. `FilterSidebar` renders a "Recently Played" section with up to 5 clickable shortcuts on desktop; the section is hidden when history is empty.
- **Mobile library overlay** renders `MobileLibraryBottomBar` (full-width search input + trailing sort dropdown) instead of the provider chip row. Mobile intentionally bypasses `providerFilters` — `ignoreProviderFilters = isMobile` in `useLibraryRoot.ts` ensures items from every enabled provider are always shown. Desktop behavior is unchanged: `FilterSidebar` provides provider chips, sort, genre, and recently-played controls.
- **Idle/home routing** — when no track is loaded, `PlayerStateRenderer` (`src/components/PlayerStateRenderer.tsx`) picks a landing view via `resolveIdleRoute(welcomeSeen, qapEnabled, hasValidSession)`:

  | Condition | Landing view |
  |---|---|
  | `welcomeSeen === false` | `WelcomeScreen` (supersedes all other inputs) |
  | valid `lastSession` + `qapEnabled` | `QuickAccessPanel` (with Resume hero) |
  | valid `lastSession` + `!qapEnabled` | player hydrated via `handleHydrate` (paused) |
  | no/stale session + `qapEnabled` | `QuickAccessPanel` |
  | no/stale session + `!qapEnabled` | `LibraryPage` |

  QAP is opt-in via the "Quick Access Panel" On/Off control in `VisualEffectsMenu`; preference persists under `vorbis-player-qap-enabled` (default `false`) via `useQapEnabled()`. Clicking "Browse Library" from QAP or Welcome flips a local `libraryOverride` flag — once engaged, the idle view stays on `LibraryPage` for the rest of the session (one-way door).
- **Welcome screen** — `WelcomeScreen` (`src/components/WelcomeScreen/index.tsx`) shows once for new users with a per-provider status summary and context-aware primary CTA (*Connect a provider* when `connectedProviderIds.length === 0`, *Browse your library* otherwise). The dismiss-for-good flag persists via `useWelcomeSeen` (`src/hooks/useWelcomeSeen.ts`) under the `vorbis-player-welcome-seen` localStorage key (default `false`).
- **Stale session cutoff** — `isSessionStale(session, now?)` from `src/services/sessionPersistence.ts` returns true when the session is absent, missing `savedAt`, or older than `STALE_SESSION_MS` (30 days). Stale sessions are treated as no session for landing routing and resume affordances.
- **Hydrate without autoplay** — `handleHydrate(session): Promise<HydrateResult>` in `usePlayerLogic` (`src/hooks/usePlayerLogic.ts`) restores `tracks` / `originalTracks` / `mediaTracksRef` / `currentTrackIndex` / `selectedPlaylistId`, sets the seek bar to `savedPositionMs`, and calls `prepareTrack(track, { positionMs })` on the driving provider — but does NOT call `play()`. A `hydratedPendingPlayRef = { index, positionMs }` records the target so the next user-initiated `handlePlay` starts from the saved offset. Any call into `playTrack` (next/previous/new collection) clears the ref.
  - `HydrateResult` shape: `{ track: MediaTrack | null, skipped: boolean, totalFailure: boolean }`.
  - **prepareTrack is emit-only** — both adapters emit a `PlaybackState` event with `positionMs` + `durationMs` so the seek bar reflects the saved position before any user action. No audio actually starts.
    - Spotify (`stageTrackPaused`): calls `ensurePlaybackReady` which transfers Spotify Connect to this device with `play: false`. Does NOT call `/me/player/play` — that API starts audio and Spotify's eventual consistency makes a subsequent `pause()` race against the just-started playback, leaking audio on fresh tabs.
    - Dropbox: sets `audio.src` to the stream URL and seeks to `positionMs`. Does NOT call `audio.play()`.
  - **probePlayable iterator** — before calling `prepareTrack`, `handleHydrate` optionally calls `descriptor.playback.probePlayable(track): Promise<boolean>` (defined on `PlaybackProvider` in `src/types/providers.ts`). Returns `false` for known-unplayable tracks (Spotify market-restricted / 404, Dropbox file moved); throws `AuthExpiredError` for transient auth failures. If `probePlayable` returns false or throws, the iterator skips to the next track in the queue. The iterator is bounded by `queueTracks.length` to prevent infinite loops.
  - **Partial-skip toast** — when `skipped === true` (saved track was unplayable, a later track was used): `"Couldn't resume previous track — starting from next in queue."`.
  - **Total-failure path** — when no track in the queue could be prepared: `handleHydrate` calls `handleBackToLibrary` and returns `totalFailure: true`. `AudioPlayer.handleHydrateFailed` then calls `useSessionPersistence.resetLastSession()` (clears both localStorage AND the cached React `lastSession` state) and surfaces `"Couldn't resume your last session."`. `PlayerStateRenderer` on `totalFailure` flips `libraryOverride = true` so the user routes to the library immediately.
  - **Resume toast** — `ResumeToast` surfaces on normal hydrate with `"Resuming '<Track>' — press play to continue."`. Auto-dismisses on next/previous/open-library/open-queue.
  - `PlayerStateRenderer` routes to the hydrate loading card; on mount fires `onHydrate(session)` exactly once via `hydrateFiredRef`.
  - Distinct from `handleResume` (in `AudioPlayer.tsx`), which autoplays from the saved position.
- **Resume hero** — `ResumeHero` (`src/components/QuickAccessPanel/ResumeHero.tsx`) renders at the top of `QuickAccessPanel` (above `PinRing`) when a valid `lastSession` is present; clicking the Resume CTA invokes `onResume` (autoplay). The footer `ResumeCard` is suppressed inside QAP to avoid duplicate affordances; it still renders as the `footer` prop of `LibraryPage` on the idle library route.
- **Settings gear on idle views** — `SettingsGearButton` (`src/components/SettingsGearButton/index.tsx`) is mounted top-right by `PlayerStateRenderer` on `WelcomeScreen`, idle `LibraryPage`, and `QuickAccessPanel` via the `onOpenSettings` prop, opening the existing `VisualEffectsMenu`. Hidden during loading and error states. The active-player gear continues to live in `BottomBar` / `PlayerControlsSection`.
- **BackgroundVisualizer and AccentColorBackground** are `position: fixed` with low z-index, don't affect layout
- **Zen mode overlays** (`ZenClickZoneOverlay`, `ZenLikeOverlay`): hover-activated on desktop (pointer devices only), hidden when flip menu is open (`isFlipped`), with vertical dead zones (top/bottom 20% of album art ignored). Mobile zen uses touch gestures instead (`useZenTouchGestures`). BottomBar in zen mode shows via grip pill tap with tap-outside-to-dismiss backdrop.
- **Zen mode entry/exit orchestration** — timing constants live in `src/constants/zenAnimation.ts`; CSS transitions in `PlayerContent/styled.ts` (`ContentWrapper`, `PlayerStack`, `ZenControlsWrapper`) and `BottomBar/styled.ts`. Entry and exit sequences are asymmetric on purpose:
  - **Entry** (normal → zen): controls fade in place over `ZEN_CONTROLS_DURATION`; after `ZEN_ART_ENTER_DELAY` the art grows (`PlayerStack.max-width`) in parallel with the controls row collapsing (`grid-template-rows 1fr → 0fr`) over `ZEN_ART_DURATION`.
  - **Exit** (zen → normal): art shrink, `ContentWrapper.margin-bottom` growth, `CardContent.transform` shift, and controls row expansion (`grid-template-rows 0fr → 1fr`) all animate in parallel over `ZEN_ART_DURATION`. Opacity/transform on the controls and the `BottomBar` slide-up are delayed by `ZEN_EXIT_REENTRY_DELAY` (= `ZEN_ART_DURATION`) so they appear after the art has settled.
  - **`--player-controls-height` freeze during transitions** — `PlayerContent` holds a `zenTransitioningRef` that gates the `ResizeObserver` on the controls element. Without this, the row expanding `0 → 220px` on exit would push the CSS variable through every intermediate frame, moving `PlayerStack.max-width`'s target mid-transition and causing the art to chase it. The ref is raised in `handleZenModeToggle`, cleared via `setTimeout` after `ZEN_ART_DURATION + ZEN_ART_ENTER_DELAY + 50ms`.
  - `prefers-reduced-motion: reduce` short-circuits transitions on `PlayerStack`, `ZenControlsWrapper`, and `BottomBarContainer`. Per-element transition rationale is inlined in `PlayerContent/styled.ts` and `BottomBar/styled.ts`.

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

**Provider toggle (Music Sources section in settings)**:
- Each provider row has a single on/off toggle — there is no separate Reconnect button.
- `enabledProviderIds` — localStorage-persisted set of providers the user has opted into.
- `connectedProviderIds` — derived set: `enabledProviderIds` ∩ authenticated providers. Used by cross-provider features (Unified Liked Songs, radio resolver).
- Toggle-OFF: opens `ProviderDisconnectDialog` showing the provider name and count of queued tracks that will be removed. Confirming calls `logout()`, removes the provider from `enabledProviderIds`, and cleans up queue/playback state. The last enabled provider's toggle is disabled to prevent a zero-provider state.
- Toggle-ON when already authenticated: silently adds to `enabledProviderIds`.
- Toggle-ON when not authenticated: calls `beginLogin({ popup: true })` immediately. The provider is added to `enabledProviderIds` only after the OAuth popup reports success via `AUTH_COMPLETE_EVENT`.
- OAuth cancel/failure: toggle reverts; a toast shows `"Couldn't connect to {provider}. Try again."`.
- Mid-session unrecoverable 401: `logout()` is called automatically; a toast shows `"{Provider} disconnected — session expired."`.
- Implementation: `src/components/VisualEffectsMenu/SourcesSections.tsx` (`MusicSourcesSection`).

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
- Unified liked songs can merge liked tracks from all connected providers (`connectedProviderIds`) and sort by `addedAt`.

**Radio generation**:
- Radio is a one-shot action (not a sticky toggle) that builds a playlist from the current track.
- `useRadio` + `radioService` generate suggestions from Last.fm, then match against the active provider catalog.
- Unmatched suggestions can be resolved via Spotify search (`spotifyResolver`) when authenticated and Spotify is in `connectedProviderIds`.
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
Folders containing audio files become albums; parent folder = artist. A synthetic "All Music" collection (kind `'folder'`, id `''`) is always prepended.

**Dropbox "All Music" card**: `useLibrarySync.splitCollections` intercepts the All Music collection and exposes its track total as `allMusicCount` instead of pushing it into the album list. `AllMusicCard` (`src/components/PlaylistSelection/AllMusicCard.tsx`) renders the row in the **playlist grid** at the top anchor slot, alongside `LikedSongsCard`. The card uses a Dropbox-tinted gradient and a crossed-arrows shuffle SVG glyph in both grid and list layouts; subtitle is `"{N} tracks • Shuffled"`. Hidden when Dropbox is not in `enabledProviderIds` or excluded by the provider filter chip. Pin/unpin uses `ALL_MUSIC_PIN_ID = 'dropbox-all-music'` (a stable identifier distinct from the underlying collection id `''`) and persists through `PinnedItemsContext` like any other pin. The legacy `id === ''` entries in `LIBRARY_PLAYLIST_SORT_ANCHOR_IDS` and `LIBRARY_ALBUM_SORT_ANCHOR_IDS` are retired — All Music is no longer mixed into the sortable lists, so it does not need a sort-anchor exemption.

**All Music shuffle-by-default**: Loading or appending the All Music aggregate always shuffles, independently of the global `shuffleEnabled` toggle. Detection uses `isAllMusicRef(collectionRef)` from `src/constants/playlist.ts`. `useCollectionLoader.applyTracks` accepts a `forceShuffle` option that ORs with `shuffleEnabled`; `loadCollection` passes `{ forceShuffle: isAllMusicRef(ref) }`. `useQueueManagement.handleAddToQueue` shuffles the fetched tracks with `shuffleArray()` before deduping and appending. The user's `shuffleEnabled` preference is not mutated — it remains whatever they set globally.

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
   - **`expectedTrackIdRef` ownership** — `useProviderPlayback.playTrack` is the single owner: it sets `expectedTrackIdRef.current` to the target track's id *before* calling the adapter's `playTrack` (and before the next-track pre-warm's `prepareTrack`). This covers every normal entry point — `handleNext`, `handlePrevious`, fresh `loadCollection` → `playTrack(0)`, and empty-queue append — so callers no longer set the ref themselves. Without this guard a `loadCollection` → `playTrack(0)` path is racey: the pre-warm's emitted `PlaybackState` can flip `currentTrackIndex` before the real play-state arrives, causing album art to mismatch the playing audio. **Exception**: `handleHydrate` in `usePlayerLogic` sets `expectedTrackIdRef.current` directly because the hydrate path calls `descriptor.playback.prepareTrack` (emit-only, no `playTrack` invocation), so the centralised guard in `useProviderPlayback` does not apply.
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

Type: `VisualizerStyle` in `src/types/visualizer.ts`. Components in `src/components/visualizers/`.

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

## Multi-Agent Team Workflows

For epics that benefit from parallel specialist work, this project ships a six-role team (lead + explorer + architect + builder + reviewer + tester) defined in `.claude/agents/*.md`. Spawn it on demand and run retros against it.

### Skills

- **`/spawn-epic-team`** — bootstraps the six-role team via `TeamCreate` + parallel `Agent` calls. Idempotent: checks `~/.claude/teams/vorbis-epic/config.json` first; only spawns missing members. Uses project-local `subagent_type` names (`architect`, `reviewer`, etc.) so spawned agents inherit the `.claude/agents/*.md` tool allowlists.
- **`/agent-team-retro`** — structured retrospective on a multi-agent team session. Polls every teammate via `SendMessage`, aggregates into action items, presents via `AskUserQuestion`, and applies approved edits directly to the agent definition files. Cataloging as a GitHub epic via `speckit:catalog` is opt-in.

### Agent definitions

`.claude/agents/*.md` files specify each role's tools, role description, and operating rules. Notable conventions:

- **Universal exit-gate rule** (every agent file): before yielding a turn, audit deliverables; route via `SendMessage` or the turn is incomplete. Plain-text output is invisible to the lead.
- **Tool allowlists explicitly include `SendMessage`, `TaskGet`, `TaskList`, `TaskUpdate`** — required for team participation. The architect and reviewer files restore these because the upstream `feature-dev:code-architect` and `feature-dev:code-reviewer` subagent types omit `SendMessage`, which structurally breaks team communication.
- **Spawn via project-local `subagent_type`**, not upstream `feature-dev:*` types, so the agent inherits the local definition. The `spawn-epic-team` skill handles this automatically.
- **Role-specific guardrails** (interface-contract-first for builder, `npm run test:run` exit-0 completion bar for tester, scope-clarification-up-front for explorer, `TaskList`-before-redirect for lead) — see each `.md` file for the full set.

### When to use

- **`/spawn-epic-team`** at the start of a multi-issue epic when parallel specialist work would help (typically 3+ child issues with distinct domains).
- **`/agent-team-retro`** at the end of a substantive team session, especially before tearing down via `TeamDelete`. Captures lessons before context is lost and iterates the agent definitions.
