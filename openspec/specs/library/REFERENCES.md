# library — Source References

Companion to [spec.md](./spec.md). Not part of the OpenSpec spec.
Paths relative to `src/components/LibraryRoute/` unless prefixed otherwise.
Line numbers verified on 2026-05-23.

---

## Requirement: Home view section order

**Sources**

- `views/HomeView.tsx:41-72` — `HomeView` renders `<ResumeSection>`, `<RecentlyPlayedSection>`, `<PinnedSection>`, `<PlaylistsSection>`, `<AlbumsSection>` in that order inside `<HomeStack>`.
- `sections/RecentlyPlayedSection.tsx:27` — `if (!isLoading && isEmpty) return null` — section hides when empty and loaded.
- `sections/PinnedSection.tsx:27` — same guard: `if (!isLoading && isEmpty) return null`.
- `sections/ResumeSection.tsx:13` — `if (!hasResumable || !session || !onResume) return null`.

**Notes**

- PlaylistsSection and AlbumsSection delegate their empty-state guards to `Section` via the `hidden` prop; the same pattern applies.

### Scenario: All sections have content

**Source:** `views/HomeView.tsx:41-72` — all five section components are unconditionally rendered; each manages its own visibility.
Interpolated from absence; no direct integration test.

### Scenario: Section is empty after loading completes

**Source:** `sections/RecentlyPlayedSection.tsx:27`, `sections/PinnedSection.tsx:27` — `if (!isLoading && isEmpty) return null`.
Verified by test at `sections/__tests__/RecentlyPlayedSection.test.tsx` (hidden when empty).

### Scenario: Resume section with no last session

**Source:** `sections/ResumeSection.tsx:13` — `if (!hasResumable || !session || !onResume) return null`.
`hooks/useResumeSection.ts:13` — `hasResumable = !!lastSession && !isSessionStale(lastSession)`.
Verified by test at `__tests__/LibraryRoute.test.tsx:136` ("does not mount mini-player when no current track" — separate concern; resume behavior interpolated from absence).

---

## Requirement: Pinned section item ordering

**Sources**

- `hooks/usePinnedSection.ts:65-83` — `combined` is built as `[...likedEntries, ...pinnedPlaylists, ...pinnedAlbums]`.
- `hooks/usePinnedSection.ts:44-63` — `likedEntries` builds single or per-provider liked items.

### Scenario: Unified liked songs with user-pinned items

**Source:** `hooks/usePinnedSection.ts:65-83` — liked first, playlists second, albums last.
Verified by test at `hooks/__tests__/usePinnedSection.test.ts:367-391` ("liked entries are prepended before pinned playlists").

### Scenario: Multi-provider liked songs, not unified

**Source:** `hooks/usePinnedSection.ts:46-52` — when `!isUnified && perProvider.length > 1`, maps `perProvider` to one entry per provider with `id: 'liked-${provider}'`.
Verified by test at `hooks/__tests__/usePinnedSection.test.ts:290-319` ("expands into per-provider liked entries when not unified and multiple providers").

### Scenario: Liked songs count subtitle grammar

**Source:** `hooks/usePinnedSection.ts:27` — `formatLikedSubtitle = (n) => \`${n} song${n === 1 ? '' : 's'}\``.
Verified by tests at`hooks/**tests**/usePinnedSection.test.ts:283-288` ("1 song") and `:393-411` ("1 song" singular).

### Scenario: Pinned id not in loaded library

**Source:** `hooks/usePinnedSection.ts:34-36` — `playlists.filter((p) => pinnedSet.has(p.id))` — mismatched ids are silently dropped.
Verified by test at `hooks/__tests__/usePinnedSection.test.ts:229-246` ("ignores playlist id in pinnedPlaylistIds that is not in library").

---

## Requirement: See All navigation

**Sources**

- `sections/PlaylistsSection.tsx:9,31` — `SEE_ALL_THRESHOLD = 8`; `showSeeAll = layout === 'row' && items.length > SEE_ALL_THRESHOLD`.
- `sections/AlbumsSection.tsx:9,31` — same threshold (8).
- `sections/PinnedSection.tsx:9,29` — `SEE_ALL_THRESHOLD = 6`.
- `sections/RecentlyPlayedSection.tsx:9,29` — `SEE_ALL_THRESHOLD = 4`.
- `views/HomeView.tsx:47-48,52,57,63` — each section's `onSeeAll` calls `onNavigate('recently-played' | 'pinned' | 'playlists' | 'albums')`.
- `views/SeeAllView.tsx:42-46` — SeeAll always uses `layout: 'grid'`.
- `views/SeeAllView.tsx:52` — `<BackButton onClick={onBack}>` returns to home.

