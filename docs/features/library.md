# Library Browser System

## Overview

The library browser shows the user's music collections (playlists, albums, liked songs) across all connected providers. It appears in two contexts:

1. **Idle/home view** -- rendered inline by `PlayerStateRenderer` when no track is loaded.
2. **LibraryDrawer** -- a slide-down overlay accessible during playback via swipe-down on album art, `L` key, or `Down Arrow`.

Both contexts render the same `PlaylistSelection` component. The difference is layout and dismissal behavior.

## LibraryDrawer

**File:** `src/components/LibraryDrawer.tsx`

- Renders via `createPortal` to `document.body`.
- Fixed position, slides down from top. Height: 85vh.
- Swipe-to-dismiss via `useVerticalSwipeGesture` on a grip pill at the **bottom** of the drawer (swipe up to close, threshold: 80px).
- Uses `hasBeenOpenedRef` to defer mount until first open.
- Constrained to 700px width on desktop (`@media min-width: lg`), centered with auto margins and border-radius on bottom corners.
- Only renders children when `isOpen` is true (conditional rendering, not just CSS hidden).

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Controls slide animation |
| `onClose` | `() => void` | Close handler |
| `onPlaylistSelect` | `(id, name, provider?) => void` | Fires when user picks a collection |
| `onAddToQueue` | `(id, name?, provider?) => Promise<AddToQueueResult \| null>` | Append to existing queue |
| `onPlayLikedTracks` | `(tracks, collectionId, name, provider?) => Promise<void>` | Direct play of liked tracks |
| `onQueueLikedTracks` | `(tracks, name?) => void` | Queue liked tracks |
| `initialSearchQuery` | `string` | Pre-populate search on open |
| `initialViewMode` | `'playlists' \| 'albums'` | Set active tab on open |
| `lastSession` | `SessionSnapshot \| null` | For ResumeCard |
| `onResume` | `() => void` | Resume session handler |

**Playlist selection is deferred.** When the user picks a collection, the drawer closes first, then `onPlaylistSelect` fires after `DRAWER_TRANSITION_DURATION` (via `setTimeout`). This prevents layout jank from simultaneous close animation + playback start.

**Library refresh** dispatches a `vorbis-library-refresh` custom event and shows a spinner for a minimum of 1500ms.

## PlaylistSelection

**File:** `src/components/PlaylistSelection/index.tsx`

The main library component. Renders playlist/album grids, search, sort, filter controls, and liked songs cards.

### Data Sources

- **Playlists and albums:** `useLibrarySync()` -- provider-agnostic sync engine that merges collections from all connected providers. Returns `CachedPlaylistInfo[]` and `AlbumInfo[]`.
- **Liked songs count:** Also from `useLibrarySync()`, with per-provider breakdown.
- **Unified liked tracks:** `useUnifiedLikedTracks()` -- active when 2+ providers with `hasLikedCollection` are connected.
- **Pinned items:** `usePinnedItems()` (re-exported from `PinnedItemsContext`).

### Layout Modes

`PlaylistSelection` has two render paths controlled by `inDrawer`:

- **`inDrawer={true}`:** Uses `DrawerContentWrapper` (fills available space, no centering). Used inside `LibraryDrawer`.
- **`inDrawer={false}`:** Uses `Container` + `SelectionCard` (centered, max-width constrained). Used in `PlayerStateRenderer` idle view. Accepts optional `footer` prop (used for `ResumeCard`).

## LibraryContext

**File:** `src/components/PlaylistSelection/LibraryContext.tsx`

A React context that provides the entire library state and action callbacks to child components (`LibraryMainContent`, `PlaylistGrid`, `AlbumGrid`, `LikedSongsCard`, etc.). Created fresh in every `PlaylistSelection` render via `useMemo`.

