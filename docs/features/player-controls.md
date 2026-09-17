# Player Controls

## Overview

The player control system routes user actions (play, pause, next, previous) through a provider-agnostic dispatch layer. The central hook `usePlayerLogic` owns all control handlers and delegates playback to whichever provider is currently driving audio output.

Key concept: **active provider** (selected for browsing/catalog) vs **driving provider** (currently outputting audio). In mixed queues these differ.

## File Map

| File | Role |
|------|------|
| `src/hooks/usePlayerLogic.ts` | Central orchestrator; assembles handlers, attaches the playback store, owns view/radio UI state |
| `src/hooks/useProviderPlayback.ts` | Resolves provider per track, handles cross-provider handoff, error recovery |
| `src/stores/playbackStore.ts` | Owns `isPlaying`/`positionMs`/`durationMs`/`currentTrackId`/`drivingProviderId`, the single provider fan-out subscription, and all stale-event heuristics |
| `src/stores/queueStore.ts` | Owns the queue (`tracks`/`originalTracks`/`currentIndex`/`shuffle`); synchronous reads for index-based playback |
| `src/hooks/usePlaybackState.ts` | React read hook for the playback store (`useSyncExternalStore`) |
| `src/hooks/useAutoAdvance.ts` | Advance-to-next policy on the store's `trackEnded` events |
| `src/hooks/useNewestWins.ts` | Newest-wins async guard for superseded operations (mashed next, overlapping loads) |
| `src/hooks/useKeyboardShortcuts.ts` | Keyboard event handler; device-aware (pointer vs touch) |
| `src/hooks/useVolume.ts` | Volume + mute state; persisted via `useLocalStorage` |
| `src/hooks/useZenTouchGestures.ts` | Touch gesture recognizer for zen mode (single tap, double tap, long press) |
| `src/hooks/useCollectionLoader.ts` | Loads a collection into the queue and starts playback |
| `src/hooks/useQueueManagement.ts` | Queue mutation: add, remove, reorder |
| `src/hooks/useRadioSession.ts` | Radio generation session lifecycle |
| `src/components/PlayerStateRenderer.tsx` | Idle/home view routing (QAP vs library browser) |
| `src/components/PlayerContent/ZenClickZoneOverlay.tsx` | Desktop zen: hover-reveal prev/play/next buttons over album art |
| `src/components/PlayerContent/ZenLikeOverlay.tsx` | Desktop zen: hover-reveal like button (bottom-right of album art) |
| `src/providers/errors.ts` | `AuthExpiredError`, `UnavailableTrackError` |
| `src/types/providers.ts` | `PlaybackProvider` interface (line 115) |
| `src/types/domain.ts` | `PlaybackState` interface (line 105) |

## usePlayerLogic

**Location:** `src/hooks/usePlayerLogic.ts`

Central dispatch hub. Composes all sub-hooks and returns a structured API:

```ts
return {
  state: { isLoading, error, selection, tracks, currentView, isPlaying, playbackPosition },
  handlers: {
    loadCollection, playTracksDirectly, handleAddToQueue, queueTracksDirectly,
    insertTracksNext, insertCollectionNext,
    handlePlay, handlePause, handleNext, handlePrevious, playTrack,
    handleOpenLibrary, handleCloseLibrary, handleBackToLibrary,
    handleStartRadio, handleRemoveFromQueue, handleReorderQueue,
    restoreSession, setCurrentView,
  },
  radio: { radioState, isRadioAvailable, stopRadio, authExpired, clearAuthExpired, isActive, radioProgress, dismissRadioProgress },
};
```

### Store-based state

Queue and playback state live in module stores outside React, not in hook-local state. `usePlayerLogic` reads playback state via `usePlaybackState()` (a `useSyncExternalStore` bridge over `playbackStore`) and reads the queue synchronously inside handlers via `queueStore.getTracks()` / `queueStore.getCurrentIndex()`. It attaches the store's single provider fan-out with `useEffect(() => playbackStore.attach(), [activeDescriptor])` — re-attaching on active-provider change re-primes state via `getState()` — and mirrors the active provider into the resolver's last-resort fallback with `playbackStore.setActiveProviderFallback(activeDescriptor?.id ?? null)`. Because store reads are synchronous, there are no ref mirrors to keep in sync and no subscription teardown on track changes.

### handleNext / handlePrevious

