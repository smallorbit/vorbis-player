# Queue System

## Terminology

**Queue** = the ordered list of tracks scheduled to play. Users can reorder, remove, and add tracks. Displayed in `QueueDrawer` (desktop) and `QueueBottomSheet` (mobile).

**Playlist** = a library collection from a provider (Spotify playlist, Dropbox folder, Liked Songs). Browsed via `PlaylistSelection`, loaded into the queue via `useCollectionLoader`.

Loading a playlist replaces the queue. Adding a playlist appends to it.

## State Shape

Queue state lives in `TrackContext` (`src/contexts/TrackContext.tsx`), split into two React contexts for render optimization:

### TrackListContext

```ts
interface TrackListContextValue {
  tracks: MediaTrack[];              // current playback order (shuffled or original)
  originalTracks: MediaTrack[];      // pre-shuffle order, used to restore on unshuffle
  isLoading: boolean;
  error: string | null;
  shuffleEnabled: boolean;           // persisted via useLocalStorage (key: vorbis-player-shuffle)
  selectedPlaylistId: string | null; // ID of the loaded collection
  // + setters for all above
  handleShuffleToggle: () => void;
}
```

### CurrentTrackContext

```ts
interface CurrentTrackContextValue {
  currentTrack: MediaTrack | null;       // derived: tracks[currentTrackIndex] || null
  currentTrackIndex: number;
  setCurrentTrackIndex: (index: number | ((prev: number) => number)) => void;
  showQueue: boolean;                    // controls QueueDrawer/QueueBottomSheet visibility
  setShowQueue: (visible: boolean | ((prev: boolean) => boolean)) => void;
}
```

### mediaTracksRef

`usePlayerLogic` maintains `mediaTracksRef: React.MutableRefObject<MediaTrack[]>` -- an imperative mirror of `tracks` that allows index-based playback without waiting for React renders. It is updated synchronously on every mutation **before** `setTracks` is called.

```ts
// src/hooks/usePlayerLogic.ts
const mediaTracksRef = useRef(tracks);
mediaTracksRef.current = tracks;  // kept in sync every render
```

This ref is passed into `TrackOperations` and consumed by `useProviderPlayback` and `useCollectionLoader`.

### TrackOperations

Defined in `src/types/trackOperations.ts`. A bag of setters passed to hooks that mutate the queue:

```ts
interface TrackOperations {
  setTracks: (tracks: MediaTrack[] | ((prev: MediaTrack[]) => MediaTrack[])) => void;
  setOriginalTracks: (tracks: MediaTrack[] | ((prev: MediaTrack[]) => MediaTrack[])) => void;
  setCurrentTrackIndex: (index: number | ((prev: number) => number)) => void;
  setSelectedPlaylistId: (id: string | null) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  mediaTracksRef: React.MutableRefObject<MediaTrack[]>;
}
```

Constructed once in `usePlayerLogic` via `useMemo` and passed to `useCollectionLoader` and `useQueueManagement`.

## Queue Mutation Flows

### Load Collection

**Hook:** `useCollectionLoader` (`src/hooks/useCollectionLoader.ts`)

**Entry:** `loadCollection(playlistId, provider?)` -- replaces the entire queue.

1. If radio is active, stops it (`stopRadioBase()`).
2. Routes based on collection type:
   - `LIKED_SONGS_ID` + unified liked active + no explicit provider -> `loadUnifiedLiked()` (merges liked tracks from all connected providers, sorted by `addedAt` descending).
   - Otherwise -> `loadProviderCollection()`.
3. `loadProviderCollection` resolves the collection ref via `resolvePlaylistRef(playlistId, providerId)` -> `{ id, kind }`, then calls `catalog.listTracks(collectionRef)`.
4. If `listTracks` returns 0 tracks and `playback.playCollection` exists (Spotify context playback), falls back to `loadContextPlayback`.
5. `applyTracks(tracks)` stores `originalTracks`, optionally shuffles if `shuffleEnabled`, sets `tracks` + `mediaTracksRef`, resets `currentTrackIndex` to 0, then calls `playTrack(0)`.

**Invariant:** `loadCollection` always resets `currentTrackIndex` to 0. The previous queue is fully replaced.

**Also:** `playTracksDirectly(tracks, collectionId, provider?)` -- same as loadCollection but accepts pre-fetched tracks (used by liked-songs direct play from the library).

### Add to Queue

**Hook:** `useQueueManagement` (`src/hooks/useQueueManagement.ts`)

**Entry:** `handleAddToQueue(playlistId, collectionName?, provider?)`

1. If queue is empty, delegates to `loadCollection` (full load + autoplay).
2. Otherwise:
   - Resolves provider descriptor and collection ref.
   - Fetches tracks via `catalog.listTracks(collectionRef)`.
   - **Deduplicates** by track ID: builds `Set` of existing track IDs, filters new tracks. Already-present tracks are silently skipped.
   - Appends unique tracks to `mediaTracksRef`, `originalTracks`, and `tracks`.
   - Does NOT reset `currentTrackIndex`.
3. Returns `{ added: number, collectionName?: string }` or `null` on failure.

**Also:** `queueTracksDirectly(tracks, collectionName?)` -- same append logic but accepts pre-fetched `MediaTrack[]` directly (used by radio and liked-songs queueing).

### Remove from Queue

**Entry:** `handleRemoveFromQueue(index)`

