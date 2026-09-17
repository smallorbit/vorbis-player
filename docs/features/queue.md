# Queue System

## Terminology

**Queue** = the ordered list of tracks scheduled to play. Users can reorder, remove, and add tracks. Displayed in `QueueDrawer` (desktop) and `QueueBottomSheet` (mobile).

**Playlist** = a library collection from a provider (Spotify playlist, Dropbox folder, Liked Songs). Browsed via `PlaylistSelection`, loaded into the queue via `useCollectionLoader`.

Loading a playlist replaces the queue. Adding a playlist appends to it.

## State Shape

Queue state (`tracks` / `originalTracks` / `currentIndex` / `shuffle`) is owned by `queueStore` (`src/stores/queueStore.ts`), a module-level store outside React. `TrackContext` (`src/contexts/TrackContext.tsx`) is the thin React read bridge over it (via `useSyncExternalStore`), split into two contexts for render optimization; it also carries the remaining load-status state (`isLoading` / `error` / `selection`).

### queueStore

```ts
interface QueueSnapshot {
  tracks: MediaTrack[];          // current playback order (shuffled or original)
  originalTracks: MediaTrack[];  // pre-shuffle order, used to restore on unshuffle
  currentIndex: number;
  shuffle: boolean;              // persisted to localStorage (key: vorbis-player-shuffle-enabled)
}
```

Every mutation goes through a store mutator (`loadQueue`, `replaceQueue`, `addTracks`, `removeTrackAt`, `removeTracksByProvider`, `reorderTrack`, `setCurrentIndex`, `syncIndexToTrackId`, `mapTracks`, `toggleShuffle`, `clear`) — never through React state, so the dedupe/shuffle/index invariants hold by construction. Reads (`getTracks()`, `getCurrentIndex()`, `getCurrentTrack()`, `getSnapshot()`) are synchronous, which is what index-based playback needs on iOS Safari (`audio.play()` must stay inside the user-gesture call stack). There is no parallel mirror to keep in sync.

### TrackListContext

```ts
interface TrackListContextValue {
  tracks: MediaTrack[];              // read from queueStore
  originalTracks: MediaTrack[];      // read from queueStore
  isLoading: boolean;
  error: string | null;
  shuffleEnabled: boolean;           // queueStore's shuffle flag
  selection: PlaybackSelection | null; // typed identity of what's loaded (collection / liked / radio)
  // + setters for isLoading/error/selection only (queue content has no context setters)
  handleShuffleToggle: () => void;   // delegates to queueStore.toggleShuffle
}
```

### CurrentTrackContext

```ts
interface CurrentTrackContextValue {
  currentTrack: MediaTrack | null;       // derived: tracks[currentTrackIndex] || null
  currentTrackIndex: number;             // queueStore's currentIndex
  showQueue: boolean;                    // controls QueueDrawer/QueueBottomSheet visibility
  setShowQueue: (visible: boolean | ((prev: boolean) => boolean)) => void;
}
```

### TrackOperations

Defined in `src/types/trackOperations.ts`. The load-status setter bag passed to hooks that load the queue:

```ts
interface TrackOperations {
  setSelection: (selection: PlaybackSelection | null) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
}
```

Queue content itself is mutated through `queueStore`, never through these. Constructed once in `usePlayerLogic` via `useMemo` and passed to `useCollectionLoader`, `useRadioSession`, and `useSpotifyPlaylistManager`.

## Queue Mutation Flows

### Load Collection

**Hook:** `useCollectionLoader` (`src/hooks/useCollectionLoader.ts`)

**Entry:** `loadCollection(selection: CollectionSelection)` -- replaces the entire queue. `CollectionSelection` (from `src/types/domain.ts`) is `{ type: 'collection', ref: CollectionRef, name? }` or `{ type: 'liked', provider?, name? }`.

1. If radio is active, stops it (`stopRadioBase()`).
2. Routes based on the selection:
   - `type: 'liked'` with no pinned provider + unified liked active -> `loadUnifiedLiked()` (merges liked tracks from all connected providers, sorted by `addedAt` descending).
   - Otherwise -> `loadProviderCollection()`.
