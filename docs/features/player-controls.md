# Player Controls

## Overview

The player control system routes user actions (play, pause, next, previous) through a provider-agnostic dispatch layer. The central hook `usePlayerLogic` owns all control handlers and delegates playback to whichever provider is currently driving audio output.

Key concept: **active provider** (selected for browsing/catalog) vs **driving provider** (currently outputting audio). In mixed queues these differ.

## File Map

| File | Role |
|------|------|
| `src/hooks/usePlayerLogic.ts` | Central orchestrator; assembles handlers, wires subscriptions, owns local playback state |
| `src/hooks/useProviderPlayback.ts` | Resolves provider per track, handles cross-provider handoff, error recovery |
| `src/hooks/usePlaybackSubscription.ts` | Subscribes to all provider state events, filters by driving provider, syncs React state |
| `src/hooks/useAutoAdvance.ts` | Detects track-end signals, triggers `playTrack(nextIndex)` with cooldown guard |
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
| `src/types/providers.ts` | `PlaybackProvider` interface (line 66) |
| `src/types/domain.ts` | `PlaybackState` interface (line 81) |

## usePlayerLogic

**Location:** `src/hooks/usePlayerLogic.ts`

Central dispatch hub. Composes all sub-hooks and returns a structured API:

```ts
return {
  state: { isLoading, error, selectedPlaylistId, tracks, currentView, isPlaying, playbackPosition },
  handlers: {
    loadCollection, playTracksDirectly, handleAddToQueue, queueTracksDirectly,
    handlePlay, handlePause, handleNext, handlePrevious, playTrack,
    handleOpenLibrary, handleCloseLibrary, handleBackToLibrary,
    handleStartRadio, handleRemoveFromQueue, handleReorderQueue,
  },
  radio: { radioState, isRadioAvailable, stopRadio, authExpired, clearAuthExpired, isActive, radioProgress, dismissRadioProgress },
  mediaTracksRef,         // imperative mirror of tracks[]
  setTracks,
  setOriginalTracks,
  currentPlaybackProviderRef,  // ref to driving provider ID
  expectedTrackIdRef,          // guards against stale provider index updates during transitions
};
```

### Ref-based state pattern

`tracksRef`, `currentTrackIndexRef`, and `expectedTrackIdRef` are `useRef` mirrors of their corresponding React state. This is intentional: the `usePlaybackSubscription` effect depends only on `activeDescriptor`, not on tracks/index. Without refs, every track change would tear down and recreate the provider subscription, triggering a `getState()` call that briefly resets `currentTrackIndex` to the old track.

### handleNext / handlePrevious

Both wrap around the queue circularly (`% tracks.length`). Before calling `playTrack`, they set `expectedTrackIdRef.current` to the target track's ID. This tells `usePlaybackSubscription` to ignore any stale provider index updates until the expected track arrives.

### handlePlay / handlePause

Route through `getDrivingProviderDescriptor()` -- resolves the driving provider (not the active provider). `handlePlay` calls `descriptor.playback.resume()`. `handlePause` calls `descriptor.playback.pause()`.

### handleBackToLibrary

Pauses playback, stops radio, clears all queue state (`tracks`, `originalTracks`, `mediaTracksRef`, `selectedPlaylistId`, `currentTrackIndex`), and closes drawers.

### Queue change notification

An effect watches `tracks` and `currentTrackIndex` and calls `descriptor.playback.onQueueChanged?.(tracks, currentTrackIndex)` on the driving provider. Spotify uses this to sync its native queue.

## useProviderPlayback

**Location:** `src/hooks/useProviderPlayback.ts`

### Props

```ts
interface UseProviderPlaybackProps {
  setCurrentTrackIndex: (index: number) => void;
  activeDescriptor?: ProviderDescriptor | null;
  mediaTracksRef: React.MutableRefObject<MediaTrack[]>;
  onAuthExpired?: (providerId: ProviderId) => void;
}
```

### Provider resolution chain

`resolveTrackProvider(mediaTrack)` returns the first defined value from:

1. `mediaTrack.provider` -- per-track provider ID (set when track was loaded)
2. `currentPlaybackProviderRef.current` -- last known driving provider
3. `activeDescriptor.id` -- currently selected provider in UI

### Cross-provider handoff

`pausePreviousProvider(nextProvider)` checks if the driving provider is changing. If so, it pauses the old provider before updating `currentPlaybackProviderRef`.

### playTrack(index, skipOnError?, options?)

1. Read `mediaTracksRef.current[index]`
2. Resolve provider via `resolveTrackProvider`
3. `pausePreviousProvider(trackProvider)` -- handoff if needed
4. Update `currentPlaybackProviderRef.current = trackProvider`
5. Call `descriptor.playback.playTrack(mediaTrack, options)`
6. On success: `setCurrentTrackIndex(index)`, then pre-warm next track via `prepareTrack?.(nextTrack)`
7. On error: see Error Recovery below

### Error recovery

| Error type | Behavior |
|-----------|----------|
| `AuthExpiredError` | Calls `onAuthExpired(providerId)`, does NOT skip. UI shows re-auth prompt. |
| `UnavailableTrackError` | Logs warning. If `skipOnError` and not at end of queue, schedules `playTrack(index + 1)` after 500ms. |
| Generic error | Logs error. Same skip logic as `UnavailableTrackError`. |

The 500ms delay before skip prevents rapid-fire skipping through consecutive unavailable tracks.

## usePlaybackSubscription

**Location:** `src/hooks/usePlaybackSubscription.ts`

Subscribes to playback state events from ALL registered providers (not just the active one). Only processes events from the driving provider.