Skip is app-queue-owned — the `PlaybackProvider` interface has no `next()`/`previous()` methods. `handleNext` stops at the end of the queue (no wrap); `handlePrevious` clamps at index 0. Each reads the queue synchronously from `queueStore`, computes the target index, calls `queueStore.setCurrentIndex(targetIndex)`, then `await playTrack(targetIndex, true)`, then `ensurePlaybackResumed()` (manual skip auto-resumes, matching Spotify/Apple Music). The transition guard is not raised here — `playTrack` itself calls `playbackStore.beginTransition(track.id)` before any adapter call, telling the store's event pipeline to ignore stale provider index updates until the expected track arrives.

### handlePlay / handlePause

Route through `playbackStore.getDrivingDescriptor()` -- resolves the driving provider (not the active provider). `handlePlay` first consumes a pending hydrate (`hydratedPendingPlayRef`, stashed by `restoreSession` with `autoplay: false`) by calling `playTrack(pending.index, false, { positionMs })`; otherwise it calls `descriptor.playback.resume()`. `handlePause` calls `descriptor.playback.pause()`.

### handleBackToLibrary

Pauses playback, stops radio, clears the selection, empties the queue (`queueStore.clear()`), drops any transition guard (`playbackStore.clearTransition()`), and closes drawers.

### Queue change notification

On every track transition, `playTrack` (in useProviderPlayback) pushes the latest queue snapshot via `descriptor.playback.onQueueChanged?.(tracks, index)` — but only for providers whose `descriptor.capabilities.hasNativeQueueSync` is true. Spotify declares this capability and uses the signal to build its native upcoming-queue; providers without it never receive the call. User-driven queue mutations are handled separately in `useQueueManagement` (its `notifyQueueChanged` helper resolves the target via `playbackStore.getDrivingDescriptor()`).

## useProviderPlayback

**Location:** `src/hooks/useProviderPlayback.ts`

### Props

```ts
interface UseProviderPlaybackProps {
  onAuthExpired?: ((providerId: ProviderId) => void) | undefined;
}
```

Everything else it needs — the queue, the driving provider, the transition guard — comes straight from `queueStore` and `playbackStore`. Returns `{ playTrack, resumePlayback }`.

### Provider resolution chain

`playbackStore.resolveDrivingProviderId(mediaTrack?.provider)` is the single resolver, returning the first defined value from:

1. `mediaTrack.provider` -- per-track provider ID (set when track was loaded)
2. `drivingProviderId` -- the provider currently producing audio (store snapshot)
3. the active-provider fallback -- mirrored in by `usePlayerLogic` via `setActiveProviderFallback`

### Cross-provider handoff

`pausePreviousProvider(nextProvider)` reads `playbackStore.getSnapshot().drivingProviderId`; if it differs from the next provider it pauses the old one (fire-and-forget). `playTrack` then commits the new provider via `playbackStore.setDrivingProvider(trackProvider)`.

### playTrack(index, skipOnError?, options?)

1. Read the queue synchronously: `queueStore.getTracks()[index]`
2. Resolve provider via `playbackStore.resolveDrivingProviderId(mediaTrack?.provider)`
3. `playbackStore.beginTransition(mediaTrack.id)` -- raise the transition guard before ANY adapter call
4. Claim a newest-wins token (`useNewestWins`) so an overlapping `playTrack` that resolves late drops its stale result
5. `pausePreviousProvider(trackProvider)` -- handoff if needed, then `playbackStore.setDrivingProvider(trackProvider)`
6. If the descriptor declares `hasNativeQueueSync`: `descriptor.playback.onQueueChanged?.(tracks, index)`
7. Call `descriptor.playback.playTrack(mediaTrack, options)`
8. On success (token not stale): `queueStore.setCurrentIndex(index)`, then pre-warm the next track via its own provider's `prepareTrack?.(nextTrack)`
9. On error: see Error Recovery below

### Error recovery

| Error type | Behavior |
|-----------|----------|
| `AuthExpiredError` | Calls `onAuthExpired(providerId)`, does NOT skip. UI shows re-auth prompt. |
| `UnavailableTrackError` | Logs warning. If `skipOnError` and not at end of queue, schedules `playTrack(index + 1)` after 500ms. |
| Generic error | Logs error. Same skip logic as `UnavailableTrackError`. |

The skip delay (`SKIP_ON_ERROR_DELAY_MS` from `src/constants/timing.ts`, currently 500ms) prevents rapid-fire skipping through consecutive unavailable tracks.