```ts
interface LibraryContextValue {
  // Layout
  inDrawer: boolean;
  swipeZoneRef?: React.RefObject<HTMLDivElement>;

  // Browse state
  viewMode: 'playlists' | 'albums';
  setViewMode: (v: 'playlists' | 'albums') => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;

  // Sort
  playlistSort: PlaylistSortOption;    // 'name-asc' | 'name-desc' | 'recently-added'
  setPlaylistSort: (v: PlaylistSortOption) => void;
  albumSort: AlbumSortOption;          // 'name-asc' | 'name-desc' | 'artist-asc' | 'artist-desc' | 'release-newest' | 'release-oldest' | 'recently-added'
  setAlbumSort: (v: AlbumSortOption) => void;

  // Filters
  artistFilter: string;
  setArtistFilter: (v: string) => void;
  providerFilters: ProviderId[];
  setProviderFilters: (v: ProviderId[]) => void;
  handleProviderToggle: (provider: ProviderId) => void;
  hasActiveFilters: boolean;

  // Data
  albums: AlbumInfo[];
  isInitialLoadComplete: boolean;
  showProviderBadges: boolean;
  enabledProviderIds: ProviderId[];
  likedSongsPerProvider: LikedSongsEntry[];
  likedSongsCount: number;
  isLikedSongsSyncing: boolean;
  isUnifiedLikedActive: boolean;
  unifiedLikedCount: number;

  // Pinned items (sorted to top of grids)
  pinnedPlaylists: PlaylistInfo[];
  unpinnedPlaylists: PlaylistInfo[];
  pinnedAlbums: AlbumInfo[];
  unpinnedAlbums: AlbumInfo[];
  isPlaylistPinned: (id: string) => boolean;
  canPinMorePlaylists: boolean;
  isAlbumPinned: (id: string) => boolean;
  canPinMoreAlbums: boolean;

  // Active provider
  activeDescriptor: ProviderDescriptor | null;

  // Action callbacks
  onPlaylistClick: (playlist: PlaylistInfo) => void;
  onPlaylistContextMenu: (playlist: PlaylistInfo, event: React.MouseEvent) => void;
  onPinPlaylistClick: (id: string, event: React.MouseEvent) => void;
  onLikedSongsClick: (provider?: ProviderId) => void;
  onAlbumClick: (album: AlbumInfo) => void;
  onAlbumContextMenu: (album: AlbumInfo, event: React.MouseEvent) => void;
  onPinAlbumClick: (id: string, event: React.MouseEvent) => void;
  onArtistClick: (artistName: string, event: React.MouseEvent) => void;
  onLibraryRefresh?: () => void;
  isLibraryRefreshing?: boolean;
}
```

## Browse Flow

### Provider Selection -> Collection List -> Track List

1. User opens the library (idle view or drawer).
2. `useLibrarySync` has already fetched and cached collections from all connected providers.
3. User selects "Playlists" or "Albums" tab (`viewMode`).
4. Collections are filtered and sorted via `playlistFilters.ts`:
   - `filterPlaylistsOnly(items, searchQuery)` / `filterAlbumsOnly(items, searchQuery, yearFilter, artistFilter)` -- text matching on name, description, owner/artist.
   - `buildLibraryViewWithPins(filtered, pinnedIds, getId, sortFn)` -- splits into pinned (sorted to top) and unpinned groups, applies sort within each group.
5. User clicks a collection -> `onPlaylistSelect(id, name, provider)` fires.
6. This triggers `useCollectionLoader.loadCollection` which replaces the queue and starts playback.

### Provider toggle

When multiple providers are connected, `LibraryProviderBar` shows toggle buttons. `handleProviderToggle(provider)` filters the displayed collections:
- First toggle activates only that provider.
- Subsequent toggles add/remove providers.
- Removing the last filter returns to "all" (empty array = no filter).

## Filter Architecture

The library browser provides multi-level filtering and searching via a pipeline in `src/utils/playlistFilters.ts`:

1. **Text search** — case-insensitive matching on name, description, owner, and artist fields
2. **Provider filter** — show items from selected providers only (empty array = all providers)
3. **Artist filter** (albums only) — filter albums by a single artist
4. **Decade filter** (albums only, future expansion) — group albums by release decade
5. **Pinned partitioning** — pinned items always sort to top

**UI Components**:
- **FilterChipRow** (`src/components/FilterChipRow.tsx`) — renders in drawer mode only. Shows search chip, provider filter chips, and top 5 artists (albums only). "More..." button opens a popover with full artist list (max 15 artists).
- **FilterSidebar** (`src/components/LibraryDrawer/FilterSidebar.tsx`) — collection type (Playlists/Albums) toggle buttons, provider checkboxes, and a "Clear Filters" button. Desktop-only; on mobile, controlled by a "Filters" toggle button that expands it with smooth animation.
- **LibraryControls** (`src/components/PlaylistSelection/LibraryControls.tsx`) — idle view (non-drawer) filtering. Renders similar controls to FilterChipRow and sort dropdowns.

