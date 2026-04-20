# Library Browser System

## Overview

The library browser shows the user's music collections (playlists, albums, liked songs) across all connected providers. It appears in two contexts:

1. **Idle/home view** -- rendered inline by `PlayerStateRenderer` when no track is loaded.
2. **Full-screen library** -- `LibraryPage` opened during playback via swipe-down on album art, BottomBar library button, `L` key, or `Down Arrow`.

Both contexts render `LibraryPage` (default export from `src/components/PlaylistSelection/index.tsx`).

## LibraryPage

**File:** `src/components/PlaylistSelection/index.tsx`

`LibraryPage` is the full-screen library view. It replaces the former `LibraryDrawer` slide-down overlay.

- Rendered in `AudioPlayer.tsx` via `React.lazy` when `state.showLibrary` is true.
- `showLibrary` state lives in `usePlayerLogic`. Toggled via `handleOpenLibrary` / `handleCloseLibrary`.
- Uses `PageContainer` + `PageSelectionCard` layout (centered, max-width constrained).
- Accepts an optional `footer` prop used to render `ResumeCard`.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `onPlaylistSelect` | `(id, name, provider?) => void` | Fires when user picks a collection |
| `onAddToQueue` | `(id, name?, provider?) => Promise<AddToQueueResult \| null>` | Append to existing queue |
| `onPlayLikedTracks` | `(tracks, collectionId, name, provider?) => Promise<void>` | Direct play of liked tracks |
| `onQueueLikedTracks` | `(tracks, name?) => void` | Queue liked tracks |
| `footer` | `React.ReactNode` | Optional footer (used for `ResumeCard`) |

**Library refresh** dispatches a `vorbis-library-refresh` custom event and shows a spinner for a minimum of 1500ms.

## LibraryContext

**File:** `src/components/PlaylistSelection/LibraryContext.tsx`

Library state is split into four focused sub-contexts, each consumed independently to avoid unnecessary re-renders:

| Context | Provider | Hook | Contents |
|---------|----------|------|----------|
| `LibraryBrowsingContext` | `LibraryBrowsingProvider` | `useLibraryBrowsingContext()` | viewMode, searchQuery, sort, filters |
| `LibraryPinContext` | `LibraryPinProvider` | `useLibraryPins()` | pinned/unpinned collections, pin actions |
| `LibraryActionsContext` | `LibraryActionsProvider` | `useLibraryActions()` | click/context-menu callbacks |
| `LibraryDataContext` | `LibraryDataProvider` | `useLibraryData()` | albums, liked songs, provider data |

`LibraryContextValue` is the union of all four interfaces (used internally).

## Browse Flow

### Provider Selection -> Collection List -> Track List

1. User opens the library (idle view or full-screen).
2. `useLibrarySync` has already fetched and cached collections from all connected providers.
3. User selects "Playlists" or "Albums" tab (`viewMode`).
4. Collections are filtered and sorted via `playlistFilters.ts`:
   - `filterPlaylistsOnly(items, searchQuery)` / `filterAlbumsOnly(items, searchQuery, yearFilter)` -- text matching on name, description, owner/artist.
   - `buildLibraryViewWithPins(filtered, pinnedIds, getId, sortFn)` -- splits into pinned (sorted to top) and unpinned groups, applies sort within each group.
5. User clicks a collection -> `onPlaylistSelect(id, name, provider)` fires.
6. `handleCloseLibrary()` is called first, then `handlePlaylistSelect` triggers `useCollectionLoader.loadCollection` which replaces the queue and starts playback.

### Provider toggle

When multiple providers are connected, `LibraryProviderBar` shows toggle buttons. `handleProviderToggle(provider)` filters the displayed collections:
- First toggle activates only that provider.
- Subsequent toggles add/remove providers.
- Removing the last filter returns to "all" (empty array = no filter).

## Filter Architecture

The library browser provides multi-level filtering and searching via a pipeline in `src/utils/playlistFilters.ts`:

1. **Text search** — case-insensitive matching on name, description, owner, and artist fields; clicking an artist name in `AlbumGrid` populates this with the artist name to filter by artist
2. **Provider filter** — show items from selected providers only (empty array = all providers)
3. **Pinned partitioning** — pinned items always sort to top