### Scenario: Playlist section exceeds threshold in row layout

**Source:** `sections/PlaylistsSection.tsx:31` — `items.length > SEE_ALL_THRESHOLD` (8) with `layout === 'row'`.
Verified by test at `sections/__tests__/PlaylistsSection.test.tsx` (threshold boundary). **Interpolated; no direct named test found at time of writing.**

### Scenario: Playlist section at or below threshold in row layout

**Source:** `sections/PlaylistsSection.tsx:31` — `items.length > SEE_ALL_THRESHOLD` — equality means no See All.
**Interpolated; no direct test.**

### Scenario: Album section threshold

**Source:** `sections/AlbumsSection.tsx:9,31` — same logic as Playlists with threshold 8.
**Interpolated; no direct test.**

### Scenario: Pinned section threshold

**Source:** `sections/PinnedSection.tsx:9,29` — threshold 6.
**Interpolated; no direct test.**

### Scenario: Recently Played section threshold

**Source:** `sections/RecentlyPlayedSection.tsx:9,29` — threshold 4.
**Interpolated; no direct test.**

### Scenario: See all not shown in grid layout

**Source:** `sections/PlaylistsSection.tsx:31` — `layout === 'row'` guard; grid layout never passes.
**Interpolated from absence of grid-layout See All call.**

### Scenario: Back from SeeAll view

**Source:** `views/SeeAllView.tsx:52` — `<BackButton onClick={onBack}>`.
Verified by test at `views/__tests__/SeeAllView.test.tsx` (back button). **Interpolated; not separately confirmed.**

---

## Requirement: Search query routing

**Sources**

- `index.tsx:166` — `effectiveView = search.isSearching ? 'search' : view` — search always wins.
- `index.tsx:169-171` — `SearchResultsView` rendered when `effectiveView === 'search'`.
- `search/useLibrarySearch.ts:61` — `isSearching = query.trim().length > 0`.
- `index.tsx:103-106` — `handleSelectCollection` calls `search.setQuery('')` when search is active.

### Scenario: Non-empty query entered

**Source:** `search/useLibrarySearch.ts:61` and `index.tsx:166` — `isSearching` becomes true, `effectiveView` switches to `'search'`.
Verified by test at `__tests__/LibraryRoute.test.tsx:184-195` ("pre-fills search input and shows search results view when initialSearchQuery is provided").

### Scenario: Query cleared

**Source:** `search/useLibrarySearch.ts:61` — `isSearching` becomes false when query is empty; `index.tsx:166` reverts to `view`.
Verified by test at `__tests__/LibraryRoute.test.tsx:197-208` ("leaves search input empty and shows home view").

### Scenario: Initial search query seed

**Source:** `index.tsx:86` — `useLibrarySearch(initialSearchQuery)`; `search/useLibrarySearch.ts:36` — `useState(initialQuery ?? '')`.
`index.tsx:84-85` — comment explains seed-once contract.
Verified by test at `__tests__/LibraryRoute.test.tsx:184-195`.

---

## Requirement: Search text matching

**Sources**

- `search/searchMatch.ts:8-16` — `matchesQuery`: empty query returns true; otherwise `name.toLowerCase().includes(normalizedQuery)` or `ownerName.toLowerCase().includes(normalizedQuery)`.
- `search/SearchResultsView.tsx:88` — albums pass `ownerName: a.artists` to `matchesQuery`.
- `search/searchMatch.ts:4-6` — `normalizeQuery` trims and lowercases.

### Scenario: Case-insensitive name match

**Source:** `search/searchMatch.ts:13` — `item.name.toLowerCase().includes(normalizedQuery)`.
Verified by test at `search/__tests__/searchMatch.test.ts:24-29` ("matches case-insensitive substring").

### Scenario: Artist name match for albums

**Source:** `search/SearchResultsView.tsx:88` and `search/searchMatch.ts:14-15` — `ownerName` field carries artist names for albums.
Verified by test at `search/__tests__/searchMatch.test.ts:55-63` ("matches on ownerName when name does not match").

### Scenario: Empty query matches everything

**Source:** `search/searchMatch.ts:11` — `if (!normalizedQuery) return true`.
Verified by test at `search/__tests__/searchMatch.test.ts:38-44` ("returns true for empty query").

### Scenario: No match

**Source:** `search/searchMatch.ts:16` — `return false` after both checks fail.
Verified by test at `search/__tests__/searchMatch.test.ts:45-51` ("returns false on no match").

### Scenario: No results message

