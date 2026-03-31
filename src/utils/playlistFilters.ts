import type { PlaylistInfo, AlbumInfo } from '../services/spotify';
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
 */
export function filterPlaylistsOnly(playlists: PlaylistInfo[], searchQuery: string): PlaylistInfo[] {
  return playlists.filter(p => matchesSearch(p, searchQuery));
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
 * Filter and sort playlists based on search query and sort option
 */
export function filterAndSortPlaylists(
  playlists: PlaylistInfo[],
  searchQuery: string,
  sortOption: PlaylistSortOption
): PlaylistInfo[] {
  const filtered = filterPlaylistsOnly(playlists, searchQuery);
  return sortPlaylistSubgroup(filtered, sortOption);
}

/**
 * Filter albums by search, decade, and artist (no sorting).
 */
export function filterAlbumsOnly(
  albums: AlbumInfo[],
  searchQuery: string,
  yearFilter: YearFilterOption = 'all',
  artistFilter: string = ''
): AlbumInfo[] {
  let result = albums.filter(a => matchesSearch(a, searchQuery));

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
 * Filter and sort albums based on search query, sort option, year filter, and artist filter
 */
export function filterAndSortAlbums(
  albums: AlbumInfo[],
  searchQuery: string,
  sortOption: AlbumSortOption,
  yearFilter: YearFilterOption = 'all',
  artistFilter: string = ''
): AlbumInfo[] {
  const filtered = filterAlbumsOnly(albums, searchQuery, yearFilter, artistFilter);
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