**UI Components**:
- **FilterSidebar** (`src/components/LibraryDrawer/FilterSidebar.tsx`) — collection type (Playlists/Albums) toggle buttons, provider checkboxes, a "Clear Filters" button, and a "Recently Played" shortcut list. Desktop-only (≥700px).
- **LibraryControls** (`src/components/PlaylistSelection/LibraryControls.tsx`) — search, sort dropdowns, and filter controls. Used on desktop outside of drawer mode.
- **MobileLibraryBottomBar** (`src/components/PlaylistSelection/MobileLibraryBottomBar.tsx`) — mobile-only bottom bar containing a full-width search input and a trailing sort dropdown. Rendered by `LibraryMainContent` in place of the provider chip row when `isMobile` is true.

**Filter State Persistence** (`src/components/PlaylistSelection/useLibraryBrowsing.ts`):

All filter and sort state is persisted to `localStorage` via `useLocalStorage`. Keys are prefixed `vorbis-player-library-*`:

| Key | Default | Notes |
|-----|---------|-------|
| `vorbis-player-view-mode` | `'playlists'` | Playlists or albums tab |
| `vorbis-player-library-search` | `''` | Search query |
| `vorbis-player-playlist-sort` | `'recently-added'` | Playlist sort order |
| `vorbis-player-album-sort` | `'recently-added'` | Album sort order |
| `vorbis-player-library-provider-filters` | `[]` | Active provider filters |
| `vorbis-player-library-genres` | `[]` | Genre filter (future expansion) |

**Artist filter via search**: Clicking an artist name in `AlbumGrid` writes the artist name into `searchQuery`. Because `searchQuery` applies to both the albums and playlists views, this filter is active across all views — a slight behavior expansion from the previous albums-only artist filter. Users clear it via the search X button in `FilterSidebar` (desktop) or `MobileLibraryBottomBar` (mobile).

**Opening library from QAP:** When the user taps "Browse Library" in the Quick Access Panel, the above filter keys are cleared from localStorage before `handleOpenLibrary()` is called, ensuring a clean state.

**Responsive Design**:
- **Desktop (≥700px):** `FilterSidebar` is always visible as a static left sidebar (provider chips, sort, genre, recently-played shortcuts). Provider filter is applied to the item list.
- **Mobile (<700px):** `FilterSidebar` is hidden. `MobileLibraryBottomBar` is rendered instead — it provides search and sort only. The provider filter is intentionally bypassed on mobile (see below).

## Recently Played

**Hook:** `useRecentlyPlayedCollections` (`src/hooks/useRecentlyPlayedCollections.ts`)

Tracks the last 5 collections the user opened, enabling one-click shortcuts in the library sidebar.

```ts
interface RecentlyPlayedEntry {
  ref: CollectionRef;
  name: string;
}

const { history, record } = useRecentlyPlayedCollections();
// history: RecentlyPlayedEntry[]  — newest first, max 5 entries
// record(ref, name)               — called on successful collection load
```

**Storage:** `vorbis-player-recently-played` (localStorage). Entries are deduped by `CollectionRef` key (`collectionRefToKey`) — loading a collection already in history moves it to the top rather than duplicating it. The list is capped at 5 entries.

**Integration:** `useCollectionLoader.loadCollection` calls `record()` automatically after a successful load, so history stays up to date without any per-callsite wiring.

**UI:** `FilterSidebar` renders a "Recently Played" section below the provider chips (desktop only, ≥700px). The section is hidden when `history` is empty. Each entry is a clickable shortcut that triggers `onPlaylistSelect` with the stored `CollectionRef`.

### Mobile/Desktop Filter Divergence

On mobile, `useLibraryRoot` passes `ignoreProviderFilters: isMobile` to `useLibraryViews`. When this flag is true, the `providerFilters` state is read but never applied to the playlist or album lists — all items from every enabled provider are always shown.

**Rationale:** The provider chip row is absent on mobile, so a stale filter set from a prior desktop session could leave mobile users seeing an unexpectedly empty library with no way to reset it. Ignoring `providerFilters` on mobile eliminates this failure mode without adding a mobile-specific chip UI.

**Shared state:** Search query and sort preferences (`vorbis-player-library-search`, `vorbis-player-playlist-sort`, `vorbis-player-album-sort`) are shared between mobile and desktop via the same `useLibraryBrowsing` localStorage keys — no new keys were introduced. Only the provider filter (`vorbis-player-library-provider-filters`) is silently ignored on mobile; it remains in localStorage and is restored if the user switches to desktop.

## Sort and Filter State

**Hook:** `useLibraryBrowsing` (`src/components/PlaylistSelection/useLibraryBrowsing.ts`)

