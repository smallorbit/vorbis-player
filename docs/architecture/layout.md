# Layout Architecture

The centering system is a flex chain:

```
AppContainer (flexCenter, min-height: 100dvh)
  → AudioPlayer (flexCenter, min-height: 100dvh)
    → ContentWrapper (position: relative, z-index: 2, overflow: visible)
      → PlayerContainer (flex column, centered)
```

## Core invariants

- **`ContentWrapper` must use `position: relative`** — not absolute — so parent flex containers can center it.
- **`overflow: visible` is required on ContentWrapper** — `container-type: inline-size` creates containment that clips absolutely-positioned children.
- **`100dvh`** throughout to handle iOS address bar changes.
- **BottomBar** renders via `createPortal()` to `document.body`, fixed at bottom.
- **Drawers** use fixed positioning with slide animations and swipe-to-dismiss; vertical swipes on album art toggle the **queue** (up) drawer (`QueueDrawer` / `QueueBottomSheet`).
- **BackgroundVisualizer and AccentColorBackground** are `position: fixed` with low z-index, don't affect layout.

## Queue Suspense fallback

The queue drawers (`QueueDrawer`, `QueueBottomSheet`) render `QueueSkeleton` (`src/components/QueueSkeleton.tsx`) as their Suspense fallback — a row-shaped placeholder with a transform-based shimmer that respects `prefers-reduced-motion`. The lazy bundles are prefetched on first playback via `useQueueBundlePrefetch` (`src/hooks/useQueueBundlePrefetch.ts`), scheduled inside `requestIdleCallback` (with `setTimeout` fallback) once per session.

## Full-screen library

Two implementations coexist behind the `useNewLibraryRoute` feature flag (`vorbis-player-new-library-route` localStorage key, default `false`):