**Rules:**
- Cannot remove the currently playing track (`index === currentTrackIndex` -> no-op).
- If only 1 track remains, calls `handleBackToLibrary()` (full reset to idle state).
- Removes from `mediaTracksRef` by ID, from `originalTracks` by ID, from `tracks` by index.
- If the removed track was before `currentTrackIndex`, decrements `currentTrackIndex` by 1.

### Reorder Queue

**Entry:** `handleReorderQueue(fromIndex, toIndex)`

1. `moveItemInArray(tracks, fromIndex, toIndex)` produces new array.
2. `reorderMediaTracksToMatchTracks(newTracks, mediaTracksRef)` syncs the imperative mirror **synchronously** before `setTracks`.
3. Recalculates `currentTrackIndex` by finding the currently playing track's ID in the new order.
4. Only updates `originalTracks` when shuffle is OFF. When shuffle is ON, `originalTracks` preserves the pre-shuffle order.

## Shuffle

**Location:** `TrackContext.handleShuffleToggle`

### Enable shuffle
1. Takes the current `tracks` array.
2. Filters out the currently playing track.
3. Shuffles the rest via `shuffleArray()`.
4. Prepends the current track at index 0.
5. Sets `currentTrackIndex` to 0.
6. `originalTracks` is NOT modified (it preserves the original load order for restore).

### Disable shuffle
1. Reorders `tracks` to match `originalTracks` order by ID.
2. Tracks that were added after the original load (queue additions) are appended at the end.
3. Finds the currently playing track's position in the restored order.
4. Updates `currentTrackIndex` to the found position.

**Invariant:** `originalTracks` represents the canonical order. Shuffle only reorders `tracks`. Queue additions append to both.

**Persistence:** `shuffleEnabled` is stored in localStorage via `useLocalStorage` (key: `vorbis-player-shuffle`).

## Cross-Provider Queue

Tracks are provider-agnostic `MediaTrack` records (defined in `src/types/domain.ts`). Each track carries a `provider: ProviderId` field. A single queue can mix Spotify and Dropbox tracks.

When playback advances to a track from a different provider:
- `useProviderPlayback.playTrack(index)` resolves the provider for that track: `track.provider` -> `drivingProviderRef` -> `activeDescriptor.id` fallback.
- `pausePreviousProvider()` pauses the old provider.
- The new provider's `playback.playTrack(mediaTrack)` is called.

The **driving provider** (the one currently controlling audio output) can differ from the **active provider** (the one selected for browsing). This happens in unified liked songs, radio queues, or manual cross-provider additions.

## Queue Change Notification

`usePlayerLogic` calls the driving provider's `onQueueChanged` whenever `tracks` or `currentTrackIndex` change:

```ts
// src/hooks/usePlayerLogic.ts ~line 142
descriptor?.playback.onQueueChanged?.(tracks, currentTrackIndex);
```

- **Spotify adapter** (`src/providers/spotify/spotifyPlaybackAdapter.ts`): uses this to build upcoming URIs for Spotify's native queue sync.
- **Dropbox adapter** (`src/providers/dropbox/dropboxPlaybackAdapter.ts`): no-op.

The `onQueueChanged` method is optional on `PlaybackProvider` (`src/types/providers.ts` line 89).

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
| `src/contexts/TrackContext.tsx` | Queue state (tracks, originalTracks, currentTrackIndex, shuffle) |
| `src/types/trackOperations.ts` | TrackOperations interface (setter bag) |
| `src/hooks/usePlayerLogic.ts` | Orchestrates queue mutations, playback, onQueueChanged |
| `src/hooks/useQueueManagement.ts` | Add, remove, reorder queue operations |
| `src/hooks/useCollectionLoader.ts` | Load/replace queue from a collection |
| `src/utils/queueTrackMirror.ts` | Imperative array helpers (reorder, remove, append, move) |
| `src/components/QueueDrawer.tsx` | Desktop queue UI |
| `src/components/QueueBottomSheet.tsx` | Mobile queue UI (bottom sheet) |
| `src/components/QueueTrackList.tsx` | Track list rendering with DnD |
| `src/components/QueueTrackItem.tsx` | Individual track items (sortable + swipeable variants) |
| `src/components/PlayerContent/DrawerOrchestrator.tsx` | Drawer switching (mobile vs desktop) |
| `src/constants/playlist.ts` | LIKED_SONGS_ID, resolvePlaylistRef, ID encoding |

## Gotchas

1. **mediaTracksRef must be updated synchronously** before `setTracks`. Playback index lookup reads from `mediaTracksRef.current`, not from React state. If the ref is stale during a render cycle, the wrong track will play.

2. **Deduplication is by track ID only.** If a track appears in multiple collections with the same ID, only the first instance is kept. This is intentional to prevent duplicate playback.

3. **Reorder does not update originalTracks when shuffle is ON.** This preserves the ability to restore the original order on unshuffle. Queue additions always append to both arrays.

4. **Cannot remove the currently playing track.** The UI should disable the remove action for the track at `currentTrackIndex`. The hook silently no-ops if attempted.

5. **QueueDrawer memo comparator assumes stable callbacks.** If a parent passes an unstable `onClose` or `onTrackSelect`, the memo will incorrectly suppress re-renders. All callback props must be wrapped in `useCallback`.

6. **Empty queue triggers back-to-library.** Removing the last non-playing track calls `handleBackToLibrary()`, which fully resets player state to idle.

7. **Shuffle preserves current track at index 0.** The currently playing track is always first in the shuffled order. `currentTrackIndex` is reset to 0 on shuffle enable.