| State | Storage | Default |
|-------|---------|---------|
| `viewMode` | `useLocalStorage('vorbis-player-view-mode')` | `'playlists'` |
| `searchQuery` | `useLocalStorage('vorbis-player-library-search')` | `''` |
| `playlistSort` | `useLocalStorage('vorbis-player-playlist-sort')` | `'recently-added'` |
| `albumSort` | `useLocalStorage('vorbis-player-album-sort')` | `'recently-added'` |
| `providerFilters` | `useLocalStorage('vorbis-player-library-provider-filters')` | `[]` (empty = all) |

**Sort options** (from `src/utils/playlistFilters.ts`):
- Playlists: `name-asc`, `name-desc`, `recently-added`
- Albums: `name-asc`, `name-desc`, `artist-asc`, `artist-desc`, `release-newest`, `release-oldest`, `recently-added`

**Provider filter** logic:
- Empty array (`[]`) = show all providers (no filtering)
- Non-empty array = show only items from selected providers
- Toggle semantics: clicking a provider in the filter adds/removes it; removing the last provider resets to "all"

**Sort anchors:** `LIKED_SONGS_ID` is exempt from sort reordering — it always stays in catalog order. Defined in `LIBRARY_PLAYLIST_SORT_ANCHOR_IDS` in `src/constants/playlist.ts`. The Dropbox "All Music" aggregate (id `''`) used to live here too, but it was retired when All Music moved out of the sortable lists into its own dedicated `AllMusicCard`. `LIBRARY_ALBUM_SORT_ANCHOR_IDS` is now empty.

## Pinned Items

**Context:** `PinnedItemsContext` (`src/contexts/PinnedItemsContext.tsx`)

Pinned playlists and albums are sorted to the top of their respective grids, above unpinned items. Each group (pinned/unpinned) is sorted independently.

### Storage

Pins are stored in IndexedDB via `src/services/settings/pinnedItemsStorage.ts`:
- Provider namespace: `_unified` (cross-provider).
- Stores: `playlists` and `albums` (arrays of string IDs).
- Max pins: 12 total (playlists + albums combined).

### Sync

- On load, pins are migrated from legacy localStorage format if needed (`migratePinsFromLocalStorage`).
- External updates (e.g., Dropbox preferences sync) dispatch `vorbis-pins-changed` window event. `PinnedItemsContext` listens and reloads.
- After local pin changes, `getPreferencesSync()?.schedulePush()` pushes to Dropbox (2s debounced).

### API

```ts
const {
  pinnedPlaylistIds: string[],
  pinnedAlbumIds: string[],
  isPlaylistPinned: (id: string) => boolean,
  isAlbumPinned: (id: string) => boolean,
  togglePinPlaylist: (id: string) => void,
  togglePinAlbum: (id: string) => void,
  canPinMorePlaylists: boolean,  // totalPinned < 12
  canPinMoreAlbums: boolean,     // totalPinned < 12
} = usePinnedItems();
```

## Unified Liked Songs

**Hook:** `useUnifiedLikedTracks` (`src/hooks/useUnifiedLikedTracks.ts`)

Active when 2+ connected providers have `capabilities.hasLikedCollection`. Merges liked tracks from all qualifying providers, sorted by `addedAt` descending.

Uses a module-level cache with `useSyncExternalStore` for efficient sharing across components. The cache is keyed by sorted provider IDs -- if providers change, the cache is invalidated and re-fetched.

Refresh triggers:
- `vorbis-library-refresh` event.
- Provider-specific likes-changed events (e.g., `vorbis-dropbox-likes-changed`).

When unified liked is active and user clicks "Liked Songs" without specifying a provider, `useCollectionLoader.loadUnifiedLiked` fetches from all providers, merges, sorts, and loads into the queue.

## All Music Card

**File:** `src/components/PlaylistSelection/AllMusicCard.tsx`

Dropbox exposes a synthetic "All Music" collection (kind `'folder'`, id `''`) that aggregates every audio file in the user's library. The card representation lives in the **playlist grid** rather than the album grid.

### Source of truth

`useLibrarySync.splitCollections` intercepts the All Music collection and exposes its track total as `allMusicCount` on the hook result, separate from `playlists` and `albums`. It is then threaded through `useLibraryRoot` into `LibraryDataContextValue.allMusicCount`. Because All Music never enters the `albums` array, `AlbumGrid` cannot render it.

### Placement

`PlaylistGrid` renders `AllMusicCard` at the top anchor slot, alongside `LikedSongsCard`:

