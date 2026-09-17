# Playback & Queue Mutation

## One playback engine

Playback state and the queue each have exactly one owner, both module-level
stores outside React (consumed via `useSyncExternalStore`):

- **`src/stores/playbackStore.ts`** owns `isPlaying`, `positionMs`,
  `durationMs`, `currentTrackId`, `drivingProviderId`, and every stale-event
  heuristic. React reads it through `usePlaybackState()`.
- **`src/stores/queueStore.ts`** owns `tracks`, `originalTracks`,
  `currentIndex`, and `shuffle`. React reads it through `TrackContext`
  (a thin `useSyncExternalStore` bridge that also carries load-status state:
  `isLoading` / `error` / `selection`).

### Subscription topology (there is only one)

```
Spotify adapter ──┐
Dropbox adapter ──┼── playbackStore.attach() ── event pipeline ──┬─ snapshot commit (isPlaying/position/duration/trackId)
mock adapter ─────┘   (single fan-out over                       ├─ queueStore.syncIndex / metadata overlay
                       providerRegistry.getAll())                └─ trackEnded emission (one per track)
```

`usePlayerLogic` attaches the store once (re-attaching when the active
provider changes, which re-primes state via `getState()`). Nothing else in
the app subscribes to provider playback events — `usePlaybackControls`,
`useAutoAdvance`, session persistence, and the player UI all read the store.
The attachment also owns the `visibilitychange` resync (drop transition
guards, re-pull `getState()` from the driving provider) and a 1 s position
poll that runs only while playing.

### Driving-provider resolution (one resolver)

`playbackStore.resolveDrivingProviderId(trackProvider?)` is the only
fallback chain in the codebase:

1. the track's own provider (when the operation is about a specific track),
2. `drivingProviderId` — the provider currently producing audio,
3. the active (UI-selected) provider, mirrored into the store by
   `usePlayerLogic` via `setActiveProviderFallback`.

`getDrivingDescriptor(trackProvider?)` is the descriptor form. Consumers:
the pipeline's event filter, `useProviderPlayback` (play/resume),
`usePlayerLogic` (play/pause/resume), `usePlaybackControls`,
`useQueueManagement`'s native-queue-sync notification, and the provider
badge in `AudioPlayer`.

### Stale-event heuristics (private store fields)

- **Transition guard** — `useProviderPlayback.playTrack` calls
  `beginTransition(trackId)` before ANY adapter call (pause of the previous
  provider, `playTrack`, the next-track `prepareTrack` pre-warm). While the
  guard is up, provider events for other track ids cannot flip the queue
  index; the event for the expected track consumes the guard. Session
  restore raises the same guard before starting playback.