## playbackStore (the single subscription)

**Location:** `src/stores/playbackStore.ts`

A module-level store (read from React via `usePlaybackState()`) that owns `isPlaying`, `positionMs`, `durationMs`, `currentTrackId`, and `drivingProviderId`. There is exactly ONE subscription to provider playback events in the app: `playbackStore.attach()` subscribes to every registered provider and routes events through one pipeline.

### Attachment

1. `attach()` iterates `providerRegistry.getAll()` and subscribes to every provider's `playback.subscribe()`
2. Each callback passes the provider's id into `handleProviderEvent`
3. `usePlayerLogic` calls `attach()` once, re-attaching when `activeDescriptor` changes (which re-primes state from the driving provider's `getState()`)

At most one attachment is live at a time; a generation counter keeps async `getState()` continuations from a superseded attachment from writing state. The attachment also owns the `visibilitychange` resync and a 1 s position poll that runs only while playing.

### Driving provider filter

```ts
if (providerId !== resolveDrivingProviderId()) return;
```

Events from non-driving providers are silently dropped.

### State sync (the pipeline)

From each accepted `PlaybackState`:
- Commit `isPlaying` and `durationMs`; commit `positionMs` only when the seek guard accepts it
- If `state.currentTrackId` is present, sync the queue index (`queueStore.setCurrentIndex`), subject to the transition guard
- If `state.trackMetadata` is present (Dropbox ID3 enrichment), overlay it onto the queue track via `queueStore.mapTracks`
- Run ended detection, emitting `trackEnded` at most once per track

### Transition guard

During transitions, `playTrack` calls `beginTransition(trackId)` before any adapter call. While the guard is up, provider index updates for other track ids are ignored. When the expected track ID arrives, the guard is consumed and normal sync resumes. This prevents a brief flash of the old track's index being set by a stale provider event.

### Seek guard

`playbackStore.seek(positionMs)` commits the target optimistically and rejects stale pre-seek position emits until one lands within 2 s of the expected post-seek position (5 s safety window so the cursor can never get stuck; #1671). `usePlaybackControls` issues all seeks through it.

### Visibility change handler

On `visibilitychange` (tab returns to foreground):
1. Drop the transition guard (stale guards no longer relevant)
2. Call `getState()` on the driving provider and run the result through the pipeline to resync all playback state

## useAutoAdvance

**Location:** `src/hooks/useAutoAdvance.ts`

### Props

```ts
interface UseAutoAdvanceProps {
  playTrack: (index: number, skipOnError?: boolean) => void;
  enabled?: boolean | undefined;   // default: true
}
```

### End detection lives in the store

Detection moved into `playbackStore`, which emits a `trackEnded` event at most once per track. Two independent signals:

1. **Near-end**: `timeRemaining <= AUTO_ADVANCE_END_THRESHOLD_MS` (2000ms) OR `position >= duration - NEAR_END_FALLBACK_MS` (1000ms)
2. **Natural end**: `wasPlaying && isPaused && position === 0 && duration > 0` -- track was playing, is now paused at position 0

### Cooldown guard (PLAY_COOLDOWN_MS = 5000)

The natural-end signal has a cooldown: the store checks `msSinceLastPlay > 5000` before emitting. Both Spotify SDK and HTML5 Audio briefly pause at position 0 during buffering, which would falsely trigger advance without this guard. The cooldown reads from `descriptor.playback.getLastPlayTime?.()` if available, falling back to the store's `lastPlayInitiatedAt` (stamped by `beginTransition`).

### Advance behavior (the hook's only job)

`useAutoAdvance` subscribes via `playbackStore.subscribeTrackEnded` and owns policy only: it schedules a timeout of `AUTO_ADVANCE_DELAY_MS` (100ms). Inside the timeout it re-reads the live queue (`queueStore.getCurrentIndex()` / `getTracks()`):
- If at end of queue (`currentIdx >= tracks.length - 1`): stop, do not wrap
- Otherwise: `playTrack(currentIdx + 1, true)` with `skipOnError`

The 100ms delay + computing `nextIndex` inside the timeout (not at schedule time) ensures shuffle toggles during the delay use fresh queue state.

### Reset on track/queue change

A `queueStore.subscribe` listener cancels any pending advance timer whenever `tracks` or `currentIndex` changes (reorder, shuffle toggle, manual track change). This prevents a stale advance from playing the wrong track after shuffle toggle. The store re-arms its once-per-track `trackEnded` emission whenever the reported track id changes or a new transition begins.

## useKeyboardShortcuts

**Location:** `src/hooks/useKeyboardShortcuts.ts`

### Device detection

Uses `prefersPointerInput` option (from `usePlayerSizing`), which checks CSS media queries `(pointer: fine)` and `(hover: hover)`. This is NOT viewport-based -- a high-resolution tablet with touch input is correctly identified as touch-only.

### Key mappings

| Code | Handler | Condition |
|------|---------|-----------|
| `Space` | `onPlayPause` | always |
| `ArrowRight` | `onNext` | always |
| `ArrowLeft` | `onPrevious` | always |
| `ArrowUp` | `onShowQueue` | `prefersPointerInput` |
| `ArrowUp` | `onVolumeUp` | NOT `prefersPointerInput` |
| `ArrowDown` | `onOpenQuickAccessPanel` | `prefersPointerInput` |
| `ArrowDown` | `onVolumeDown` | NOT `prefersPointerInput` |
| `KeyQ` | `onShowQueue` | always (device-independent alternative) |
| `KeyL` | `onOpenQuickAccessPanel` | always (device-independent alternative) |
| `KeyV` | `onCycleVisualizerStyle` | no ctrl/meta |
| `KeyS` | `onToggleShuffle` | no ctrl/meta, no shift |
| `KeyS` + Shift | `onToggleVisualEffectsMenu` | no ctrl/meta |
| `KeyG` | `onToggleGlow` | no ctrl/meta |
| `KeyT` | `onToggleTranslucence` | no ctrl/meta |
| `KeyZ` | `onToggleZenMode` | no ctrl/meta |
| `KeyO` | (not wired -- effects menu uses `Shift+S`) | |
| `KeyK` | `onToggleLike` | no ctrl/meta |
| `KeyM` | `onMute` | always |
| `Slash` | `onToggleHelp` | no ctrl/meta |
| `Escape` | closes all menus | always |

### Input guard

Shortcuts are suppressed when the event target (via `composedPath()` for Shadow DOM) is `INPUT`, `TEXTAREA`, or `contentEditable`.

## useVolume

**Location:** `src/hooks/useVolume.ts`

### State

- `volume` (0-100): persisted via `useLocalStorage(STORAGE_KEYS.VOLUME, 50)`
- `isMuted` (boolean): persisted via `useLocalStorage(STORAGE_KEYS.MUTED, false)`
- `previousVolumeRef`: stores pre-mute volume for restore

### Provider routing

`getPlayingPlayback()` resolves the playback adapter for the currently playing provider:
- If `currentTrackProvider` differs from `activeDescriptor.id`, looks up the track's provider via `providerRegistry`
- Otherwise uses `activeDescriptor.playback`

Volume changes call `playback.setVolume(value / 100)` -- the `PlaybackProvider` interface expects 0-1 range.

### setVolumeLevel(newVolume)

Clamps to 0-100, rounds, and auto-syncs mute state: setting volume to 0 enables mute, setting > 0 disables mute.

## Zen Mode

Zen mode hides player controls and expands album art to fill the viewport. Interaction differs by device type.

### Desktop (pointer devices)

`ZenClickZoneOverlay` renders three hover-activated circular buttons (prev, play/pause, next) over the album art. Buttons are transparent (`opacity: 0`) until hovered. The overlay uses `container-type: size` for responsive button sizing (`clamp(72px, 20cqmin, 224px)`).

Visibility condition: `zenModeEnabled && hasPointerInput && !zenTouchActive && !isFlipped`

`ZenLikeOverlay` renders a like heart button at bottom-right of album art. Appears on hover.

Visibility condition: `zenModeEnabled && hasPointerInput && isHovered && !isFlipped`

### Dead zones

`resolveZenZone()` in `src/constants/zenAnimation.ts` maps cursor position to a zone. The top 20% and bottom 20% of album art are dead zones (return `null`). Within the active region:
- Left 25%: `'left'` (previous)
- Right 25%: `'right'` (next)
- Center 50%: `'center'` (play/pause)

Constants: `ZEN_DEAD_ZONE_TOP = 0.2`, `ZEN_DEAD_ZONE_BOTTOM = 0.8`, `ZEN_ZONE_LEFT_BOUNDARY = 0.25`, `ZEN_ZONE_RIGHT_BOUNDARY = 0.75`

### Touch devices (useZenTouchGestures)

**Location:** `src/hooks/useZenTouchGestures.ts`

Uses pointer events (not touch events) for unified handling. Gesture mapping:

| Gesture | Action |
|---------|--------|
| Single tap | Play/Pause (after 300ms double-tap window) |
| Double tap | Like toggle |
| Long press (500ms) | Flip menu toggle |

Movement beyond 10px cancels long press. The hook returns `{ onPointerDown, onPointerUp, onPointerCancel, onPointerMove }`.

Active condition in `AlbumArtSection`: `isTouchDevice && zenModeEnabled && !isFlipped`

### BottomBar in zen mode

BottomBar shows via grip pill tap with tap-outside-to-dismiss backdrop. (Handled elsewhere in BottomBar component, not in the hooks documented here.)

### Zen animation constants

From `src/constants/zenAnimation.ts`:
- Art expand: 1000ms duration, 300ms enter delay
- Controls fade: 300ms duration, 500ms exit delay
- Art margins: 96px horizontal / 196px vertical (desktop), 32px / 120px (mobile)

## PlayerStateRenderer

**Location:** `src/components/PlayerStateRenderer.tsx`

Renders the idle/home view when no track is loaded (`selection === null || tracks.length === 0`). Beyond the loading / auth-error / generic-error cards, the idle view also has a 'welcome' route (WelcomeScreen, first run until dismissed) and a 'hydrate' route (a 'Restoring Your Session' spinner that fires `onHydrate` to restore the last queue).

### View routing

Idle routing is resolved by `resolveIdleRoute(welcomeSeen, qapEnabled, hasValidSession)`:

```
!welcomeSeen      -> 'welcome'  (WelcomeScreen)
qapEnabled        -> 'qap'      (QuickAccessPanel)
hasValidSession   -> 'hydrate'  (session-restore spinner; fires onHydrate)
else              -> 'library'  (LibraryRoute, lazy-loaded via React.lazy as LibraryRouteLazy)
```

A `libraryOverride` state is a one-way door: once "Browse Library" is engaged it pins the idle view to the library browser even if routing inputs would otherwise pick QAP. Selecting a playlist resets `libraryOverride` to `false` and fires the selection callback.

### QAP preference

Stored in `localStorage` under key `vorbis-player-qap-enabled` (default `false`). Toggled via the Advanced settings section (`src/components/Settings/sections/AdvancedSection.tsx`). The `useQapEnabled()` hook wraps `useLocalStorage`.

### Other states

- **Loading**: Animated card with pulse icon and shimmer progress bar
- **Auth error**: "Connect to {providerName}" card with login button
- **Generic error**: Destructive alert with error message

## Playback Flow (End to End)

```
User presses Next
  -> usePlayerLogic.handleNext()
    -> queueStore.setCurrentIndex(nextIndex)
    -> useProviderPlayback.playTrack(nextIndex, skipOnError=true)
      -> playbackStore.beginTransition(track.id)    // guard up before any adapter call
      -> claims a newest-wins token
      -> playbackStore.resolveDrivingProviderId(track.provider)
      -> pausePreviousProvider(resolvedProvider)    // handoff if provider changed
      -> playbackStore.setDrivingProvider(resolvedProvider)
      -> descriptor.playback.onQueueChanged?.(tracks, index)  // hasNativeQueueSync only
      -> descriptor.playback.playTrack(mediaTrack)  // Spotify SDK or HTML5 Audio
      -> on success: queueStore.setCurrentIndex(index); prepareTrack(nextTrack)  // pre-warm next
      -> on error: skip or surface auth prompt

Provider emits PlaybackState
  -> playbackStore pipeline receives event (single fan-out from attach())
    -> filters by resolveDrivingProviderId() (ignores non-driving providers)
    -> transition guard check (ignores stale index updates during transition)
    -> seek guard check on positionMs (rejects stale pre-seek emits)
    -> commits isPlaying/positionMs/durationMs/currentTrackId; syncs queue index
    -> overlays trackMetadata via queueStore.mapTracks if present
    -> ended detection may emit trackEnded (once per track)

trackEnded fires (near-end threshold or paused-at-0 outside cooldown)
  -> useAutoAdvance schedules advance after 100ms
    -> re-reads queueStore; stops at end of queue
    -> playTrack(currentIdx + 1, skipOnError=true)
```