- When `ALL_MUSIC_PIN_ID` is pinned, the card renders **above** the `Pinned` section label.
- When unpinned, the card renders **above** the unpinned playlist list (still anchored to the top).
- The card is hidden when Dropbox is not in `enabledProviderIds` or is excluded by the provider filter chip.
- During the initial load, the card renders with a spinner subtitle until `allMusicCount` resolves.

### Visual design

- **Art:** Dropbox-tinted gradient (`getLikedSongsGradient('dropbox')`) with a prominent crossed-arrows shuffle SVG glyph (no emoji). The same component renders in both grid (64px glyph) and list (28px glyph) layouts.
- **Title:** `"All Music"`.
- **Subtitle:** `"{N} tracks • Shuffled"` — communicates the shuffle-by-default semantics.

### Pin identifier

Pin state uses `ALL_MUSIC_PIN_ID = 'dropbox-all-music'` (defined in `src/constants/playlist.ts`), distinct from the underlying collection id `''`. Using a stable pin identifier means the pin survives changes to how the catalog represents All Music. Pin/unpin flows through `PinnedItemsContext.togglePinPlaylist` like any other playlist pin and persists to IndexedDB.

### Popover actions

Clicking the card opens the standard playlist popover via `useItemActions`. The "Liked Songs" sub-options and the "Delete" option are suppressed for All Music (`isAllMusicPlaylist(playlist)` check) because the synthetic collection has no underlying playlist to like or delete.

## Shuffle-by-default semantics

The All Music aggregate always plays shuffled, independently of the global `shuffleEnabled` toggle. This is enforced at two entry points:

| Entry point | Behavior |
|------------|----------|
| `useCollectionLoader.loadCollection(ref)` | Calls `applyTracks(list, { forceShuffle: isAllMusicRef(ref) })`. `applyTracks` ORs `forceShuffle` with `shuffleEnabled`, so All Music always shuffles regardless of the user's global preference. |
| `useQueueManagement.handleAddToQueue(id, ...)` | When `isAllMusicRef(collectionRef)` is true, the fetched tracks are passed through `shuffleArray()` before deduping and appending to the queue. |

The detection helper `isAllMusicRef(ref)` (from `src/constants/playlist.ts`) returns true when `ref.provider === 'dropbox' && ref.kind === 'folder' && ref.id === ''`.

**The user's `shuffleEnabled` preference is never mutated.** Forcing shuffle for All Music is purely additive — it does not flip the global toggle, so loading All Music and then loading a different collection returns to the user's chosen shuffle state.

## ResumeCard

`LibraryPage` accepts a `footer` prop. `AudioPlayer.tsx` passes a `ResumeCard` as the footer when `lastSession` and `handleResume` are available, allowing users to resume a previous playback session regardless of QAP state.

In the idle/home view (`PlayerStateRenderer`), the `ResumeCard` is passed as a `footer` prop to `LibraryPage` (when QAP is disabled) or rendered within `QuickAccessPanel` (when QAP is enabled).

## Navigation

- **Swipe down on album art:** Opens `LibraryPage` (handled by gesture hooks in the player content area).
- **BottomBar library button:** Opens `LibraryPage`.
- **Keyboard:** `L` or `Down Arrow` opens/closes the library (desktop). `Down Arrow` maps to volume down on touch-only devices.
- **Cross-dismiss:** Opening the library closes the queue drawer.

## Idle/Home View

**File:** `src/components/PlayerStateRenderer.tsx`

When no track is loaded (`selectedPlaylistId === null || tracks.length === 0`), `PlayerStateRenderer` decides what to show:

1. **QAP disabled** (default): Shows `LibraryPage` inline (full library browser).
2. **QAP enabled**: Shows `QuickAccessPanel` with a "Browse Library" button that clears filter state and calls `handleOpenLibrary`.

QAP preference is stored in `localStorage` key `vorbis-player-qap-enabled` (default `false`), read via `useQapEnabled()` hook.

`PlayerStateRenderer` initializes `showLibrary = !qapEnabled`. When the user selects a playlist from either view, `showLibrary` resets to `false` and `onPlaylistSelect` fires.

## Key Files

