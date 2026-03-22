# PRD: Improve Library Browsing

## Introduction/Overview

The library browsing experience has two key problems: (1) on mobile, the search-first approach forces users to open the on-screen keyboard, which consumes ~40-50% of the screen and leaves little room to see results, and (2) Dropbox album release date sorting is completely broken because no date metadata is extracted from audio files.

This PRD addresses both issues: replacing the search-centric UI with browsable filter chips, and adding ID3/FLAC date extraction so Dropbox albums can be sorted by release year.

## Goals

1. Enable mobile library browsing without requiring the on-screen keyboard
2. Fix Dropbox album release date sorting by extracting year metadata from audio file tags
3. Make filtering more discoverable and touch-friendly across all device sizes

## User Stories

- As a mobile user, I want to browse my library by tapping filter chips (artist, provider) so I can find music without opening the keyboard.
- As a Dropbox user, I want my albums sorted by release year so I can find newer or older albums easily.
- As a user with a large library, I want to combine multiple filters (e.g., provider + artist) to quickly narrow down my collection.

## Functional Requirements

### Feature 1: Filter Chips for Library Browsing

1. **Chip Row**: Add a horizontal scrollable row of filter chips below the Playlists/Albums tab bar.

2. **Search Chip**: A "Search" chip that, when tapped, expands into an inline search input. The input can be dismissed by tapping a clear/close button or the chip again. The keyboard only appears when the user explicitly taps this chip.

3. **Sort Chip**: A chip that shows the current sort order (e.g., "Recently Added"). Tapping opens a dropdown/popover to select sort order. Replaces the current `<select>` dropdown.

4. **Provider Chips**: When multiple providers are connected, show a chip per provider (e.g., "Spotify", "Dropbox"). Tapping toggles that provider filter on/off. Multiple providers can be active simultaneously (default: all active). These complement (not replace) the existing LibraryProviderBar toggles — on mobile in the drawer, the chips may be the more accessible way to filter.

5. **Artist Chips**: In the Albums tab, show chips for the most frequently occurring artists (top 10-15 by album count). Include a "More..." chip that reveals the full artist list (e.g., in a scrollable popover or bottom sheet). Tapping an artist chip filters to that artist's albums. Currently artist filtering exists but is only accessible by clicking an artist name on an album card — chips make this discoverable.

6. **Chip Behavior**:
   - Chips are toggleable: tap to activate (filled/highlighted style), tap again to deactivate.
   - Multiple filter chips can be active simultaneously and combine (AND logic).
   - A "Clear filters" action appears when any filter is active.
   - Active chip count or summary shown when row is scrolled.

7. **Layout**:
   - Chip row scrolls horizontally with CSS `overflow-x: auto` and hidden scrollbar.
   - Chips use a compact pill style consistent with the app's design language.
   - On desktop, the chip row still appears but the existing search/sort controls can remain as-is (chips are additive, not a replacement on desktop).

8. **Mobile Optimization**:
   - Chip row is always visible without taking vertical space from the grid.
   - No keyboard appears until the user explicitly taps the Search chip.
   - Touch targets are at least 44px tall for accessibility.

### Feature 2: Dropbox Release Date Extraction

9. **ID3 Date Frame Parsing**: Extend `id3Parser.ts` to extract release year from:
   - **ID3v2.4**: `TDRC` frame (recording date, format: YYYY or YYYY-MM-DD)
   - **ID3v2.3**: `TYER` frame (year, format: YYYY)
   - **ID3v2.2**: `TYE` frame (year, format: YYYY)
   - **FLAC**: `DATE` vorbis comment (format: YYYY or YYYY-MM-DD)

10. **Lightweight Catalog Scan**: During Dropbox catalog discovery, perform a lightweight metadata scan:
    - Fetch only the first ~10KB of each audio file (range request) to read the ID3 header — date frames are near the start.
    - Only scan **one representative track per album** (e.g., the first track found in the folder) to minimize API calls.
    - Run the scan **progressively in the background** after the initial catalog loads, so the UI is immediately usable.
    - Cache extracted dates in IndexedDB alongside existing tag metadata.

11. **Album Date Derivation**: For each Dropbox album, derive `release_date` from the scanned track's year. Store this on the album's cached metadata so it persists across sessions.

12. **Sort Behavior for Missing Dates**: When sorting by release date, albums without extractable dates sort to the **end** of the list (after all dated albums). This applies to both Dropbox and any other provider where dates might be missing.

13. **Cache & Freshness**:
    - Date metadata is cached in IndexedDB and only re-scanned when the catalog detects new/changed files.
    - Existing cached dates survive catalog refreshes unless the underlying file changes.

## Non-Goals (Out of Scope)

- **Full metadata editor**: We won't build a UI to edit/correct release dates.
- **Genre extraction/filtering**: ID3 genre parsing and genre-based chips are out of scope for now.
- **Decade filter UI**: The existing decade filtering logic in `playlistFilters.ts` won't be exposed as a chip in this iteration (artist + provider chips are the priority).
- **Desktop redesign**: The chip row is additive on desktop; we're not overhauling the desktop library layout.
- **Batch file scanning for all metadata**: We only extract the date — full tag extraction during catalog scan (title, artist, etc.) remains a playback-time operation.

## Design Considerations

- Chip styling should follow the app's existing styled-components patterns and theme colors.
- Active chips should use the provider accent color or the app's green accent.
- The chip row should feel native to both iOS and Android web experiences.
- Transition between "search collapsed" and "search expanded" should be smooth (e.g., chip morphs into input field).
- Consider the interaction between chip filters and the existing LibraryProviderBar — provider chips in the chip row may eventually replace the provider bar in the drawer, but for now they coexist.

## Technical Considerations

- **ID3 range requests**: Dropbox API supports range requests (`Range: bytes=0-10240`). The `dropboxCatalogAdapter.ts` will need a new scan pass that fetches partial file content.
- **Progressive scanning**: Use a background queue (e.g., process 5 albums at a time with small delays) to avoid rate limiting and keep the UI responsive.
- **IndexedDB schema**: The existing `tags` store in `vorbis-dropbox-art` database may need a schema addition for `year`/`release_date`, or a new `albumMeta` store.
- **Type changes**: `MediaCollection` in `domain.ts` may need an optional `releaseDate` field, or the date can live on the provider-specific cached data and be mapped during filtering.
- **Filter state**: Chip filter state should be ephemeral (not persisted to localStorage), resetting when the drawer is closed. Sort order should remain persisted as it is today.

## Success Metrics

- Mobile users can browse and filter their library without opening the keyboard.
- Dropbox albums sort correctly by release year when date metadata is present in audio files.
- Filter chips are discoverable — users engage with them without needing instructions.

## Open Questions

1. Should provider chips replace the LibraryProviderBar in the drawer, or coexist? (Starting with coexist.)
2. For very large Dropbox libraries (500+ albums), should the background date scan show a progress indicator?
3. Should we show the extracted year as a visual badge on album cards?
