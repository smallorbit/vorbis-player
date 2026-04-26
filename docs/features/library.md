# Library Browser System

## Overview

The library browser shows the user's music collections (playlists, albums, liked songs) across all connected providers. It is implemented as `LibraryRoute` — a sections-first surface that replaces the legacy drawer/page split.

It appears in two contexts:

1. **Idle/home view** — rendered inline by `PlayerStateRenderer` when no track is loaded and QAP is disabled.
2. **Full-screen library** — `LibraryRoute` opened during playback via swipe-down on album art, BottomBar library button, `L` key, or `↓`.

Both contexts render the same `LibraryRoute` component (default export from `src/components/LibraryRoute/index.tsx`).

## LibraryRoute

**File:** `src/components/LibraryRoute/index.tsx`

`LibraryRoute` is the full-screen library view. It is rendered in `AudioPlayer.tsx` via `React.lazy` when `state.currentView === 'library'` (in `usePlayerLogic`). `currentView` is toggled via `handleOpenLibrary` / `handleCloseLibrary`.

Internally `LibraryRoute` owns:

- `view` — sub-route state (`home` | `recently-played` | `pinned` | `playlists` | `albums` | `liked` | `search`). Local to `LibraryRoute`, not in `usePlayerLogic`. Discarded when `currentView` swaps back to `'player'`.
- `search` — the `LibrarySearchState` returned by `useLibrarySearch`. Active query forces `view === 'search'`.
- `contextRequest` — the active virtual-anchor for `LibraryContextMenu` (long-press / right-click target).
- `paletteOpen` — desktop-only Cmd-K palette open flag (gated by `useCommandPaletteShortcut`).

The body picks one of three views:

| Effective view | Component |
|---|---|
| `search` (any non-empty query) | `SearchResultsView` |
| `home`, `liked` | `HomeView` |
| `recently-played`, `pinned`, `playlists`, `albums` | `SeeAllView` |

`SearchBar` mounts above (`desktop`) or below (`mobile`) the body. `MiniPlayer` is sticky-bottom. `CommandPalette` is desktop-only.

## Section taxonomy

`HomeView` renders sections in fixed order:

1. **Resume** — last session hero (`ResumeHero`), gated on a fresh `lastSession`.
2. **Recently Played** — last 5 collections from `useRecentlyPlayedCollections`.
3. **Pinned** — pinned playlists/albums.
4. **Liked** — unified or per-provider liked tracks, from `useUnifiedLikedTracks`.
5. **Playlists** — all playlists across enabled providers.
6. **Albums** — all saved albums across enabled providers.

Each section is a `Section` shell (header + horizontal/vertical card group) backed by a dedicated data hook in `LibraryRoute/hooks/`:

| Hook | State |
|---|---|
| `useResumeSection` | `{ session, isReady }` |
| `useRecentlyPlayedSection` | `SectionState<RecentlyPlayedEntry>` |
| `usePinnedSection` | `SectionState<PinnedItem>` |
| `useLikedSection` | `LikedSummary` |
| `usePlaylistsSection` | `SectionState<CachedPlaylistInfo>` |
| `useAlbumsSection` | `SectionState<AlbumInfo>` |

Hook params accept the active provider filter / kind filter / sort, so the same hooks back both `HomeView` and `SeeAllView`.

`SectionSkeleton` renders shimmer cards while loading. Sections collapse when `isEmpty === true`.

## Layouts: mobile rows vs desktop grids

```ts
isMobile (usePlayerSizingContext) ? MobileLayout : DesktopLayout
```

- **Mobile**: each section is a horizontal-scroll row (`overflow-x: auto` + `scroll-snap-type: x mandatory`). Native scrolling preserves iOS momentum — Radix `ScrollArea` is intentionally avoided here.
- **Desktop**: each section is a vertical wrapped grid (CSS grid auto-fill).

Section headers expose a "See all" affordance that calls `onNavigate(view)` on `HomeView`. `SeeAllView` then renders the full collection (grid on both mobile and desktop) with a back button.

## Card primitive

**File:** `src/components/LibraryRoute/card/LibraryCard.tsx`

A single card primitive renders all collection types. It supports:

- Click → `onSelectCollection(kind, id, name, provider)` — routes to the same `onPlaylistSelect` handler used by the legacy library (album IDs are wrapped via `toAlbumPlaylistId`).
- **Long-press / right-click** → `onContextMenuRequest({ kind, id, provider, name, anchorRect })`.

Long-press is implemented by `useLongPress` (500 ms hold, 8 px move tolerance). On touch devices the synthetic event fires after the timeout; on pointer devices `contextmenu` fires immediately.

## Search + filters + Cmd-K

**Hook:** `src/components/LibraryRoute/search/useLibrarySearch.ts`

`useLibrarySearch` owns query (in-memory) plus filter state (persisted to localStorage):

| State | Storage key |
|---|---|
| `providerFilter: ProviderId[]` | `vorbis-player-library-route-provider-filter` |
| `kindFilter: LibraryKindFilter[]` (playlist/album) | `vorbis-player-library-route-kind-filter` |
| `sort: 'recent' \| 'name-asc' \| 'name-desc'` | `vorbis-player-library-route-sort` |

`isSearching` is derived from a non-empty trimmed query. While `isSearching` is true, the body switches to `SearchResultsView` regardless of the active sub-route.