**Filter State Persistence** (`src/hooks/useFilterState.ts`):
- Collection type and selected provider IDs are saved in `localStorage` key `vorbis-player-filter-state`
- Default: `{ collectionType: 'playlists', selectedProviderIds: [] }`
- Search query and artist filter are ephemeral (not persisted)

**Responsive Design**:
- **Desktop (≥700px):** FilterSidebar is always visible as a static left sidebar. FilterChipRow appears at the top of the drawer.
- **Mobile (<700px):** FilterSidebar is hidden by default. A "Filters" button at the top expands it inline with a smooth height animation and dark overlay backdrop. Max height: 70vh.

## Sort and Filter State

**Hook:** `useLibraryBrowsing` (`src/components/PlaylistSelection/useLibraryBrowsing.ts`)

| State | Storage | Default |
|-------|---------|---------|
| `viewMode` | `useLocalStorage('vorbis-player-view-mode')` | `'playlists'` |
| `searchQuery` | `useState` | `''` |
| `playlistSort` | `useLocalStorage('vorbis-player-playlist-sort')` | `'recently-added'` |
| `albumSort` | `useLocalStorage('vorbis-player-album-sort')` | `'recently-added'` |
| `artistFilter` | `useState` | `''` |
| `providerFilters` | `useState` | `[]` (empty = all) |

**Sort options** (from `src/utils/playlistFilters.ts`):
- Playlists: `name-asc`, `name-desc`, `recently-added`
- Albums: `name-asc`, `name-desc`, `artist-asc`, `artist-desc`, `release-newest`, `release-oldest`, `recently-added`

**Artist filter** is cleared automatically when switching from albums to playlists view.

**Provider filter** logic:
- Empty array (`[]`) = show all providers (no filtering)
- Non-empty array = show only items from selected providers
- Toggle semantics: clicking a provider in the filter adds/removes it; removing the last provider resets to "all"

**Sort anchors:** Certain special collections (`LIKED_SONGS_ID`, Dropbox "All Music" with id `''`) are exempt from sort reordering -- they always stay in catalog order. Defined in `LIBRARY_PLAYLIST_SORT_ANCHOR_IDS` and `LIBRARY_ALBUM_SORT_ANCHOR_IDS` in `src/constants/playlist.ts`.

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

## ResumeCard

`LibraryDrawer` renders a `ResumeCard` at the bottom when `lastSession` and `onResume` props are provided. This allows resuming a previous playback session regardless of QAP state.

In the idle/home view (`PlayerStateRenderer`), the `ResumeCard` is passed as a `footer` prop to `PlaylistSelection` (when QAP is disabled) or rendered within `QuickAccessPanel` (when QAP is enabled).

## Swipe Gestures

- **Swipe down on album art:** Opens LibraryDrawer (handled by gesture hooks in the player content area).
- **Swipe up on LibraryDrawer grip pill:** Closes the drawer.
- **Keyboard:** `L` or `Down Arrow` toggles the library drawer (desktop). `Down Arrow` maps to volume down on touch-only devices.
- **Cross-dismiss:** Opening the library closes the queue drawer, and vice versa.

## Idle/Home View

**File:** `src/components/PlayerStateRenderer.tsx`

When no track is loaded (`selectedPlaylistId === null || tracks.length === 0`), `PlayerStateRenderer` decides what to show:

1. **QAP disabled** (default): Shows `PlaylistSelection` inline (full library browser).
2. **QAP enabled**: Shows `QuickAccessPanel` with a "Browse Library" button that switches to `PlaylistSelection`.

QAP preference is stored in `localStorage` key `vorbis-player-qap-enabled` (default `false`), read via `useQapEnabled()` hook.

`PlayerStateRenderer` initializes `showLibrary = !qapEnabled`. When the user selects a playlist from either view, `showLibrary` resets to `false` and `onPlaylistSelect` fires.

## Key Files

