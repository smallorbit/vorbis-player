# Playback & Queue Mutation

## Playback flow

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

## Queue mutation flow

Queue state lives in `TrackContext` (`tracks`, `originalTracks`, `currentTrackIndex`, `shuffleEnabled`) and is mutated through `TrackOperations` (defined in `types/trackOperations.ts`). A parallel `mediaTracksRef` keeps an imperative mirror for index-based playback without waiting for React renders.

### Loading a collection (`useCollectionLoader.loadCollection`)

- Resolves the target provider and collection ref
- Fetches tracks via `catalog.listTracks(collectionRef)`
- Calls `applyTracks()` which stores `originalTracks`, optionally shuffles, sets `tracks` + `mediaTracksRef`, resets `currentTrackIndex` to 0, then calls `playTrack(0)`
- Unified Liked Songs path merges tracks from all connected providers sorted by `addedAt`

### Adding to queue (`useQueueManagement.handleAddToQueue`)

- If queue is empty, delegates to `loadCollection` (full load + autoplay)
- Otherwise fetches tracks via `catalog.listTracks` and appends to `tracks`, `originalTracks`, and `mediaTracksRef` without resetting `currentTrackIndex`
- Deduplicates by track ID before appending — tracks already in the queue are skipped

### Removing from queue (`handleRemoveFromQueue`)

- Blocks removal of the currently playing track (`index === currentTrackIndex`)
- Removes by index from `tracks`, by ID from `originalTracks` and `mediaTracksRef`
- Decrements `currentTrackIndex` if the removed track was before the current one
- If only one track remains, calls `handleBackToLibrary` (full reset)

### Reordering (`handleReorderQueue`)

- Uses `moveItemInArray` on `tracks`, then syncs `mediaTracksRef` via `reorderMediaTracksToMatchTracks`
- Recalculates `currentTrackIndex` by finding the playing track's ID in the new order
- Only updates `originalTracks` when shuffle is off

### Shuffle interaction (`TrackContext.handleShuffleToggle`)

- Enable: shuffles `originalTracks` (excluding current track), places current track first, resets index to 0
- Disable: restores `originalTracks`, finds current track's original index
- Persisted via `useLocalStorage`

### Queue change notification

`usePlayerLogic` calls `descriptor.playback.onQueueChanged?(tracks, currentTrackIndex)` whenever `tracks` or `currentTrackIndex` change, allowing providers with native queue sync (Spotify) to stay aligned.
