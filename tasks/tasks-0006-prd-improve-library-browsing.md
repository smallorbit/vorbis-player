# Tasks: Improve Library Browsing

## Relevant Files

- `src/utils/id3Parser.ts` - Add TDRC/TYER/TYE/DATE parsing for release year extraction
- `src/utils/__tests__/id3Parser.test.ts` - Tests for new date parsing logic
- `src/providers/dropbox/dropboxArtCache.ts` - IndexedDB schema upgrade to store release dates
- `src/providers/dropbox/dropboxCatalogAdapter.ts` - Background date scan pass during catalog discovery
- `src/providers/dropbox/dropboxCatalogCache.ts` - Cache layer for album date metadata
- `src/utils/playlistFilters.ts` - Fix sort behavior for albums with missing release dates
- `src/utils/__tests__/playlistFilters.test.ts` - Tests for updated sort/filter logic
- `src/types/domain.ts` - Optional `releaseDate` field on MediaCollection
- `src/components/PlaylistSelection.tsx` - Filter chip row UI, refactored search/sort controls
- `src/components/styled/FilterChips.tsx` - New styled components for chip row
- `src/components/__tests__/PlaylistSelection.test.tsx` - Tests for filter chip behavior
- `src/styles/theme.ts` - Reference for chip styling tokens (no changes expected)
- `src/components/LibraryDrawer.tsx` - Context where PlaylistSelection renders (minor if any changes)

### Notes

- Unit tests are colocated in `__tests__/` subdirectories alongside source files.
- Use `npm run test:run` to run all tests.
- Run `npx tsc --noEmit` and `npm run build` to verify after multi-file changes.

## Tasks

- [ ] 1.0 Extract release year from ID3/FLAC tags
  - [ ] 1.1 Add `releaseYear?: number` field to the `AudioMetadata` interface in `id3Parser.ts`
  - [ ] 1.2 Parse `TYER` (ID3v2.3) and `TYE` (ID3v2.2) year frames in the existing frame-reading loops
  - [ ] 1.3 Parse `TDRC` (ID3v2.4) recording date frame, extracting the 4-digit year
  - [ ] 1.4 Parse `DATE` and `YEAR` vorbis comments in the FLAC parsing path
  - [ ] 1.5 Write unit tests covering ID3v2.2/v2.3/v2.4 year extraction and FLAC DATE parsing, including edge cases (missing frames, malformed dates)

- [ ] 2.0 Store and cache Dropbox album release dates in IndexedDB
  - [ ] 2.1 Bump the DB version in `dropboxArtCache.ts` and add a `trackDates` object store in `onupgradeneeded`
  - [ ] 2.2 Add `putTrackDate()` and `getTrackDatesMap()` helper functions mirroring the existing `putTagMetadata`/`getTagsMap` pattern
  - [ ] 2.3 Add an optional `releaseDate` field to `MediaCollection` in `domain.ts`
  - [ ] 2.4 In `dropboxCatalogAdapter.ts`, implement a `scanAlbumDatesInBackground()` method that fetches the first ~10KB of one representative track per album, parses the year via `id3Parser`, and stores it via `putTrackDate()`
  - [ ] 2.5 Call the background scan after `putCatalogCache()` completes, processing albums progressively (batch of 5 with small delays) to avoid rate limiting
  - [ ] 2.6 In `listTracks()` / `listCollections()`, hydrate `releaseDate` on Dropbox `MediaCollection` objects from cached track dates

- [ ] 3.0 Fix release date sorting for albums with missing dates
  - [ ] 3.1 Update `extractYear()` in `playlistFilters.ts` to return `null` (instead of `0`) when no release date is present
  - [ ] 3.2 Update `filterAndSortAlbums()` so that `release-newest` and `release-oldest` sorts push albums with `null` year to the end of the list
  - [ ] 3.3 Write unit tests verifying that dated albums sort correctly and undated albums always appear last regardless of sort direction

- [ ] 4.0 Build filter chip row component
  - [ ] 4.1 Create `FilterChips.tsx` with styled components: `ChipRow` (horizontal scroll, hidden scrollbar), `Chip` (pill style, toggleable active state), `SearchChipInput` (expandable inline search)
  - [ ] 4.2 Implement `SearchChip` — collapsed shows magnifying glass icon; tapped expands into an inline text input with clear/close button; auto-focuses on expand
  - [ ] 4.3 Implement `SortChip` — shows current sort label; tapping opens a popover/dropdown with sort options; selecting an option updates sort and closes
  - [ ] 4.4 Implement `ProviderChips` — one chip per connected provider; toggleable; defaults to all active; filters album/playlist list by provider
  - [ ] 4.5 Implement `ArtistChips` (Albums tab only) — compute top 10-15 artists by album count; show as chips; include "More..." chip that opens a scrollable list; tapping filters to that artist
  - [ ] 4.6 Add "Clear filters" chip/button that appears when any filter is active
  - [ ] 4.7 Ensure touch targets are ≥44px and chip row works well on mobile (no horizontal overflow issues, smooth scroll)

- [ ] 5.0 Integrate filter chips into PlaylistSelection
  - [ ] 5.1 Add the `ChipRow` below the tab bar in `PlaylistSelection.tsx`, passing current filter state and callbacks
  - [ ] 5.2 Wire provider chip toggles to filter the displayed playlists/albums by `collection.provider`
  - [ ] 5.3 Wire artist chip selection to the existing `artistFilter` state
  - [ ] 5.4 Wire search chip to the existing `searchQuery` state, replacing the always-visible search input in drawer mode
  - [ ] 5.5 Wire sort chip to the existing sort state, replacing the `<select>` dropdown in drawer mode
  - [ ] 5.6 Keep existing search/sort controls visible in desktop (non-drawer) mode; chip row is additive there
  - [ ] 5.7 Write tests verifying chip interactions update filter state and result lists correctly
  - [ ] 5.8 Run full build verification (`npx tsc --noEmit`, `npm run build`, `npm run test:run`)