- **Legacy library (`LibraryPage`)** — flag `false`. The library browser opens as `LibraryPage` (a full-screen view), not a drawer. `showLibrary` state in `usePlayerLogic` gates it; `handleOpenLibrary` / `handleCloseLibrary` toggle it. `LibraryPage` is rendered via `React.lazy` from `AudioPlayer.tsx` (idle library overlay) and `PlayerStateRenderer.tsx` (idle route).
- **New Library Route (`LibraryRoute`)** — flag `true`. A new top-level surface composed of section components (Resume hero, Recently Played, Pinned, Liked, Playlists, Albums). Mounted from the same two render sites as `LibraryPage` via the same `showLibrary` / idle-route gates, so all open/close affordances continue to work. See `src/components/LibraryRoute/`. **[NEW LIBRARY ROUTE — temporary; section is consolidated into a single description when #1298 lands.]**

`usePlayerLogic` exposes both `state.showLibrary` (legacy boolean) and `state.currentView: 'player' | 'library'` (new). `showLibrary` is derived from `currentView` (`currentView === 'library'`); writers (`handleOpenLibrary`, `handleCloseLibrary`) drive `currentView`. Legacy readers in `PlayerContent`, `DrawerOrchestrator`, `PlayerControlsSection`, and `AudioPlayer` continue using `showLibrary` unchanged.

**Opening the library**: swipe down on album art, BottomBar library button, or keyboard `↓` / `L`. Opening library closes the queue drawer. Behavior is identical between flag states.

**Filter state** for the legacy library persists to localStorage via `useLocalStorage`. Keys are prefixed `vorbis-player-library-*` (e.g., `vorbis-player-library-search`, `vorbis-player-library-provider-filters`, `vorbis-player-library-genres`). Opening the library from the QAP "Browse Library" button clears these keys before navigating. The new route's filter persistence is described in `docs/features/library.md` once #1296 lands.

**Recently Played history** is tracked by `useRecentlyPlayedCollections` (`src/hooks/useRecentlyPlayedCollections.ts`). It exposes `history: RecentlyPlayedEntry[]` and `record(ref, name)`. Successful collection loads via `useCollectionLoader.loadCollection` call `record` automatically. History is stored under `vorbis-player-recently-played` (localStorage), capped at 5 entries, deduped by `CollectionRef` key, newest first. The legacy `FilterSidebar` renders a "Recently Played" section with up to 5 clickable shortcuts on desktop (hidden when history is empty); the new route surfaces the same data via `useRecentlyPlayedSection` as a top-level row.

**Mobile library overlay** (legacy): `MobileLibraryBottomBar` (full-width search input + trailing sort dropdown) instead of the provider chip row. Mobile intentionally bypasses `providerFilters` — `ignoreProviderFilters = isMobile` in `useLibraryRoot.ts` ensures items from every enabled provider are always shown. Desktop behavior is unchanged: `FilterSidebar` provides provider chips, sort, genre, and recently-played controls. The new route handles mobile/desktop layouts via its own `MobileLayout` / `DesktopLayout` styled-components in `src/components/LibraryRoute/styled.ts`.

## Idle/home routing

When no track is loaded, `PlayerStateRenderer` (`src/components/PlayerStateRenderer.tsx`) picks a landing view via `resolveIdleRoute(welcomeSeen, qapEnabled, hasValidSession)`:

| Condition | Landing view |
|---|---|
| `welcomeSeen === false` | `WelcomeScreen` (supersedes all other inputs) |
| valid `lastSession` + `qapEnabled` | `QuickAccessPanel` (with Resume hero) |
| valid `lastSession` + `!qapEnabled` | player hydrated via `handleHydrate` (paused) |
| no/stale session + `qapEnabled` | `QuickAccessPanel` |
| no/stale session + `!qapEnabled` | `LibraryPage` |

QAP is opt-in via the "Quick Access Panel" On/Off control in `VisualEffectsMenu`; preference persists under `vorbis-player-qap-enabled` (default `false`) via `useQapEnabled()`. Clicking "Browse Library" from QAP or Welcome flips a local `libraryOverride` flag — once engaged, the idle view stays on `LibraryPage` for the rest of the session (one-way door).

**Welcome screen** — `WelcomeScreen` (`src/components/WelcomeScreen/index.tsx`) shows once for new users with a per-provider status summary and context-aware primary CTA (*Connect a provider* when `connectedProviderIds.length === 0`, *Browse your library* otherwise). The dismiss-for-good flag persists via `useWelcomeSeen` (`src/hooks/useWelcomeSeen.ts`) under the `vorbis-player-welcome-seen` localStorage key (default `false`).

**Stale session cutoff** — `isSessionStale(session, now?)` from `src/services/sessionPersistence.ts` returns true when the session is absent, missing `savedAt`, or older than `STALE_SESSION_MS` (30 days). Stale sessions are treated as no session for landing routing and resume affordances.

**Resume hero** — `ResumeHero` (`src/components/QuickAccessPanel/ResumeHero.tsx`) renders at the top of `QuickAccessPanel` (above `PinRing`) when a valid `lastSession` is present; clicking the Resume CTA invokes `onResume` (autoplay). The footer `ResumeCard` is suppressed inside QAP to avoid duplicate affordances; it still renders as the `footer` prop of `LibraryPage` on the idle library route.

**Settings gear on idle views** — `SettingsGearButton` (`src/components/SettingsGearButton/index.tsx`) is mounted top-right by `PlayerStateRenderer` on `WelcomeScreen`, idle `LibraryPage`, and `QuickAccessPanel` via the `onOpenSettings` prop, opening the existing `VisualEffectsMenu`. Hidden during loading and error states. The active-player gear continues to live in `BottomBar` / `PlayerControlsSection`.

When `useNewLibraryRoute` is enabled, the `LibraryPage` mount in the idle library route is swapped for `LibraryRoute`. Routing logic (Welcome → QAP → Hydrate → Library) is unchanged; only the leaf component differs. The `SettingsGearButton` continues to mount above the library on the idle route in both flag states. **[NEW LIBRARY ROUTE — remove paragraph when #1298 lands.]**

## Hydrate without autoplay

`handleHydrate(session): Promise<HydrateResult>` in `usePlayerLogic` (`src/hooks/usePlayerLogic.ts`) restores `tracks` / `originalTracks` / `mediaTracksRef` / `currentTrackIndex` / `selectedPlaylistId`, sets the seek bar to `savedPositionMs`, and calls `prepareTrack(track, { positionMs })` on the driving provider — but does NOT call `play()`. A `hydratedPendingPlayRef = { index, positionMs }` records the target so the next user-initiated `handlePlay` starts from the saved offset. Any call into `playTrack` (next/previous/new collection) clears the ref.

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

## Zen mode

**Overlays** (`ZenClickZoneOverlay`, `ZenLikeOverlay`): hover-activated on desktop (pointer devices only), hidden when flip menu is open (`isFlipped`), with vertical dead zones (top/bottom 20% of album art ignored). Mobile zen uses touch gestures instead (`useZenTouchGestures`). BottomBar in zen mode shows via grip pill tap with tap-outside-to-dismiss backdrop.

**Entry/exit orchestration** — timing constants live in `src/constants/zenAnimation.ts`; CSS transitions in `PlayerContent/styled.ts` (`ContentWrapper`, `PlayerStack`, `ZenControlsWrapper`) and `BottomBar/styled.ts`. Entry and exit sequences are asymmetric on purpose:

- **Entry** (normal → zen): controls fade in place over `ZEN_CONTROLS_DURATION`; after `ZEN_ART_ENTER_DELAY` the art grows (`PlayerStack.max-width`) in parallel with the controls row collapsing (`grid-template-rows 1fr → 0fr`) over `ZEN_ART_DURATION`.
- **Exit** (zen → normal): art shrink, `ContentWrapper.margin-bottom` growth, `CardContent.transform` shift, and controls row expansion (`grid-template-rows 0fr → 1fr`) all animate in parallel over `ZEN_ART_DURATION`. Opacity/transform on the controls and the `BottomBar` slide-up are delayed by `ZEN_EXIT_REENTRY_DELAY` (= `ZEN_ART_DURATION`) so they appear after the art has settled.
- **`--player-controls-height` freeze during transitions** — `PlayerContent` holds a `zenTransitioningRef` that gates the `ResizeObserver` on the controls element. Without this, the row expanding `0 → 220px` on exit would push the CSS variable through every intermediate frame, moving `PlayerStack.max-width`'s target mid-transition and causing the art to chase it. The ref is raised in `handleZenModeToggle`, cleared via `setTimeout` after `ZEN_ART_DURATION + ZEN_ART_ENTER_DELAY + 50ms`.
- `prefers-reduced-motion: reduce` short-circuits transitions on `PlayerStack`, `ZenControlsWrapper`, and `BottomBarContainer`. Per-element transition rationale is inlined in `PlayerContent/styled.ts` and `BottomBar/styled.ts`.

## Background Visualizers

Four animated background styles, selectable via the flip menu's Speed/Style controls. All share a `speed` prop (multiplier from `VisualEffectsContext`) and per-visualizer tuning in `src/constants/visualizerDebugConfig.ts`.

| Style key | Component | Description |
|-----------|-----------|-------------|
| `fireflies` | `ParticleVisualizer` | Drifting particles with pulsing opacity |
| `comet` | `TrailVisualizer` | Ships leaving fading particle trails |
| `wave` | `WaveVisualizer` | Layered sine waves spread vertically |
| `grid` | `GridWaveVisualizer` | Dot grid distorted by traveling waves |

Type: `VisualizerStyle` in `src/types/visualizer.ts`. Components in `src/components/visualizers/`.

## Responsive sizing

Breakpoints and exact values are in `src/styles/theme.ts`. Sizing calculations are in `src/utils/sizingUtils.ts` and `src/hooks/usePlayerSizing.ts`.

- Mobile: < 700px, Tablet: 700–1024px, Desktop: ≥ 1024px
- Uses `usePlayerSizing` hook for viewport-aware dimensions

## Common layout pitfalls

- Player not centered → `ContentWrapper` must use `position: relative`
- Elements clipped → ensure `overflow: visible` on `ContentWrapper`
- Mobile viewport bouncing → use `100dvh` not `100vh`