- **Seek guard** — `playbackStore.seek(positionMs)` commits the target
  optimistically and rejects stale pre-seek position emits until one lands
  within 2 s of the expected post-seek position (5 s safety window so the
  cursor can never get stuck; #1671).
- **Ended detection** — near-end thresholds plus "was playing, now paused at
  0" outside a 5 s post-play buffering cooldown. Emits `trackEnded` at most
  once per track.

Newest-wins races (mashing next, superseded loads) are guarded by
`useNewestWins` (`src/hooks/useNewestWins.ts`) at the operation level:
`useProviderPlayback.playTrack`, `useCollectionLoader`, radio generation,
accent-color extraction, and the queue enrichment loaders all use it.

## Playback flow

1. **User triggers play/next/previous** — `usePlayerLogic` dispatches via
   `handlePlay` / `handleNext` / `handlePrevious`, reading the queue
   synchronously from `queueStore`.
2. **Provider resolution** — `useProviderPlayback.playTrack(index)` resolves
   the provider via `resolveDrivingProviderId(track.provider)`.
3. **Cross-provider handoff** — pauses the previous driving provider when it
   changed, then `setDrivingProvider(next)`.
4. **Transition guard + newest-wins claim** — `beginTransition(track.id)`,
   then a `useNewestWins` token so an overlapping `playTrack` that resolves
   late cannot commit its stale index or fire its pre-warm.
5. **Adapter playback** — `descriptor.playback.playTrack(track)` (Spotify
   SDK or HTML5 Audio). On success: `queueStore.setCurrentIndex(index)` and
   the next track's provider gets a `prepareTrack` pre-warm.
6. **State flow-back** — provider events land in the store pipeline (see
   topology above): snapshot commit, guarded queue-index sync, metadata
   overlays (`queueStore.mapTracks`), ended detection.
7. **Auto-advance** — `useAutoAdvance` subscribes to `trackEnded` and owns
   only policy: wait `AUTO_ADVANCE_DELAY_MS`, re-read the live queue, stop
   at the end, else `playTrack(next, skipOnError=true)`. Pending advances
   cancel when the queue or index changes.
8. **Error recovery** — `UnavailableTrackError` and generic errors auto-skip
   to the next track when `skipOnError` is set; `AuthExpiredError` surfaces
   a re-auth prompt.

Key files: `usePlayerLogic.ts` → `useProviderPlayback.ts` →
`stores/playbackStore.ts` (+ `PlaybackProvider` interface in
`types/providers.ts`) → `stores/queueStore.ts` → `useAutoAdvance.ts`.

## Session restore

`usePlayerLogic.restoreSession(session, { autoplay })` is the single restore
path, shared by the landing page's hydrate flow (`autoplay: false` — prime
the player, wait for the user's play press) and the Resume card
(`autoplay: true` — start playback immediately):

- Replaces the queue, then iterates candidates starting at the saved track:
  skips tracks whose provider is missing/unauthenticated, probes
  `probePlayable` where available, and falls forward through the queue
  (bounded by one full pass). Only the first candidate gets the saved
  position; fallbacks start at zero.
- `autoplay: false` primes: `prepareTrack`, transition guard, driving
  provider, paused snapshot at the saved position, and stashes a pending
  play that the next `handlePlay` consumes.
- `autoplay: true` starts playback via `playTrack(candidate, { positionMs })`.
- Total failure (nothing playable) resets to the library and reports
  `totalFailure: true`; callers clear the saved session and toast.

## Queue mutation flow

All queue mutations go through `queueStore` mutators — there is no parallel
mirror to keep in sync. Store reads are synchronous, which is what
index-based playback needs on iOS Safari (`audio.play()` must stay inside
the user-gesture call stack).

### Loading a collection (`useCollectionLoader.loadCollection`)

- Takes a typed `CollectionSelection` and resolves the target provider and
  `CollectionRef`; fetched lists are write-through cached (`putTrackList`)
  for cache-backed consumers (CmdK search).
- `queueStore.loadQueue(tracks, { forceShuffle })` stores `originalTracks`
  in collection order, shuffles the play order when the shuffle flag (or
  All Music) demands it, resets `currentIndex`, then the loader calls
  `playTrack(0)`.
- Returns `{ status: 'loaded', count } | { status: 'superseded' } |
  { status: 'empty' }` — superseded loads surface no UI.
- Unified Liked Songs merges all connected providers, sorted by `addedAt`.

### Adding to queue (`useQueueManagement`)

Rebuilt on two primitives: `fetchCollectionTracks` (resolve + fetch) and
`queueStore.addTracks(tracks, { position: 'end' | 'next' })`. The store owns
the append invariant in one place: dedupe by id, populate an empty queue
directly, and — while shuffle is ON — append only the new tracks to
`originalTracks` (a shuffled position has no meaningful unshuffled slot);
while OFF, `originalTracks` mirrors the play order. An empty queue delegates
to `loadCollection` (full load + autoplay).

### Removing / reordering

- `handleRemoveFromQueue` keeps policy (refuse removing the playing track;
  back-to-library when the queue would empty) and calls
  `queueStore.removeTrackAt(index)`, which adjusts `currentIndex` when the
  removal is before it.
- `handleReorderQueue` → `queueStore.reorderTrack(from, to)`; the index
  follows the playing track; `originalTracks` tracks manual order only while
  shuffle is off.
- Provider disconnect → `queueStore.removeTracksByProvider(id)`.

### Shuffle (`queueStore.toggleShuffle`)

- Enable: current track pinned first, rest shuffled from live track objects
  (`originalTracks` objects may be stale), index 0.
- Disable: reorder live tracks by `originalTracks` id order, find the
  playing track's restored index.
- The flag persists to localStorage under the `vorbis-player-` prefix.

### Queue change notification

Two call sites push queue snapshots to the driving provider, both gated on
`capabilities.hasNativeQueueSync`: `useQueueManagement.notifyQueueChanged`
(user-driven mutations) and `useProviderPlayback.playTrack` (track
transitions). Both resolve the target via
`playbackStore.getDrivingDescriptor()` so the SDK whose queue is mirrored
receives the update.

## Race-testing the engine

`src/test/asyncRace.ts` provides the deferred/out-of-order primitives; the
engine's races are covered against the stores' public APIs in
`src/stores/__tests__/playbackStore.test.ts` (event pipeline, guards,
attach/detach races) and `src/stores/__tests__/queueStore.test.ts`
(mutation invariants), plus `useNewestWins` for operation-level supersedence.