| File | Role |
|------|------|
| `src/components/LibraryDrawer.tsx` | Drawer container with swipe-to-dismiss |
| `src/components/FilterChipRow.tsx` | Search and provider/artist filter chips (drawer only) |
| `src/components/LibraryDrawer/FilterSidebar.tsx` | Collection type toggle and provider checkboxes (responsive) |
| `src/components/PlaylistSelection/index.tsx` | Main library component, assembles LibraryContext |
| `src/components/PlaylistSelection/LibraryContext.tsx` | Context definition for library state |
| `src/components/PlaylistSelection/LibraryMainContent.tsx` | Tabs, filter chips, sort chip, clear filters button |
| `src/components/PlaylistSelection/LibraryControls.tsx` | Idle view (non-drawer) search, sort, and filter controls |
| `src/components/PlaylistSelection/useLibraryBrowsing.ts` | Browse state management (view mode, search, sort, filters) |
| `src/components/PlaylistSelection/useItemActions.ts` | Context menu actions (play, queue, delete) |
| `src/components/PlaylistSelection/PlaylistGrid.tsx` | Playlist card grid |
| `src/components/PlaylistSelection/AlbumGrid.tsx` | Album card grid |
| `src/components/PlaylistSelection/LikedSongsCard.tsx` | Liked songs entry card |
| `src/components/PlayerStateRenderer.tsx` | Idle view routing (QAP vs library) |
| `src/components/QuickAccessPanel/ResumeCard.tsx` | Session resume card |
| `src/contexts/PinnedItemsContext.tsx` | Pin state and IndexedDB persistence |
| `src/services/settings/pinnedItemsStorage.ts` | IndexedDB pin storage, MAX_PINS, events |
| `src/hooks/useFilterState.ts` | Filter state persistence (collection type, provider filters) |
| `src/hooks/useLibrarySync.ts` | Collection sync engine across providers |
| `src/hooks/useUnifiedLikedTracks.ts` | Cross-provider liked songs merge |
| `src/hooks/useQapEnabled.ts` | QAP preference (localStorage) |
| `src/utils/playlistFilters.ts` | Filter/sort/pin-split utilities; genre/decade logic (future) |
| `src/constants/playlist.ts` | LIKED_SONGS_ID, sort anchor IDs, ID encoding |
| `src/components/PlayerContent/DrawerOrchestrator.tsx` | Drawer switching and toast management |

## Cross-Cutting Concerns

### Queue interaction
- Clicking a collection in the library calls `loadCollection` which **replaces** the queue.
- "Add to queue" (via context menu) calls `handleAddToQueue` which **appends** to the queue.
- The library drawer closes before playback starts (deferred via timeout).

### Provider system
- `PlaylistSelection` reads from `ProviderContext` for `activeDescriptor`, `enabledProviderIds`, `getDescriptor`.
- Collections carry a `provider` field, so clicking one routes to the correct provider for track loading.

### Color system
- Album art colors drive the accent color. Loading a new collection triggers color extraction.
- This is not handled by the library components directly -- it happens downstream in `useAccentColor`.

## Gotchas

1. **LibraryContext is NOT a global context.** It is created per `PlaylistSelection` mount. If you need library state outside of `PlaylistSelection`, you cannot use `useLibraryContext()`.

2. **The drawer only renders children when open.** `{isOpen && (<DrawerContent>...`)}. This means `PlaylistSelection` unmounts on close and remounts on open. Any ephemeral state (search query, scroll position) is lost unless passed via props (`initialSearchQuery`, `initialViewMode`).

3. **Sort and view mode are persisted; search and artist filter are not.** `viewMode`, `playlistSort`, and `albumSort` survive across sessions. `searchQuery` and `artistFilter` reset on each drawer open (unless `initialSearchQuery` is passed).

4. **Provider filters are ephemeral.** They reset when the drawer is closed and reopened.

5. **Pin limit is 12 total across playlists and albums.** `canPinMorePlaylists` and `canPinMoreAlbums` both check `pinnedPlaylistIds.length + pinnedAlbumIds.length < MAX_PINS`.

6. **Unified liked songs requires 2+ providers with `hasLikedCollection`.** If only one provider supports liked songs, the unified path is skipped and the provider-specific liked songs are loaded directly.

7. **Library refresh dispatches a DOM event.** `LIBRARY_REFRESH_EVENT` (`vorbis-library-refresh`) is a window-level custom event, not a React state change. `useLibrarySync` and `useUnifiedLikedTracks` both listen for it.