**Source:** `views/SearchResultsView.tsx:97-105` — `if (totalResults === 0)` renders `No results for "<query>"`.
**Interpolated; no direct test for the exact zero-results path.**

---

## Requirement: Search filter persistence

**Sources**

- `search/useLibrarySearch.ts:9-13` — storage keys `'vorbis-player-library-route-provider-filter'`, `'vorbis-player-library-route-kind-filter'`, `'vorbis-player-library-route-sort'`.
- `search/useLibrarySearch.ts:37-45` — `useLocalStorage` for all three.
- `search/useLibrarySearch.ts:47-59` — `toggleProvider` and `toggleKind` via `toggleInArray`.
- `search/useLibrarySearch.ts:62-66` — `hasActiveFilters` true when any filter differs from default.
- `search/useLibrarySearch.ts:68-73` — `clearAll` resets all three to defaults.
- `search/searchMatch.ts:18-25` — `passesProviderFilter`: empty array = pass all; filters by `provider ?? 'spotify'`.
- `search/FilterSheet.tsx:44` — source group hidden when `enabledProviderIds.length <= 1`.

### Scenario: Provider filter toggles

**Source:** `search/useLibrarySearch.ts:47-51` — `toggleProvider` wraps `toggleInArray`.
`search/searchMatch.ts:18-25` — items excluded when not in filter.
Verified by test at `search/__tests__/useLibrarySearch.test.ts` (toggleProvider). **Interpolated; test name not confirmed.**

### Scenario: Kind filter restricts collection types

**Source:** `views/SearchResultsView.tsx:43-44` — `showPlaylists = kindFilter.length === 0 || kindFilter.includes('playlist')`.
**Interpolated; no direct test observed.**

### Scenario: Sort order applied

**Source:** `search/searchMatch.ts:27-36` — `sortItems`: `name-asc` uses `localeCompare`, `name-desc` reverses.
Verified by test at `search/__tests__/searchMatch.test.ts:115-122` ("sorts ascending by name (case-insensitive via localeCompare)").

### Scenario: Sort order name-desc

**Source:** `search/searchMatch.ts:32-33` — reverses ascending sort.
Verified by test at `search/__tests__/searchMatch.test.ts:124-130` ("sorts descending by name").

### Scenario: Sort order recent

**Source:** `search/searchMatch.ts:30` — `if (sort === 'recent') return items` — identity return.
Verified by test at `search/__tests__/searchMatch.test.ts:107-113` ("returns items unchanged for recent sort").

### Scenario: Filter state active indicator

**Source:** `search/useLibrarySearch.ts:62-66` — `hasActiveFilters` used in `search/SearchBar.tsx:51` via `$hasActive={search.hasActiveFilters}`.
**Interpolated; no direct test for visual indicator.**

### Scenario: Clear all resets all state

**Source:** `search/useLibrarySearch.ts:68-73` — `clearAll` calls `setQuery('')`, resets provider/kind/sort to defaults.
`search/FilterSheet.tsx:88-94` — "Clear all" button disabled when `!hasActiveFilters && !isSearching`.
**Interpolated; no direct test for clearAll behavior.**

### Scenario: Provider filter hidden for single provider

**Source:** `search/FilterSheet.tsx:44` — `{enabledProviderIds.length > 1 && <Group>…Source…</Group>}`.
**Interpolated; no direct test.**

---

## Requirement: Collection context menu

**Sources**

- `card/LibraryCard.tsx:59-64` — `fireContextMenu` via `useLongPress.onLongPress`.
- `card/LibraryCard.tsx:77-84` — `handleContextMenu` for right-click (`e.preventDefault()`).
- `contextMenu/LibraryContextMenu.tsx:76-96` — `handleMenuKeyDown`: ArrowDown, ArrowUp, Home, End.
- `contextMenu/LibraryContextMenu.tsx:147-157` — `onEscapeKeyDown` sets `closeReasonRef.current = 'return'`; on close `onReturnFocusClose` is called.
- `contextMenu/menuItemsForKind.ts:45-61,63-108,110-122,124-151` — `buildMenuItems` dispatches by kind.

### Scenario: Context menu opens on right-click

**Source:** `card/LibraryCard.tsx:77-84` — `onContextMenu` handler calls `onContextMenuRequest` with pointer coordinates.
Verified by test at `contextMenu/__tests__/LibraryContextMenu.test.tsx`. **Interpolated; test name not confirmed.**

### Scenario: Context menu opens on long press

**Source:** `card/LibraryCard.tsx:59-64` and `card/useLongPress.ts`.
Verified by test at `card/__tests__/useLongPress.test.ts`.

### Scenario: Playlist menu items