### Subscription setup

1. Subscribe to `activeDescriptor.playback.subscribe()`
2. Iterate `providerRegistry.getAll()` and subscribe to every other provider
3. Each callback passes `providerId` to `handleProviderStateChange`

### Driving provider filter

```ts
const drivingProviderId = drivingProviderRef.current ?? activeProviderId;
if (providerId !== drivingProviderId) return;
```

Events from non-driving providers are silently dropped.

### State sync

From each `PlaybackState`:
- `setIsPlaying(state.isPlaying)`
- `setPlaybackPosition(state.positionMs)`
- If `state.currentTrackId` is present, find it in `tracksRef.current` and sync `currentTrackIndex`
- If `state.trackMetadata` is present (Dropbox ID3 enrichment), merge into `tracks[trackIndex]`

### expectedTrackIdRef guard

During transitions (next/previous), `expectedTrackIdRef` is set to the target track ID. While non-null, provider index updates are ignored. When the expected track ID arrives, the ref is cleared and normal sync resumes. This prevents a brief flash of the old track's index being set by a stale provider event.

### Visibility change handler

On `visibilitychange` (tab returns to foreground):
1. Clear `expectedTrackIdRef` (stale transition guards no longer relevant)
2. Call `getState()` on the driving provider to resync all playback state

### Dependency strategy (invariant)

The effect depends only on `[activeDescriptor, setCurrentTrackIndex, setTracks]`. Tracks and index are read via refs. This prevents subscription teardown/recreation on every track change.

## useAutoAdvance

**Location:** `src/hooks/useAutoAdvance.ts`

### Props

```ts
interface UseAutoAdvanceProps {
  tracks: MediaTrack[];
  currentTrackIndex: number;
  playTrack: (index: number, skipOnError?: boolean) => void;
  enabled?: boolean;          // default: true
  endThreshold?: number;      // default: 2000ms
  currentPlaybackProviderRef?: React.RefObject<ProviderId | null>;
}
```

### End detection signals

Two independent detection paths:

1. **Near-end**: `timeRemaining <= endThreshold` OR `position >= duration - 1000` while still playing
2. **Natural end**: `wasPlayingRef.current && isPaused && position === 0 && duration > 0` -- track was playing, is now paused at position 0

### Cooldown guard (PLAY_COOLDOWN_MS = 5000)

The natural-end signal has a cooldown: it checks `msSinceLastPlay > 5000` before advancing. Both Spotify SDK and HTML5 Audio briefly pause at position 0 during buffering, which would falsely trigger advance without this guard. The cooldown reads from `descriptor.playback.getLastPlayTime?.()` if available, falling back to `lastPlayInitiatedRef`.

### Advance behavior

`advanceToNext()` sets `hasEnded = true` and schedules a 100ms timeout. Inside the timeout:
- If at end of queue (`currentIdx >= totalTracks - 1`): stop, do not wrap
- Otherwise: `playTrack(currentIdx + 1, true)` with `skipOnError`

The 100ms delay + computing `nextIndex` inside the timeout (not at schedule time) ensures shuffle toggles during the delay use fresh refs.

### Reset on track/queue change

`hasEnded` resets and pending advance timers are cancelled whenever `currentTrackIndex` or `tracks` changes. This prevents stale advance from playing the wrong track after shuffle toggle.

### Subscription pattern

Same as `usePlaybackSubscription`: subscribes to active provider + all others. Events from non-driving providers are only processed when `drivingProviderRef.current === descriptor.id`.

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

Renders the idle/home view when no track is loaded (`selectedPlaylistId === null || tracks.length === 0`).

### View routing

```
qapEnabled (from useQapEnabled) ?
  -> QuickAccessPanel (with browseLibrary callback)
  : -> PlaylistSelection (lazy-loaded via React.lazy)
```

`showLibrary` state initializes to `!qapEnabled`. When the user selects a playlist from the library browser, `showLibrary` is set to `false` and the selection callback fires.

### QAP preference

Stored in `localStorage` under key `vorbis-player-qap-enabled` (default `false`). Toggled via the settings panel (`VisualEffectsMenu`). The `useQapEnabled()` hook wraps `useLocalStorage`.

### Other states

- **Loading**: Animated card with pulse icon and shimmer progress bar
- **Auth error**: "Connect to {providerName}" card with login button
- **Generic error**: Destructive alert with error message

## Playback Flow (End to End)

```
User presses Next
  -> usePlayerLogic.handleNext()
    -> sets expectedTrackIdRef to target track ID
    -> setCurrentTrackIndex(nextIndex)
    -> useProviderPlayback.playTrack(nextIndex, skipOnError=true)
      -> resolveTrackProvider(mediaTracksRef[nextIndex])
      -> pausePreviousProvider(resolvedProvider)    // handoff if provider changed
      -> currentPlaybackProviderRef.current = resolvedProvider
      -> descriptor.playback.playTrack(mediaTrack)  // Spotify SDK or HTML5 Audio
      -> on success: prepareTrack(nextTrack)         // pre-warm next
      -> on error: skip or surface auth prompt

Provider emits PlaybackState
  -> usePlaybackSubscription receives event
    -> filters by drivingProviderRef (ignores non-driving providers)
    -> expectedTrackIdRef check (ignores stale events during transition)
    -> syncs isPlaying, playbackPosition, currentTrackIndex to React state
    -> merges trackMetadata if present

Track nears end (timeRemaining <= 2000ms)
  -> useAutoAdvance detects near-end signal
    -> schedules advanceToNext after 100ms
      -> playTrack(currentIdx + 1, skipOnError=true)
```