| File | Role |
|------|------|
| `src/components/PlaylistSelection/index.tsx` | `LibraryPage` component — full-screen library view |
| `src/components/PlaylistSelection/LibraryContext.tsx` | Four sub-context definitions and providers |
| `src/components/PlaylistSelection/LibraryMainContent.tsx` | Tabs, grid rendering, mobile/desktop bottom bar branching |
| `src/components/PlaylistSelection/MobileLibraryBottomBar.tsx` | Mobile search + sort bar (replaces provider chip row on mobile) |
| `src/components/PlaylistSelection/LibraryControls.tsx` | Search, sort, and filter controls |
| `src/components/PlaylistSelection/useLibraryBrowsing.ts` | Browse state management (view mode, search, sort, filters) with localStorage persistence |
| `src/components/PlaylistSelection/useLibraryRoot.ts` | Assembles all four context values for `LibraryPage` |
| `src/components/PlaylistSelection/useItemActions.tsx` | Context menu actions (play, queue, delete) |
| `src/components/PlaylistSelection/PlaylistGrid.tsx` | Playlist card grid |
| `src/components/PlaylistSelection/AlbumGrid.tsx` | Album card grid |
| `src/components/PlaylistSelection/LikedSongsCard.tsx` | Liked songs entry card |
| `src/components/PlaylistSelection/AllMusicCard.tsx` | Dropbox "All Music" entry card with shuffle branding |
| `src/components/LibraryDrawer/FilterSidebar.tsx` | Collection type toggle and provider checkboxes (desktop only) |
| `src/components/AudioPlayer.tsx` | Renders `LibraryPage` lazily when `showLibrary` is true |
| `src/components/PlayerStateRenderer.tsx` | Idle view routing (QAP vs library) |
| `src/components/QuickAccessPanel/ResumeCard.tsx` | Session resume card |
| `src/contexts/PinnedItemsContext.tsx` | Pin state and IndexedDB persistence |
| `src/services/settings/pinnedItemsStorage.ts` | IndexedDB pin storage, MAX_PINS, events |
| `src/hooks/useLibrarySync.ts` | Collection sync engine across providers |
| `src/hooks/useUnifiedLikedTracks.ts` | Cross-provider liked songs merge |
| `src/hooks/useQapEnabled.ts` | QAP preference (localStorage) |
| `src/hooks/useRecentlyPlayedCollections.ts` | Recently played collection history (localStorage) |
| `src/hooks/usePlayerLogic.ts` | `showLibrary`, `handleOpenLibrary`, `handleCloseLibrary` |
| `src/utils/playlistFilters.ts` | Filter/sort/pin-split utilities |
| `src/constants/playlist.ts` | LIKED_SONGS_ID, ALL_MUSIC_PIN_ID, isAllMusicRef, isAllMusicPlaylist, sort anchor IDs, ID encoding |
| `src/components/PlayerContent/DrawerOrchestrator.tsx` | Drawer switching and toast management |

## Cross-Cutting Concerns

### Queue interaction
- Clicking a collection in the library calls `loadCollection` which **replaces** the queue.
- "Add to queue" (via context menu) calls `handleAddToQueue` which **appends** to the queue.
- `handleCloseLibrary()` is called before `handlePlaylistSelect` fires.

### Provider system
- `LibraryPage` reads from `ProviderContext` for `activeDescriptor`, `enabledProviderIds`, `getDescriptor`.
- Collections carry a `provider` field, so clicking one routes to the correct provider for track loading.

### Color system
- Album art colors drive the accent color. Loading a new collection triggers color extraction.
- This is not handled by the library components directly -- it happens downstream in `useAccentColor`.

## Gotchas

1. **LibraryContext sub-contexts are NOT global contexts.** They are created per `LibraryPage` mount. If you need library state outside of `LibraryPage`, you cannot use the library context hooks.

2. **`LibraryPage` unmounts when `showLibrary` is false.** All state resets on close. Filter state survives because it is persisted to `localStorage` (including `searchQuery`, which doubles as the artist filter).

3. **Opening library from QAP clears filter state.** The `onBrowseLibrary` handler in `AudioPlayer.tsx` removes the `vorbis-player-library-*` keys before calling `handleOpenLibrary`.

4. **Pin limit is 12 total across playlists and albums.** `canPinMorePlaylists` and `canPinMoreAlbums` both check `pinnedPlaylistIds.length + pinnedAlbumIds.length < MAX_PINS`.

5. **Unified liked songs requires 2+ providers with `hasLikedCollection`.** If only one provider supports liked songs, the unified path is skipped and the provider-specific liked songs are loaded directly.

6. **Library refresh dispatches a DOM event.** `LIBRARY_REFRESH_EVENT` (`vorbis-library-refresh`) is a window-level custom event, not a React state change. `useLibrarySync` and `useUnifiedLikedTracks` both listen for it.