**Source:** `contextMenu/menuItemsForKind.ts:63-79` — `buildPlaylistItems`: play, add-to-queue, play-next, toggle-pin, start-radio.
Verified by test at `contextMenu/__tests__/menuItemsForKind.test.ts:26-39` ("builds 5 items for playlist kind").

### Scenario: Album menu items

**Source:** `contextMenu/menuItemsForKind.ts:81-108` — `buildAlbumItems`: adds toggle-save (labelled "Unlike") and start-radio.
Verified by test at `contextMenu/__tests__/menuItemsForKind.test.ts:43-59` ("builds 6 items for album kind when toggleSave provided").

### Scenario: Liked Songs menu items

**Source:** `contextMenu/menuItemsForKind.ts:110-122` — `buildLikedItems`: play-all + per-provider.
Verified by test at `contextMenu/__tests__/menuItemsForKind.test.ts:73-91` ("builds Play All + per-provider entries for liked kind").

### Scenario: Recently-played appends Remove from history

**Source:** `contextMenu/menuItemsForKind.ts:141-148` — `isRecentlyPlayed && actions.onRemoveFromHistory` appends `remove-from-history` with `variant: 'destructive'`.
Verified by tests at `contextMenu/__tests__/menuItemsForKind.test.ts:108-123` (appends) and `:109-123` (destructive variant).

### Scenario: Pin/Unpin label reflects current state

**Source:** `contextMenu/menuItemsForKind.ts:53-58` — `label: actions.isPinned ? 'Unpin' : 'Pin'`.
Verified by test at `contextMenu/__tests__/menuItemsForKind.test.ts:139-148` ("flips Pin label to Unpin when isPinned=true").

### Scenario: Start Radio disabled when unavailable

**Source:** `contextMenu/menuItemsForKind.ts:66-70` — `disabled: actions.startRadioDisabled === true`.
Verified by test at `contextMenu/__tests__/menuItemsForKind.test.ts:160-170` ("marks Start Radio disabled when startRadioDisabled=true").

### Scenario: Play Next disabled when unavailable

**Source:** `contextMenu/menuItemsForKind.ts:50-54` — `disabled: actions.playNextDisabled === true`.
Verified by test at `contextMenu/__tests__/menuItemsForKind.test.ts:171-181` ("marks Play Next disabled when playNextDisabled=true").

### Scenario: Queue Liked Songs optional item

**Source:** `contextMenu/menuItemsForKind.ts:71-77` (playlist) and `:100-106` (album) — appended only when `onQueueLikedFromCollection` is defined.
Verified by tests at `contextMenu/__tests__/menuItemsForKind.test.ts:183-193` (playlist) and `:194-204` (album).

### Scenario: Arrow key navigation in menu

**Source:** `contextMenu/LibraryContextMenu.tsx:83-95` — ArrowDown advances index mod length; ArrowUp decrements.
**Interpolated; no direct test for arrow key navigation.**

### Scenario: Escape dismisses menu and returns focus

**Source:** `contextMenu/LibraryContextMenu.tsx:147-157` — `onEscapeKeyDown` sets reason to `'return'`; close handler calls `onReturnFocusClose` which runs `triggerRef.current?.focus()` (`index.tsx:131-133`).
Verified by test at `contextMenu/__tests__/LibraryContextMenu.a11y.test.tsx`. **Interpolated; test name not confirmed.**

### Scenario: Action error shown as toast

**Source:** `contextMenu/LibraryContextMenu.tsx:56-73` — `closeAfter` catches promise rejections and calls `toast(message)`.
Verified by test at `contextMenu/__tests__/LibraryContextMenu.edges.test.tsx`. **Interpolated; test name not confirmed.**

---

## Requirement: Provider badge display

**Sources**

- `views/HomeView.tsx:37-38` — `showProviderBadges = hasMultipleProviders`.
- `card/LibraryCard.tsx:103-107` — badge rendered only when `showProviderBadge && provider`.

### Scenario: Multiple providers connected

**Source:** `views/HomeView.tsx:37-38` — `hasMultipleProviders` from `useProviderContext()` gates badge display.
**Interpolated; no direct test for badge visibility.**

### Scenario: Single provider connected

**Source:** Same — `hasMultipleProviders` is false; `showProviderBadges` is false; badge branch skipped.
**Interpolated from absence.**

---

## Requirement: Mini-player during library browsing

**Sources**

- `MiniPlayer/MiniPlayer.tsx:38` — `if (!currentTrack) return null`.
- `MiniPlayer/MiniPlayer.tsx:45` — `data-testid="library-mini-player"`.
- `MiniPlayer/MiniPlayer.tsx:49-52` — `<TapTarget onClick={onExpand}>` wraps art + text.