**Components:**

- `SearchBar` — text input + filter button. Renders different chrome on mobile (bottom dock) vs desktop (top of body).
- `FilterSheet` — Radix `Sheet` (mobile) / `Popover` (desktop) with provider checkboxes, kind toggles, sort radio.
- `CommandPalette` — desktop-only Cmd-K palette. Built on `cmdk@^1.1.1`. Triggered by `useCommandPaletteShortcut`.
- `searchMatch.ts` — case- and diacritic-insensitive substring match used by both `useLibrarySearch` results and the palette.

## Context menu

**File:** `src/components/LibraryRoute/contextMenu/LibraryContextMenu.tsx`

Single-instance virtual-anchored Popover (NOT Radix `ContextMenu`). Reads `request: ContextMenuRequest | null` from `LibraryRoute`, anchors at `request.anchorRect`. Items are derived per `LibraryItemKind` by `menuItemsForKind`.

Common actions:

- Play
- Add to queue
- Play next *(rendered disabled — wiring deferred)*
- Start radio for collection *(rendered disabled — wiring deferred)*
- Pin / Unpin (playlists, albums)
- Save / Unsave album (albums) — uses `useAlbumSavedStatus`
- Like / Unlike all tracks (liked) — uses `useLikedTracksForProvider`
- Remove from history (recently-played)

The "Save album" path no longer pre-populates an optimistic `AlbumInfo` — newly-saved albums appear after the next library sync. Acceptable trade-off per the redesign blueprint.

## Mini-player

**File:** `src/components/LibraryRoute/MiniPlayer/MiniPlayer.tsx`

Sticky-bottom mini-player rendered inside `LibraryRoute` (NOT in `BottomBar`). Owns its own art / controls / expand affordance. `BottomBar`'s `hidden` condition is `currentView === 'library'` — the mini-player owns the bottom while the library route is active.

Sub-components: `MiniArt`, `MiniControls`. Wired via `onMini*` props on `LibraryRoute`.

## Recently Played history

`useRecentlyPlayedCollections` (`src/hooks/useRecentlyPlayedCollections.ts`) tracks history. It exposes `history: RecentlyPlayedEntry[]` and `record(ref, name)`. Successful collection loads via `useCollectionLoader.loadCollection` call `record` automatically. Storage: `vorbis-player-recently-played` (localStorage), capped at 5 entries, deduped by `CollectionRef` key, newest first.

`useRecentlyPlayedSection` adapts this hook into the section data shape.

## Resume integration

`LibraryRoute` accepts `lastSession?: SessionSnapshot | null` and `onResume?`. When present and fresh (`!isSessionStale(session)`), the Resume section renders `ResumeHero` at the top of `HomeView` with a Resume CTA. The footer `ResumeCard` from the legacy layout is gone — Resume lives only as the top-of-library hero now.

## Key files

| File | Role |
|---|---|
| `src/components/LibraryRoute/index.tsx` | Route shell, sub-route nav state, search/menu/palette wiring |
| `src/components/LibraryRoute/views/HomeView.tsx` | Sections-first home view |
| `src/components/LibraryRoute/views/SeeAllView.tsx` | Single-section grid view |
| `src/components/LibraryRoute/views/SearchResultsView.tsx` | Search results grid |
| `src/components/LibraryRoute/sections/Section.tsx` | Section shell (header + body) |
| `src/components/LibraryRoute/sections/<Kind>Section.tsx` | Per-kind section components |
| `src/components/LibraryRoute/hooks/use<Kind>Section.ts` | Per-section data hooks |
| `src/components/LibraryRoute/card/LibraryCard.tsx` | Universal card primitive |
| `src/components/LibraryRoute/card/useLongPress.ts` | Long-press detection |
| `src/components/LibraryRoute/search/useLibrarySearch.ts` | Query + filter state |
| `src/components/LibraryRoute/search/CommandPalette.tsx` | Desktop Cmd-K palette |
| `src/components/LibraryRoute/contextMenu/LibraryContextMenu.tsx` | Single-instance virtual-anchored menu |
| `src/components/LibraryRoute/MiniPlayer/MiniPlayer.tsx` | Sticky mini-player |
| `src/components/LibraryRoute/types.ts` | `SectionState`, `LibraryRouteView`, `LibraryItemKind`, `ContextMenuRequest` |

## Architectural notes

- **Sections-first taxonomy**: Resume → Recently Played → Pinned → Liked → Playlists → Albums (fixed order).
- **Mobile = horizontal-scroll rows + "See all" sub-route**; **desktop = vertical wrapped grids**.
- **Sub-route nav state is local** to `LibraryRoute` (not in `usePlayerLogic`) — discarded naturally when `currentView` swaps.
- **Native overflow-x with scroll-snap** on mobile (NOT Radix `ScrollArea` — preserves iOS momentum).
- **Card context menu uses virtual-anchored Popover** (NOT Radix `ContextMenu`) per the `TrackInfoPopover` pattern in `docs/architecture/shadcn.md`.
- **shadcn primitives lifted for this surface**: `src/components/ui/{input,sheet,command}.tsx`. New dep: `cmdk@^1.1.1`.
- **localStorage key `vorbis-player-new-library-route`** (the former opt-in flag) is left as an orphan — no migration; the key is harmless and reads are gone.
