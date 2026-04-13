import type { PlaylistInfo, AlbumInfo } from '../services/spotify';
import type { MediaTrack } from '../types/domain';
import { LIBRARY_ALBUM_SORT_ANCHOR_IDS, LIBRARY_PLAYLIST_SORT_ANCHOR_IDS } from '../constants/playlist';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type PlaylistSortOption = 'name-asc' | 'name-desc' | 'recently-added';

export type AlbumSortOption =
  | 'name-asc'
  | 'name-desc'
  | 'artist-asc'
  | 'artist-desc'
  | 'release-newest'
  | 'release-oldest'
  | 'recently-added';

/**
 * Unified filter state for the library browser.
 *
 * Each field is optional — omitting it means "no filter applied" for that dimension.
 * The filter pipeline applies each non-empty filter in sequence:
 *   provider → collectionType → genres → recentlyAdded → searchQuery
 */
export interface FilterState {
  /** Only include items from these providers. Empty array = all providers. */
  provider?: string[];
  /** Only include playlists or albums. Undefined = all. */
  collectionType?: 'playlists' | 'albums';
  /** Only include items tagged with at least one of these genres. Empty array = all genres. */
  genres?: string[];
  /** Only include items added within this time window. 'all' or undefined = no restriction. */
  recentlyAdded?: 'all' | '7-days' | '30-days' | '1-year';
  /** Full-text search across title, artist, album. Empty string = no restriction. */
  searchQuery?: string;
}

export type RecentlyAddedFilterOption = FilterState['recentlyAdded'];

type YearFilterOption =
  | 'all'
  | '2020s'
  | '2010s'
  | '2000s'
  | '1990s'
  | '1980s'
  | 'older';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Normalize text for case-insensitive search
 */
function normalizeText(text: string | null | undefined): string {
  return (text || '').toLowerCase().trim();
}

/**
 * Check if an item matches the search query
 * Searches across multiple fields based on item type
 */