3. `loadProviderCollection` uses `selection.ref` directly (or builds `{ provider, kind: 'liked' }` for a provider-pinned liked selection), then calls `catalog.listTracks(collectionRef)`. The fetched list is write-through cached into the shared library cache (`putTrackList`) so cache-backed consumers (e.g. CmdK search) can see any opened collection.
4. If `listTracks` returns 0 tracks and the target descriptor declares `capabilities.hasContextPlaybackFallback` (Spotify only), falls back to `loadContextPlayback` — a thin wrapper (`useSpotifyPlaylistManager`, `src/providers/spotify/useSpotifyPlaylistManager.ts`) over `descriptor.playback.playCollection` that mirrors the SDK's track window into the app queue.
5. `queueStore.loadQueue(tracks, { forceShuffle })` stores `originalTracks` in collection order, shuffles the play order when `shuffleEnabled` (or `forceShuffle` — the All Music pseudo-collection), and resets `currentIndex` to 0. The loader then sets the driving provider and calls `playTrack(0)`.

**Return type:** `LoadCollectionResult` — `{ status: 'loaded', count } | { status: 'superseded' } | { status: 'empty' }`. A superseded load (a newer load or direct-play claimed the `useNewestWins` guard) surfaces no UI.

**Invariant:** `loadCollection` always resets `currentIndex` to 0. The previous queue is fully replaced.

**Also:** `playTracksDirectly(tracks, selection)` -- same as loadCollection (including the `LoadCollectionResult` return) but accepts pre-fetched tracks (used by liked-songs direct play from the library).

### Add to Queue

**Hook:** `useQueueManagement` (`src/hooks/useQueueManagement.ts`)

**Entry:** `handleAddToQueue(selection: CollectionSelection)` (append) and `insertCollectionNext(selection)` (insert after the current track). Both route through a shared `addCollection(selection, position)` built on two primitives: `fetchCollectionTracks` (resolve + fetch) and `queueStore.addTracks(tracks, { position: 'end' | 'next' })`.

1. If queue is empty, delegates to `loadCollection` (full load + autoplay). A `superseded` result surfaces no toast.
2. Otherwise:
   - Resolves the provider descriptor and collection ref from the selection.
   - Fetches tracks via `fetchCollectionTracks` (`catalog.listTracks(collectionRef)`; the All Music pseudo-collection is pre-shuffled).
   - `queueStore.addTracks(fetched, { position })` — the single append path. The store **deduplicates** by track ID against the current queue (already-present tracks are silently skipped), populates an empty queue directly, and keeps the shuffle-aware `originalTracks` invariant (see Shuffle below).
   - Does NOT reset `currentIndex`.
   - `notifyQueueChanged()` pushes the new queue to the driving provider when it declares `hasNativeQueueSync`.
3. Returns `{ added: number, collectionName?: string }` or `null` (all duplicates, failure, or superseded).

**Also:** `queueTracksDirectly(tracks, collectionName?)` / `insertTracksNext(tracks, collectionName?)` -- same append/insert logic but accept pre-fetched `MediaTrack[]` directly (used by radio and liked-songs queueing).

### Remove from Queue

**Entry:** `handleRemoveFromQueue(index)`

**Rules** (policy in the hook, mechanics in the store):
- Cannot remove the currently playing track (`index === currentIndex` -> no-op).
- If only 1 track remains, calls `handleBackToLibrary()` (full reset to idle state).
- Otherwise `queueStore.removeTrackAt(index)` removes from `tracks` by index and from `originalTracks` by ID.
- If the removed track was before `currentIndex`, the store decrements `currentIndex` by 1.
- `notifyQueueChanged()` afterwards.

### Reorder Queue

**Entry:** `handleReorderQueue(fromIndex, toIndex)`

1. Bounds-checks, then calls `queueStore.reorderTrack(fromIndex, toIndex)`.
2. Inside the store: `currentIndex` follows the currently playing track's ID in the new order.
3. `originalTracks` only tracks the new order when shuffle is OFF. When shuffle is ON, it preserves the pre-shuffle order.
4. `notifyQueueChanged()` afterwards.

**Also:** provider disconnect removes that provider's tracks via `queueStore.removeTracksByProvider(id)`.

## Shuffle

**Location:** `queueStore.toggleShuffle` (exposed to the UI as `handleShuffleToggle` on `TrackListContext`)

### Enable shuffle
1. Takes the current `tracks` array.
2. Filters out the currently playing track.
3. Shuffles the rest via `shuffleArray()` (using live track objects — `originalTracks` objects may be stale).
4. Prepends the current track at index 0.
5. Sets `currentIndex` to 0.
6. `originalTracks` is NOT modified (it preserves the original load order for restore).

### Disable shuffle
1. Reorders `tracks` to match `originalTracks` order by ID.
2. Tracks that were added after the original load (queue additions) are appended at the end.
3. Finds the currently playing track's position in the restored order.
4. Updates `currentIndex` to the found position.