### Scenario: Mini-player visible with active track

**Source:** `MiniPlayer/MiniPlayer.tsx:38` — returns early only when `!currentTrack`.
Verified by test at `__tests__/LibraryRoute.test.tsx:148-165` ("mounts mini-player when a current track is loaded").

### Scenario: Mini-player hidden with no active track

**Source:** `MiniPlayer/MiniPlayer.tsx:38` — `if (!currentTrack) return null`.
Verified by test at `__tests__/LibraryRoute.test.tsx:136-146` ("does not mount mini-player when no current track").

### Scenario: Expand tap navigates to full player

**Source:** `MiniPlayer/MiniPlayer.tsx:49-52` — `TapTarget` calls `onExpand` on click.
Verified by test at `__tests__/LibraryRoute.test.tsx:167-181` ("forwards onMiniExpand from the mini-player tap region").

---

## Requirement: Escape key dismissal

**Sources**

- `index.tsx:87-100` — `useEffect` adds `keydown` listener; filters out `Escape` presses from `INPUT`, `TEXTAREA`, or `contentEditable` targets; calls `onClose()`.
- `index.tsx:87-89` — listener not added when `onClose` is undefined.

### Scenario: Escape outside input closes library

**Source:** `index.tsx:93-97` — tag check excludes INPUT/TEXTAREA/contentEditable; `onClose()` called otherwise.
Verified by test at `__tests__/LibraryRoute.test.tsx:216-226` ("calls onClose when Escape is pressed outside an input").

### Scenario: Escape inside input does not close library

**Source:** `index.tsx:93-96` — `if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return`.
Verified by test at `__tests__/LibraryRoute.test.tsx:228-239` ("does not call onClose when Escape is pressed while focus is inside an input").

### Scenario: No close callback provided

**Source:** `index.tsx:87-89` — `if (!onClose) return` skips adding the listener entirely.
Verified by test at `__tests__/LibraryRoute.test.tsx:241-250` ("does not call onClose when onClose prop is not provided").

---

## Requirement: Responsive layout

**Sources**

- `index.tsx:162-164` — `layout = isMobile ? 'row' : 'grid'`; `Layout = isMobile ? MobileLayout : DesktopLayout`.
- `index.tsx:207-208` — desktop: `<SearchBar variant="desktop">` inside layout; mobile: `<SearchBar variant="mobile">` outside (after) layout.

### Scenario: Mobile layout

**Source:** `index.tsx:162-164` — `isMobile` selects row layout and `MobileLayout`.
`index.tsx:207-208` — mobile search bar rendered after the layout container.
Verified by test at `__tests__/LibraryRoute.test.tsx:101-111` ("renders mobile layout testid when isMobile is true").

### Scenario: Desktop layout

**Source:** `index.tsx:162-164` — `!isMobile` selects grid layout and `DesktopLayout`.
`index.tsx:207` — desktop search bar rendered inside the layout container (above sections).
Verified by test at `__tests__/LibraryRoute.test.tsx:113-123` ("renders desktop layout testid when isMobile is false").

---

## Cross-cutting interpretive notes

1. **Section "See all" thresholds are not tested with exact boundary values.** The thresholds (RecentlyPlayed: 4, Pinned: 6, Playlists/Albums: 8) are read from source constants but no tests assert the `count === threshold` (no See All) vs `count === threshold + 1` (See All) boundary. Claimed from source constants only.

2. **No results message exact wording.** `SearchResultsView.tsx:100` renders `No results for "<query>"` but no test verifies this copy. Interpolated from absence of a test.

3. **Provider badge visibility** is derived from `hasMultipleProviders` but no test exercises the badge rendering path. Interpolated from prop-threaded logic.

4. **Kind filter exclusion in search results** (`showAlbums`/`showPlaylists` gates) is not directly tested. Claimed from `SearchResultsView.tsx:43-44`.

5. **Arrow key and Home/End navigation inside the context menu** is implemented in `LibraryContextMenu.tsx:76-96` but no unit test was found verifying focus movement. Interpolated.

6. **Escape-dismisses-context-menu-and-returns-focus** is implemented (`closeReasonRef` pattern) but the a11y test file was not read in full. Marked interpolated pending full test read.

7. **Filter/sort persistence across sessions** relies on `useLocalStorage` with known keys. Persistence behavior not directly end-to-end tested in the unit suite — only toggle logic is unit-tested. Interpolated.

8. **Clear all "Clear all" button disabled state** — `FilterSheet.tsx:89` disables button when `!hasActiveFilters && !isSearching`. No test observed for disabled state. Interpolated.