function matchesSearch(
  item: PlaylistInfo | AlbumInfo,
  query: string
): boolean {
  if (!query) return true;

  const normalizedQuery = normalizeText(query);

  // Common field: name
  if (normalizeText(item.name).includes(normalizedQuery)) {
    return true;
  }

  // Playlist-specific fields
  if ('owner' in item) {
    const playlist = item as PlaylistInfo;
    if (normalizeText(playlist.description).includes(normalizedQuery)) {
      return true;
    }
    if (normalizeText(playlist.owner?.display_name).includes(normalizedQuery)) {
      return true;
    }
  }

  // Album-specific fields
  if ('artists' in item) {
    const album = item as AlbumInfo;
    if (normalizeText(album.artists).includes(normalizedQuery)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract year from a date string (handles various Spotify formats)
 * Spotify returns: "2023", "2023-05", or "2023-05-15"
 */
function extractYear(dateString: string | undefined): number | null {
  if (!dateString) return null;
  const year = parseInt(dateString.substring(0, 4), 10);
  return isNaN(year) || year === 0 ? null : year;
}

/**
 * Parse added-at to epoch milliseconds for sorting (ISO strings or epoch ms).
 */
function parseAddedAt(addedAt: string | number | undefined): number {
  if (addedAt == null || addedAt === '') return 0;
  if (typeof addedAt === 'number') {
    return Number.isFinite(addedAt) ? addedAt : 0;
  }
  const timestamp = new Date(addedAt).getTime();
  return isNaN(timestamp) ? 0 : timestamp;
}

/**
 * Check if a year falls within a decade filter
 */
function matchesYearFilter(year: number | null, filter: YearFilterOption): boolean {
  if (filter === 'all') return true;
  if (year === null) return false;
  if (filter === 'older') return year < 1980;

  const decadeStart = parseInt(filter); // "2020s" -> 2020
  return year >= decadeStart && year < decadeStart + 10;
}

/**
 * Resolve the cutoff epoch ms for a recently-added time range.
 * Returns 0 for 'all' or undefined (no restriction).
 */
function recentlyAddedCutoffMs(timeRange: FilterState['recentlyAdded']): number {
  if (!timeRange || timeRange === 'all') return 0;
  const now = Date.now();
  const MS_PER_DAY = 86_400_000;
  switch (timeRange) {
    case '7-days':  return now - 7 * MS_PER_DAY;
    case '30-days': return now - 30 * MS_PER_DAY;
    case '1-year':  return now - 365 * MS_PER_DAY;
  }
}

// ============================================================
// UNIFIED FILTER HELPERS
// ============================================================

/**
 * Returns true when the item's provider is included in selectedProviders,
 * or when selectedProviders is empty (no restriction).
 */
export function matchesProviderFilter(
  itemProvider: string | undefined,
  selectedProviders: string[]
): boolean {
  if (selectedProviders.length === 0) return true;
  if (!itemProvider) return false;
  return selectedProviders.includes(itemProvider);
}

/**
 * Returns true when the item is tagged with at least one of the selected genres,
 * or when selectedGenres is empty (no restriction).
 * Items with no genres are excluded when a genre filter is active.
 */
export function matchesGenreFilter(itemGenres: string[] | undefined, selectedGenres: string[]): boolean {
  if (selectedGenres.length === 0) return true;
  if (!itemGenres || itemGenres.length === 0) return false;
  return selectedGenres.some(g => itemGenres.includes(g));
}

/**
 * Returns true when the item was added within the given time range,
 * or when the time range is 'all' / undefined (no restriction).
 */
export function matchesRecentlyAddedFilter(
  addedAt: string | number | undefined,
  timeRange: FilterState['recentlyAdded']
): boolean {
  const cutoff = recentlyAddedCutoffMs(timeRange);
  if (cutoff === 0) return true;
  const ts = parseAddedAt(addedAt);
  if (ts === 0) return false;
  return ts >= cutoff;
}

/**
 * Returns true when the track matches the search query across
 * name, artists, and album fields. Empty query always returns true.
 */
export function matchesSearchQuery(track: MediaTrack, searchQuery: string): boolean {
  if (!searchQuery) return true;
  const q = normalizeText(searchQuery);
  return (
    normalizeText(track.name).includes(q) ||
    normalizeText(track.artists).includes(q) ||
    normalizeText(track.album).includes(q)
  );
}

/**
 * Extract the sorted unique genres from a list of collections.
 * Collections with empty or missing genres arrays are skipped.
 */
export function getAvailableGenres(items: Array<{ genres?: string[] }>): string[] {
  const genreSet = new Set<string>();
  for (const item of items) {
    if (item.genres) {
      for (const g of item.genres) {
        if (g) genreSet.add(g);
      }
    }
  }
  return Array.from(genreSet).sort((a, b) => a.localeCompare(b));
}

// ============================================================
// UNIFIED FILTER APPLICATION
// ============================================================

/**
 * Apply a FilterState to a MediaTrack array.
 * Pipeline: provider → genres → recentlyAdded → searchQuery
 */
export function applyFilters(items: MediaTrack[], filterState: FilterState): MediaTrack[] {
  const { provider, genres, recentlyAdded, searchQuery } = filterState;
  const activeProvider = provider && provider.length > 0 ? provider : null;
  const activeGenres   = genres && genres.length > 0 ? genres : null;
  const activeCutoff   = recentlyAddedCutoffMs(recentlyAdded);
  const activeQuery    = searchQuery ? normalizeText(searchQuery) : null;

  return items.filter(track => {
    if (activeProvider && !activeProvider.includes(track.provider)) return false;
    if (activeGenres && !matchesGenreFilter((track as MediaTrack & { genres?: string[] }).genres, activeGenres)) return false;
    if (activeCutoff > 0) {
      const ts = typeof track.addedAt === 'number' ? track.addedAt : 0;
      if (ts === 0 || ts < activeCutoff) return false;
    }
    if (activeQuery) {
      if (
        !normalizeText(track.name).includes(activeQuery) &&
        !normalizeText(track.artists).includes(activeQuery) &&
        !normalizeText(track.album).includes(activeQuery)
      ) return false;
    }
    return true;
  });
}

/**
 * Apply a FilterState to an AlbumInfo array.
 * Pipeline: provider → genres → recentlyAdded → searchQuery
 */
export function applyAlbumFilters(albums: AlbumInfo[], filterState: FilterState): AlbumInfo[] {
  const { provider, genres, recentlyAdded, searchQuery } = filterState;
  const activeProvider = provider && provider.length > 0 ? provider : null;
  const activeGenres   = genres && genres.length > 0 ? genres : null;
  const activeCutoff   = recentlyAddedCutoffMs(recentlyAdded);

  return albums.filter(album => {
    if (activeProvider && !matchesProviderFilter(album.provider, activeProvider)) return false;
    if (activeGenres && !matchesGenreFilter((album as AlbumInfo & { genres?: string[] }).genres, activeGenres)) return false;
    if (activeCutoff > 0 && !matchesRecentlyAddedFilter(album.added_at, recentlyAdded)) return false;
    if (!matchesSearch(album, searchQuery ?? '')) return false;
    return true;
  });
}

// ============================================================
// MAIN FILTER/SORT FUNCTIONS
// ============================================================

function sortPlaylistArrayInPlace(playlists: PlaylistInfo[], sortOption: PlaylistSortOption): void {
  switch (sortOption) {
    case 'name-asc':
      playlists.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      playlists.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'recently-added':
    default:
      playlists.sort((a, b) => {
        const dateA = parseAddedAt(a.added_at);
        const dateB = parseAddedAt(b.added_at);
        return dateB - dateA; // Most recent first
      });
      break;
  }
}

/**
 * Filter playlists by search query (no sorting).
 * Genre filter is intentionally not applied here — PlaylistInfo carries no genre metadata.
 * The genre filter UI is most useful in album view where albums do carry genre tags.
 */
export function filterPlaylistsOnly(
  playlists: PlaylistInfo[],
  searchQuery: string,
  _selectedGenres: string[] = []
): PlaylistInfo[] {
  return playlists.filter((p) => matchesSearch(p, searchQuery));
}

/**
 * Sort playlists for the library UI: anchor collections keep catalog order, remaining items follow the sort option.
 */
export function sortPlaylistSubgroup(
  items: PlaylistInfo[],
  sortOption: PlaylistSortOption,
  anchorIds: ReadonlySet<string> = LIBRARY_PLAYLIST_SORT_ANCHOR_IDS
): PlaylistInfo[] {
  const anchors: PlaylistInfo[] = [];
  const rest: PlaylistInfo[] = [];
  for (const p of items) {
    if (anchorIds.has(p.id)) anchors.push(p);
    else rest.push(p);
  }
  sortPlaylistArrayInPlace(rest, sortOption);
  return [...anchors, ...rest];
}

/**
 * Filter and sort playlists based on search query, genre filter, and sort option.
 */
export function filterAndSortPlaylists(
  playlists: PlaylistInfo[],
  searchQuery: string,
  sortOption: PlaylistSortOption,
  selectedGenres: string[] = []
): PlaylistInfo[] {
  const filtered = filterPlaylistsOnly(playlists, searchQuery, selectedGenres);
  return sortPlaylistSubgroup(filtered, sortOption);
}

/**
 * Filter albums by search, decade, artist, and optional genre selection (no sorting).
 * When selectedGenres is non-empty, only albums whose genres overlap are shown.
 */
export function filterAlbumsOnly(
  albums: AlbumInfo[],
  searchQuery: string,
  yearFilter: YearFilterOption = 'all',
  artistFilter: string = '',
  selectedGenres: string[] = []
): AlbumInfo[] {
  let result = albums.filter(
    (a) => matchesSearch(a, searchQuery) && matchesGenreFilter(a.genres, selectedGenres)
  );

  if (yearFilter !== 'all') {
    result = result.filter(a => {
      const year = extractYear(a.release_date);
      return matchesYearFilter(year, yearFilter);
    });
  }

  if (artistFilter) {
    const normalizedArtistFilter = normalizeText(artistFilter);
    result = result.filter(a => normalizeText(a.artists).includes(normalizedArtistFilter));
  }

  return result;
}

function sortAlbumArrayInPlace(albums: AlbumInfo[], sortOption: AlbumSortOption): void {
  switch (sortOption) {
    case 'name-asc':
      albums.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      albums.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'artist-asc':
      albums.sort((a, b) => a.artists.localeCompare(b.artists));
      break;
    case 'artist-desc':
      albums.sort((a, b) => b.artists.localeCompare(a.artists));
      break;
    case 'release-newest':
      albums.sort((a, b) => {
        const yearA = extractYear(a.release_date);
        const yearB = extractYear(b.release_date);
        if (yearA === null && yearB === null) return 0;
        if (yearA === null) return 1;
        if (yearB === null) return -1;
        return yearB - yearA;
      });
      break;
    case 'release-oldest':
      albums.sort((a, b) => {
        const yearA = extractYear(a.release_date);
        const yearB = extractYear(b.release_date);
        if (yearA === null && yearB === null) return 0;
        if (yearA === null) return 1;
        if (yearB === null) return -1;
        return yearA - yearB;
      });
      break;
    case 'recently-added':
    default:
      albums.sort((a, b) => {
        const dateA = parseAddedAt(a.added_at);
        const dateB = parseAddedAt(b.added_at);
        return dateB - dateA;
      });
      break;
  }
}

/**
 * Sort albums for the library UI: anchor items keep catalog order, remaining items follow the sort option.
 */
export function sortAlbumSubgroup(
  items: AlbumInfo[],
  sortOption: AlbumSortOption,
  anchorIds: ReadonlySet<string> = LIBRARY_ALBUM_SORT_ANCHOR_IDS
): AlbumInfo[] {
  const anchors: AlbumInfo[] = [];
  const rest: AlbumInfo[] = [];
  for (const a of items) {
    if (anchorIds.has(a.id)) anchors.push(a);
    else rest.push(a);
  }
  sortAlbumArrayInPlace(rest, sortOption);
  return [...anchors, ...rest];
}

/**
 * Filter and sort albums based on search query, sort option, year filter, artist filter, and genre filter.
 */
export function filterAndSortAlbums(
  albums: AlbumInfo[],
  searchQuery: string,
  sortOption: AlbumSortOption,
  yearFilter: YearFilterOption = 'all',
  artistFilter: string = '',
  selectedGenres: string[] = []
): AlbumInfo[] {
  const filtered = filterAlbumsOnly(albums, searchQuery, yearFilter, artistFilter, selectedGenres);
  return sortAlbumSubgroup(filtered, sortOption);
}

/**
 * Get unique decades from album collection for filter dropdown
 */
export function getAvailableDecades(albums: AlbumInfo[]): YearFilterOption[] {
  const decades = new Set<YearFilterOption>();

  albums.forEach(album => {
    const year = extractYear(album.release_date);
    if (year === null) return;

    if (year >= 2020) decades.add('2020s');
    else if (year >= 2010) decades.add('2010s');
    else if (year >= 2000) decades.add('2000s');
    else if (year >= 1990) decades.add('1990s');
    else if (year >= 1980) decades.add('1980s');
    else decades.add('older');
  });

  // Return sorted (most recent first)
  const order: YearFilterOption[] = ['2020s', '2010s', '2000s', '1990s', '1980s', 'older'];
  return order.filter(d => decades.has(d));
}

/**
 * Partition items into pinned (in pin order) and unpinned (in original order).
 * Pinned items that don't exist in the items array are silently ignored.
 */
export function partitionByPinned<T>(
  items: T[],
  pinnedIds: string[],
  getId: (item: T) => string
): { pinned: T[]; unpinned: T[] } {
  if (pinnedIds.length === 0) {
    return { pinned: [], unpinned: items };
  }

  const pinnedSet = new Set(pinnedIds);
  const pinnedMap = new Map<string, T>();
  const unpinned: T[] = [];

  for (const item of items) {
    const id = getId(item);
    if (pinnedSet.has(id)) {
      pinnedMap.set(id, item);
    } else {
      unpinned.push(item);
    }
  }

  // Preserve pin insertion order
  const pinned: T[] = [];
  for (const id of pinnedIds) {
    const item = pinnedMap.get(id);
    if (item) {
      pinned.push(item);
    }
  }

  return { pinned, unpinned };
}

/**
 * From filtered library items, produce flat / pinned / unpinned lists.
 * With no pin ids, sorts the full list once; otherwise partitions by pins then sorts each subgroup
 * (same pattern as sortPlaylistSubgroup / sortAlbumSubgroup per subgroup).
 */
export function buildLibraryViewWithPins<T>(
  filtered: T[],
  pinnedIds: string[],
  getId: (item: T) => string,
  sortSubgroup: (items: T[]) => T[]
): { flat: T[]; pinned: T[]; unpinned: T[] } {
  if (pinnedIds.length === 0) {
    const sorted = sortSubgroup(filtered);
    return { flat: sorted, pinned: [], unpinned: sorted };
  }
  const { pinned, unpinned } = partitionByPinned(filtered, pinnedIds, getId);
  const pinnedSorted = sortSubgroup(pinned);
  const unpinnedSorted = sortSubgroup(unpinned);
  return {
    flat: [...pinnedSorted, ...unpinnedSorted],
    pinned: pinnedSorted,
    unpinned: unpinnedSorted,
  };
}