**Invariant:** `originalTracks` represents the canonical unshuffled order. Shuffle only reorders `tracks`. While shuffle is OFF, `originalTracks` mirrors the play order; while ON, appends go to the END of `originalTracks` (a shuffled queue position has no meaningful unshuffled slot).

**Persistence:** the shuffle flag is stored in localStorage (key: `vorbis-player-shuffle-enabled`), read at store init and written on toggle.

## Cross-Provider Queue

Tracks are provider-agnostic `MediaTrack` records (defined in `src/types/domain.ts`). Each track carries a `provider: ProviderId` field. A single queue can mix Spotify and Dropbox tracks.

When playback advances to a track from a different provider:
- `useProviderPlayback.playTrack(index)` resolves the provider for that track via `playbackStore.resolveDrivingProviderId(track.provider)`: `track.provider` -> driving provider -> active-provider fallback.
- `pausePreviousProvider()` pauses the old provider, then `playbackStore.setDrivingProvider()` commits the new one.
- The new provider's `playback.playTrack(mediaTrack)` is called.

The **driving provider** (the one currently controlling audio output) can differ from the **active provider** (the one selected for browsing). This happens in unified liked songs, radio queues, or manual cross-provider additions.

## Queue Change Notification

The driving provider's `onQueueChanged` is invoked only when that provider declares the `hasNativeQueueSync` capability. Two call sites:

- **Track transitions** (`useProviderPlayback.playTrack`, `src/hooks/useProviderPlayback.ts`):

```ts
if (descriptor.capabilities.hasNativeQueueSync) {
  descriptor.playback.onQueueChanged?.(tracks, index);
}
```

- **User-driven mutations** (`useQueueManagement.ts`, via the `notifyQueueChanged` helper) for add/remove/reorder, which resolves the target via `playbackStore.getDrivingDescriptor()` and checks `driving.capabilities?.hasNativeQueueSync` before calling.

- **Spotify adapter** (`src/providers/spotify/spotifyPlaybackAdapter.ts`): uses this to build upcoming URIs for Spotify's native queue sync.
- **Dropbox adapter** (`src/providers/dropbox/dropboxPlaybackAdapter.ts`): no-op.

The `onQueueChanged` method is optional on `PlaybackProvider` (`src/types/providers.ts` line 144).

## UI Components

### QueueDrawer (desktop)

**File:** `src/components/QueueDrawer.tsx`

- Renders via `createPortal` to `document.body`.
- Fixed position, slides in from the right.
- Responsive width calculated from `usePlayerSizingContext()` viewport dimensions.
- Lazy-loads `QueueTrackList` via `React.lazy`.
- Uses `hasBeenOpenedRef` to defer initial mount until first open (avoids rendering the hidden drawer on page load).
- Wrapped in `React.memo` with custom `areQueueDrawerPropsEqual` comparator that checks `isOpen`, `currentTrackIndex`, `tracks.length`, track order (by ID string join), `radioActive`, `radioSeedDescription`, and `canSaveQueue`. Callback props are assumed stable.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Controls slide animation |
| `onClose` | `() => void` | Close handler |
| `tracks` | `MediaTrack[]` | Current queue |
| `currentTrackIndex` | `number` | Highlighted track |
| `onTrackSelect` | `(index: number) => void` | Jump to track |
| `onRemoveTrack` | `(index: number) => void` | Remove from queue |
| `onReorderTracks` | `(from, to) => void` | Drag-and-drop reorder |
| `showProviderIcons` | `boolean` | Show provider badge per track |
| `radioActive` | `boolean` | Changes title to "Radio" |
| `radioSeedDescription` | `string \| null` | Subtitle when radio is active |
| `onSaveQueue` | `() => void` | Opens SaveQueueDialog |
| `canSaveQueue` | `boolean` | Whether save button is shown |

### QueueBottomSheet (mobile)

**File:** `src/components/QueueBottomSheet.tsx`

- Same portal/lazy-load/defer pattern as QueueDrawer.
- Slides up from bottom, 66dvh height.
- Swipe-to-dismiss via `useVerticalSwipeGesture` on the header grip pill (threshold: 80px).
- Same props interface as QueueDrawer.

### QueueTrackList

**File:** `src/components/QueueTrackList.tsx`

Renders the track list inside either drawer. Three rendering modes:

1. **Touch device without reorder support:** Renders `SwipeableQueueItem` components (swipe-to-reveal actions).
2. **Desktop/touch with reorder support:** Renders `SortableQueueItem` inside `@dnd-kit/core` `DndContext` + `SortableContext` for drag-and-drop.
3. **Read-only (no `onRemoveTrack` or `onReorderTracks`):** Plain `QueueListItem` elements.

**Edit mode:** Toggled via an "Edit"/"Done" button. Available when `canEdit` is true and queue management callbacks are provided.

**"Play Next" action:** `handlePlayNext(index)` reorders the selected track to `currentTrackIndex + 1`.

**Scroll behavior:** On open, scrolls the current track into view (smooth, centered) after a 100ms delay.

**Sortable IDs:** `${track.name}-${track.id}` -- combined to handle duplicate IDs across providers.

**DnD sensors:** `PointerSensor` (8px activation distance), `TouchSensor` (250ms delay, 5px tolerance).

Each track item shows: album art thumbnail, play icon (for current track), provider icon (optional), track name, artist, duration, liked indicator.

### DrawerOrchestrator

**File:** `src/components/PlayerContent/DrawerOrchestrator.tsx`

Orchestrates both queue and library drawers. Decides between `QueueDrawer` (desktop) and `QueueBottomSheet` (mobile) based on `isMobile` prop. Also manages:
- `SaveQueueDialog` (lazy-loaded, shown when save button clicked).
- Toast notifications for add-to-queue results.
- `RadioProgressToast` for radio generation feedback.
- Provider icon visibility logic: shows icons when unified liked songs are loaded or radio is active.

## Swipe Gestures

Queue drawer is toggled by:
- **Swipe up on album art** (from `useKeyboardShortcuts` / swipe gesture handlers in the player content area).
- **Keyboard:** `Q` or `Up Arrow` (desktop).
- **QueueBottomSheet:** swipe down on grip pill to dismiss.
- **QueueDrawer:** click overlay to dismiss.

Cross-dismiss behavior: opening the queue closes the library drawer, and vice versa.

## Key Files

| File | Role |
|------|------|
| `src/stores/queueStore.ts` | Queue state owner (tracks, originalTracks, currentIndex, shuffle) + mutation invariants |
| `src/contexts/TrackContext.tsx` | React read bridge over queueStore + load-status state (isLoading/error/selection) |
| `src/types/trackOperations.ts` | TrackOperations interface (load-status setter bag) |
| `src/hooks/usePlayerLogic.ts` | Orchestrates queue mutations, playback, session restore |
| `src/hooks/useQueueManagement.ts` | Add, remove, reorder queue operations (policy over queueStore) |
| `src/hooks/useCollectionLoader.ts` | Load/replace queue from a collection |
| `src/components/QueueDrawer.tsx` | Desktop queue UI |
| `src/components/QueueBottomSheet.tsx` | Mobile queue UI (bottom sheet) |
| `src/components/QueueTrackList.tsx` | Track list rendering with DnD |
| `src/components/QueueTrackItem.tsx` | Individual track items (sortable + swipeable variants) |
| `src/components/PlayerContent/DrawerOrchestrator.tsx` | Drawer switching (mobile vs desktop) |
| `src/constants/playlist.ts` | LIKED_SONGS_ID / ALL_MUSIC_PIN_ID pin ids, isAllMusicRef |

## Gotchas

1. **Mutate the queue only through `queueStore`.** There is no context setter for queue content — components read via `TrackContext` (React) or `queueStore.getSnapshot()` (imperative), and every mutation goes through a store mutator so the dedupe/shuffle/index invariants hold by construction. Playback index lookup (`queueStore.getTracks()[index]`) is a synchronous store read, so there is no mirror to fall out of sync.

2. **Deduplication is by track ID only.** If a track appears in multiple collections with the same ID, only the first instance is kept. This is intentional to prevent duplicate playback.

3. **Reorder does not update originalTracks when shuffle is ON.** This preserves the ability to restore the original order on unshuffle. Queue additions always append to both arrays.

4. **Cannot remove the currently playing track.** The UI should disable the remove action for the track at `currentTrackIndex`. The hook silently no-ops if attempted.

5. **QueueDrawer memo comparator assumes stable callbacks.** If a parent passes an unstable `onClose` or `onTrackSelect`, the memo will incorrectly suppress re-renders. All callback props must be wrapped in `useCallback`.

6. **Empty queue triggers back-to-library.** Removing the last non-playing track calls `handleBackToLibrary()`, which fully resets player state to idle.

7. **Shuffle preserves current track at index 0.** The currently playing track is always first in the shuffled order. `currentTrackIndex` is reset to 0 on shuffle enable.
