import type { PlaylistInfo, AlbumInfo } from '../services/spotify';

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

export type YearFilterOption =
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
function extractYear(dateString: string | undefined): number {
  if (!dateString) return 0;
  const year = parseInt(dateString.substring(0, 4), 10);
  return isNaN(year) ? 0 : year;
}

/**
 * Parse ISO timestamp to epoch milliseconds for sorting
 */
function parseAddedAt(addedAt: string | undefined): number {
  if (!addedAt) return 0;
  const timestamp = new Date(addedAt).getTime();
  return isNaN(timestamp) ? 0 : timestamp;
}

/**
 * Check if a year falls within a decade filter
 */
function matchesYearFilter(year: number, filter: YearFilterOption): boolean {
  if (filter === 'all') return true;
  if (filter === 'older') return year < 1980;

  const decadeStart = parseInt(filter); // "2020s" -> 2020
  return year >= decadeStart && year < decadeStart + 10;
}

// ============================================================
// MAIN FILTER/SORT FUNCTIONS
// ============================================================

/**
 * Filter and sort playlists based on search query and sort option
 */
export function filterAndSortPlaylists(
  playlists: PlaylistInfo[],
  searchQuery: string,
  sortOption: PlaylistSortOption
): PlaylistInfo[] {
  // Step 1: Filter by search query
  const result = playlists.filter(p => matchesSearch(p, searchQuery));

  // Step 2: Sort
  switch (sortOption) {
    case 'name-asc':
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      result.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'recently-added':
    default:
      result.sort((a, b) => {
        const dateA = parseAddedAt(a.added_at);
        const dateB = parseAddedAt(b.added_at);
        return dateB - dateA; // Most recent first
      });
      break;
  }

  return result;
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
  // Step 1: Filter by search query
  let result = albums.filter(a => matchesSearch(a, searchQuery));

  // Step 2: Filter by year/decade
  if (yearFilter !== 'all') {
    result = result.filter(a => {
      const year = extractYear(a.release_date);
      return matchesYearFilter(year, yearFilter);
    });
  }

  // Step 3: Filter by artist
  if (artistFilter) {
    const normalizedArtistFilter = normalizeText(artistFilter);
    result = result.filter(a => normalizeText(a.artists).includes(normalizedArtistFilter));
  }

  // Step 4: Sort
  switch (sortOption) {
    case 'name-asc':
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      result.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'artist-asc':
      result.sort((a, b) => a.artists.localeCompare(b.artists));
      break;
    case 'artist-desc':
      result.sort((a, b) => b.artists.localeCompare(a.artists));
      break;
    case 'release-newest':
      result.sort((a, b) => {
        const yearA = extractYear(a.release_date);
        const yearB = extractYear(b.release_date);
        return yearB - yearA;
      });
      break;
    case 'release-oldest':
      result.sort((a, b) => {
        const yearA = extractYear(a.release_date);
        const yearB = extractYear(b.release_date);
        return yearA - yearB;
      });
      break;
    case 'recently-added':
    default:
      result.sort((a, b) => {
        const dateA = parseAddedAt(a.added_at);
        const dateB = parseAddedAt(b.added_at);
        return dateB - dateA; // Most recent first
      });
      break;
  }

  return result;
}

/**
 * Get unique decades from album collection for filter dropdown
 */
export function getAvailableDecades(albums: AlbumInfo[]): YearFilterOption[] {
  const decades = new Set<YearFilterOption>();

  albums.forEach(album => {
    const year = extractYear(album.release_date);
    if (year === 0) return;

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
