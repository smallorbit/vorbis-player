# Implementation Plan: Library Sort, Search & Filter

> **Status:** Ready for Implementation
> **Approach:** Pragmatic Balance
> **Estimated Time:** 4-6 hours
> **Created:** January 2025

## Overview

Add sorting, searching, and filtering capabilities to the playlist/album library selection view so users can quickly find music to play.

## Feature Requirements

### Sort Options

**Playlists:**
- Name (A-Z / Z-A)
- Recently Added (default) - most recent first

**Albums:**
- Name (A-Z / Z-A)
- Artist (A-Z / Z-A)
- Release Date (Newest / Oldest)
- Recently Added (default) - most recent first

### Search

- Real-time filtering as user types (no debouncing needed - filtering <500 items is <10ms)
- Matches multiple fields: name, artist, owner, description
- Case-insensitive
- Applies to both playlists and albums

### Filters

- **Albums only:** Filter by release decade (2020s, 2010s, 2000s, 1990s, 1980s, older)
- Genre filtering: Skipped for now (would require extra API calls for artist data)

### UI Design

- Minimal controls positioned **above the tabs**
- Search box (full-width on mobile, flex on desktop)
- Sort dropdown (small, compact)
- Year filter dropdown (Albums tab only)
- "Clear Filters" button when filters are active

### Persistence

- **Sort order:** Persisted to localStorage (separate keys for playlists/albums)
- **Search query:** Cleared on page reload (transient)
- **Year filter:** Cleared on page reload (transient)

### Default Behavior

- Default sort: "Recently Added" (most recent first)
- Requires capturing `added_at` timestamps from Spotify API

---

## Architecture Decision

**Chosen Approach: Pragmatic Balance**

Extract only the complex filter/sort logic to a utility file, keep simple UI inline in the component.

### What Gets Extracted

1. **`src/utils/playlistFilters.ts`** - Pure functions for search, sort, and filter logic
2. **`src/utils/__tests__/playlistFilters.test.ts`** - Unit tests for the utility

### What Stays Inline

- Search input JSX (simple `<input>`, 3-5 lines)
- Sort dropdown JSX (native `<select>`, 10-15 lines)
- Year filter dropdown (conditional, 10 lines)
- State management (`useState` + `useLocalStorage`)
- `useMemo` for filtered/sorted data

### Rationale

- Filter/sort logic is ~100 lines of complex code worth testing in isolation
- UI is simple JSX that doesn't warrant separate components
- Matches YAGNI principle - can extract components later if needed
- Fast to implement while maintaining testability

---

## Files to Create

### 1. `src/utils/playlistFilters.ts` (~150 lines)

**Purpose:** Pure functions for all search, sort, and filter operations.

```typescript
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
  let result = playlists.filter(p => matchesSearch(p, searchQuery));

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
 * Filter and sort albums based on search query, sort option, and year filter
 */
export function filterAndSortAlbums(
  albums: AlbumInfo[],
  searchQuery: string,
  sortOption: AlbumSortOption,
  yearFilter: YearFilterOption = 'all'
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

  // Step 3: Sort
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
```

### 2. `src/utils/__tests__/playlistFilters.test.ts` (~200 lines)

**Purpose:** Unit tests for filter/sort logic.

```typescript
import { describe, it, expect } from 'vitest';
import {
  filterAndSortPlaylists,
  filterAndSortAlbums,
  getAvailableDecades,
  type PlaylistSortOption,
  type AlbumSortOption,
  type YearFilterOption
} from '../playlistFilters';
import type { PlaylistInfo, AlbumInfo } from '../../services/spotify';

// ============================================================
// TEST DATA
// ============================================================

const mockPlaylists: PlaylistInfo[] = [
  {
    id: '1',
    name: 'Chill Vibes',
    description: 'Relaxing music for focus',
    images: [],
    tracks: { total: 50 },
    owner: { display_name: 'John Doe' },
    added_at: '2024-06-15T10:00:00Z'
  },
  {
    id: '2',
    name: 'Workout Mix',
    description: 'High energy beats',
    images: [],
    tracks: { total: 30 },
    owner: { display_name: 'Jane Smith' },
    added_at: '2025-01-01T10:00:00Z'
  },
  {
    id: '3',
    name: 'Road Trip',
    description: null,
    images: [],
    tracks: { total: 75 },
    owner: { display_name: 'John Doe' },
    added_at: '2024-12-01T10:00:00Z'
  }
];

const mockAlbums: AlbumInfo[] = [
  {
    id: '1',
    name: 'Abbey Road',
    artists: 'The Beatles',
    images: [],
    release_date: '1969-09-26',
    total_tracks: 17,
    uri: 'spotify:album:1',
    added_at: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    name: 'Thriller',
    artists: 'Michael Jackson',
    images: [],
    release_date: '1982-11-30',
    total_tracks: 9,
    uri: 'spotify:album:2',
    added_at: '2025-01-05T10:00:00Z'
  },
  {
    id: '3',
    name: 'Random Access Memories',
    artists: 'Daft Punk',
    images: [],
    release_date: '2013-05-17',
    total_tracks: 13,
    uri: 'spotify:album:3',
    added_at: '2024-08-20T10:00:00Z'
  }
];

// ============================================================
// PLAYLIST TESTS
// ============================================================

describe('filterAndSortPlaylists', () => {
  describe('search filtering', () => {
    it('returns all playlists when search is empty', () => {
      const result = filterAndSortPlaylists(mockPlaylists, '', 'recently-added');
      expect(result).toHaveLength(3);
    });

    it('filters by playlist name (case-insensitive)', () => {
      const result = filterAndSortPlaylists(mockPlaylists, 'chill', 'recently-added');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Chill Vibes');
    });

    it('filters by description', () => {
      const result = filterAndSortPlaylists(mockPlaylists, 'energy', 'recently-added');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Workout Mix');
    });

    it('filters by owner name', () => {
      const result = filterAndSortPlaylists(mockPlaylists, 'john', 'recently-added');
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no matches', () => {
      const result = filterAndSortPlaylists(mockPlaylists, 'nonexistent', 'recently-added');
      expect(result).toHaveLength(0);
    });
  });

  describe('sorting', () => {
    it('sorts by name ascending', () => {
      const result = filterAndSortPlaylists(mockPlaylists, '', 'name-asc');
      expect(result[0].name).toBe('Chill Vibes');
      expect(result[1].name).toBe('Road Trip');
      expect(result[2].name).toBe('Workout Mix');
    });

    it('sorts by name descending', () => {
      const result = filterAndSortPlaylists(mockPlaylists, '', 'name-desc');
      expect(result[0].name).toBe('Workout Mix');
      expect(result[2].name).toBe('Chill Vibes');
    });

    it('sorts by recently added (most recent first)', () => {
      const result = filterAndSortPlaylists(mockPlaylists, '', 'recently-added');
      expect(result[0].name).toBe('Workout Mix'); // 2025-01-01
      expect(result[1].name).toBe('Road Trip');   // 2024-12-01
      expect(result[2].name).toBe('Chill Vibes'); // 2024-06-15
    });
  });
});

// ============================================================
// ALBUM TESTS
// ============================================================

describe('filterAndSortAlbums', () => {
  describe('search filtering', () => {
    it('filters by album name', () => {
      const result = filterAndSortAlbums(mockAlbums, 'abbey', 'recently-added');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Abbey Road');
    });

    it('filters by artist name', () => {
      const result = filterAndSortAlbums(mockAlbums, 'beatles', 'recently-added');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Abbey Road');
    });
  });

  describe('year filtering', () => {
    it('returns all when filter is "all"', () => {
      const result = filterAndSortAlbums(mockAlbums, '', 'recently-added', 'all');
      expect(result).toHaveLength(3);
    });

    it('filters by decade (1980s)', () => {
      const result = filterAndSortAlbums(mockAlbums, '', 'recently-added', '1980s');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Thriller'); // 1982
    });

    it('filters by decade (2010s)', () => {
      const result = filterAndSortAlbums(mockAlbums, '', 'recently-added', '2010s');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Random Access Memories'); // 2013
    });

    it('filters older albums (pre-1980)', () => {
      const result = filterAndSortAlbums(mockAlbums, '', 'recently-added', 'older');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Abbey Road'); // 1969
    });
  });

  describe('sorting', () => {
    it('sorts by artist ascending', () => {
      const result = filterAndSortAlbums(mockAlbums, '', 'artist-asc');
      expect(result[0].artists).toBe('Daft Punk');
      expect(result[1].artists).toBe('Michael Jackson');
      expect(result[2].artists).toBe('The Beatles');
    });

    it('sorts by release date newest first', () => {
      const result = filterAndSortAlbums(mockAlbums, '', 'release-newest');
      expect(result[0].name).toBe('Random Access Memories'); // 2013
      expect(result[1].name).toBe('Thriller');               // 1982
      expect(result[2].name).toBe('Abbey Road');             // 1969
    });

    it('sorts by release date oldest first', () => {
      const result = filterAndSortAlbums(mockAlbums, '', 'release-oldest');
      expect(result[0].name).toBe('Abbey Road');             // 1969
      expect(result[2].name).toBe('Random Access Memories'); // 2013
    });

    it('sorts by recently added', () => {
      const result = filterAndSortAlbums(mockAlbums, '', 'recently-added');
      expect(result[0].name).toBe('Thriller');               // 2025-01-05
      expect(result[1].name).toBe('Random Access Memories'); // 2024-08-20
      expect(result[2].name).toBe('Abbey Road');             // 2024-01-15
    });
  });

  describe('combined search + filter + sort', () => {
    it('applies search, year filter, and sort together', () => {
      // Searching for empty, filtering 1980s, sorting by name
      const result = filterAndSortAlbums(mockAlbums, '', 'name-asc', '1980s');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Thriller');
    });
  });
});

// ============================================================
// UTILITY TESTS
// ============================================================

describe('getAvailableDecades', () => {
  it('returns unique decades from album collection', () => {
    const decades = getAvailableDecades(mockAlbums);
    expect(decades).toContain('2010s');
    expect(decades).toContain('1980s');
    expect(decades).toContain('older');
    expect(decades).not.toContain('2020s');
  });

  it('returns decades in chronological order (recent first)', () => {
    const decades = getAvailableDecades(mockAlbums);
    const indexOf2010s = decades.indexOf('2010s');
    const indexOf1980s = decades.indexOf('1980s');
    const indexOfOlder = decades.indexOf('older');

    expect(indexOf2010s).toBeLessThan(indexOf1980s);
    expect(indexOf1980s).toBeLessThan(indexOfOlder);
  });
});
```

---

## Files to Modify

### 1. `src/services/spotify.ts`

#### Update `PlaylistInfo` interface (around line 458)

```typescript
export interface PlaylistInfo {
  id: string;
  name: string;
  description: string | null;
  images: { url: string; height: number | null; width: number | null }[];
  tracks: { total: number };
  owner: { display_name: string };
  added_at?: string; // NEW: ISO 8601 timestamp when added to library
}
```

#### Update `AlbumInfo` interface (around line 467)

```typescript
export interface AlbumInfo {
  id: string;
  name: string;
  artists: string;
  images: { url: string; height: number | null; width: number | null }[];
  release_date: string;
  total_tracks: number;
  uri: string;
  album_type?: string;
  added_at?: string; // NEW: ISO 8601 timestamp when saved to library
}
```

#### Update `getUserPlaylists()` mapping (around line 567)

**Note:** The Spotify `/me/playlists` endpoint does NOT return `added_at` for playlists. Use current timestamp as fallback:

```typescript
// Inside the mapping loop
playlists.push({
  id: playlist.id,
  name: playlist.name,
  description: playlist.description,
  images: playlist.images || [],
  tracks: { total: playlist.tracks.total },
  owner: { display_name: playlist.owner.display_name },
  added_at: new Date().toISOString() // Fallback - Spotify doesn't provide this
});
```

#### Update `getUserAlbums()` mapping (around line 622)

**Note:** The Spotify `/me/albums` endpoint DOES return `added_at` - capture it!

```typescript
// Inside the mapping loop - item structure is { added_at: string, album: {...} }
for (const item of data.items || []) {
  const album = item.album;
  albums.push({
    id: album.id,
    name: album.name,
    artists: album.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
    images: album.images || [],
    release_date: album.release_date || '',
    total_tracks: album.total_tracks || 0,
    uri: album.uri,
    album_type: album.album_type,
    added_at: item.added_at // NEW: Capture from API response
  });
}
```

---

### 2. `src/components/PlaylistSelection.tsx`

#### Add imports (at top of file)

```typescript
import { useMemo, useState } from 'react'; // Add useMemo if not already imported
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  filterAndSortPlaylists,
  filterAndSortAlbums,
  getAvailableDecades,
  type PlaylistSortOption,
  type AlbumSortOption,
  type YearFilterOption
} from '../utils/playlistFilters';
```

#### Add new styled components (after existing styled components, around line 169)

```typescript
const ControlsContainer = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 180px;
  padding: 0.5rem 0.75rem;
  background: rgba(115, 115, 115, 0.2);
  border: 1px solid rgba(115, 115, 115, 0.4);
  border-radius: 0.5rem;
  color: white;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s, background 0.2s;

  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  &:focus {
    background: rgba(115, 115, 115, 0.3);
    border-color: ${theme.colors.accent};
  }
`;

const SelectDropdown = styled.select`
  padding: 0.5rem 0.75rem;
  background: rgba(115, 115, 115, 0.2);
  border: 1px solid rgba(115, 115, 115, 0.4);
  border-radius: 0.5rem;
  color: white;
  font-size: 0.875rem;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s, background 0.2s;

  &:hover {
    background: rgba(115, 115, 115, 0.3);
  }

  &:focus {
    border-color: ${theme.colors.accent};
  }

  option {
    background: #262626;
    color: white;
  }
`;

const ClearButton = styled.button`
  padding: 0.5rem 0.75rem;
  background: rgba(115, 115, 115, 0.2);
  border: 1px solid rgba(115, 115, 115, 0.4);
  border-radius: 0.5rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(115, 115, 115, 0.3);
    color: white;
  }
`;
```

#### Add new state variables (after existing state, around line 237)

```typescript
// Search state (transient - cleared on reload)
const [searchQuery, setSearchQuery] = useState('');

// Sort state (persisted separately for playlists and albums)
const [playlistSort, setPlaylistSort] = useLocalStorage<PlaylistSortOption>(
  'vorbis-player-playlist-sort',
  'recently-added'
);
const [albumSort, setAlbumSort] = useLocalStorage<AlbumSortOption>(
  'vorbis-player-album-sort',
  'recently-added'
);

// Year filter state (transient)
const [yearFilter, setYearFilter] = useState<YearFilterOption>('all');
```

#### Add computed filtered/sorted lists (after state declarations)

```typescript
// Memoized filtered/sorted playlists
const filteredPlaylists = useMemo(() => {
  return filterAndSortPlaylists(playlists, searchQuery, playlistSort);
}, [playlists, searchQuery, playlistSort]);

// Memoized filtered/sorted albums
const filteredAlbums = useMemo(() => {
  return filterAndSortAlbums(albums, searchQuery, albumSort, yearFilter);
}, [albums, searchQuery, albumSort, yearFilter]);

// Available decades for filter dropdown
const availableDecades = useMemo(() => {
  return getAvailableDecades(albums);
}, [albums]);

// Reset year filter when switching to playlists view
useEffect(() => {
  if (viewMode === 'playlists' && yearFilter !== 'all') {
    setYearFilter('all');
  }
}, [viewMode, yearFilter]);
```

#### Add UI controls (insert before TabsContainer, around line 460)

```tsx
{/* Search/Sort/Filter Controls */}
{!isLoading && isAuthenticated && !error && (playlists.length > 0 || albums.length > 0 || likedSongsCount > 0) && (
  <ControlsContainer>
    <SearchInput
      type="text"
      placeholder={viewMode === 'playlists' ? 'Search playlists...' : 'Search albums...'}
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />

    {viewMode === 'playlists' ? (
      <SelectDropdown
        value={playlistSort}
        onChange={(e) => setPlaylistSort(e.target.value as PlaylistSortOption)}
      >
        <option value="recently-added">Recently Added</option>
        <option value="name-asc">Name (A-Z)</option>
        <option value="name-desc">Name (Z-A)</option>
      </SelectDropdown>
    ) : (
      <SelectDropdown
        value={albumSort}
        onChange={(e) => setAlbumSort(e.target.value as AlbumSortOption)}
      >
        <option value="recently-added">Recently Added</option>
        <option value="name-asc">Name (A-Z)</option>
        <option value="name-desc">Name (Z-A)</option>
        <option value="artist-asc">Artist (A-Z)</option>
        <option value="artist-desc">Artist (Z-A)</option>
        <option value="release-newest">Release (Newest)</option>
        <option value="release-oldest">Release (Oldest)</option>
      </SelectDropdown>
    )}

    {viewMode === 'albums' && availableDecades.length > 0 && (
      <SelectDropdown
        value={yearFilter}
        onChange={(e) => setYearFilter(e.target.value as YearFilterOption)}
      >
        <option value="all">All Years</option>
        {availableDecades.map(decade => (
          <option key={decade} value={decade}>
            {decade === 'older' ? 'Before 1980' : decade}
          </option>
        ))}
      </SelectDropdown>
    )}

    {(searchQuery || yearFilter !== 'all') && (
      <ClearButton
        onClick={() => {
          setSearchQuery('');
          setYearFilter('all');
        }}
      >
        Clear
      </ClearButton>
    )}
  </ControlsContainer>
)}
```

#### Update rendering to use filtered lists

**Change line ~506:** Replace `{playlists.map(...)}` with `{filteredPlaylists.map(...)}`

**Change line ~538:** Replace `{albums.map(...)}` with `{filteredAlbums.map(...)}`

**Update empty state messages (around line 527 and 556):**

```tsx
{/* Playlists empty state */}
{filteredPlaylists.length === 0 && likedSongsCount === 0 && (
  <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
    {searchQuery
      ? `No playlists match "${searchQuery}"`
      : 'No playlists found. Create some playlists in Spotify or save some songs!'
    }
  </div>
)}

{/* Albums empty state */}
{filteredAlbums.length === 0 && (
  <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
    {searchQuery || yearFilter !== 'all'
      ? 'No albums match your filters.'
      : 'No albums found. Save some albums in Spotify to see them here!'
    }
  </div>
)}
```

---

## Build Sequence (Task Checklist)

### Phase 1: Foundation (Types + Utilities)

- [ ] 1.1 Update `PlaylistInfo` interface in `src/services/spotify.ts` to add `added_at?: string`
- [ ] 1.2 Update `AlbumInfo` interface in `src/services/spotify.ts` to add `added_at?: string`
- [ ] 1.3 Create `src/utils/playlistFilters.ts` with all filter/sort functions
- [ ] 1.4 Create `src/utils/__tests__/playlistFilters.test.ts` with unit tests
- [ ] 1.5 Run tests: `npm run test:run` - verify all pass

### Phase 2: API Updates

- [ ] 2.1 Modify `getUserPlaylists()` to add `added_at` field (use current timestamp as fallback)
- [ ] 2.2 Modify `getUserAlbums()` to capture `item.added_at` from Spotify API response
- [ ] 2.3 Verify API responses include new fields (check console logs)

### Phase 3: Component Integration

- [ ] 3.1 Add imports to `PlaylistSelection.tsx` (useLocalStorage, filter utils, types)
- [ ] 3.2 Add styled components (ControlsContainer, SearchInput, SelectDropdown, ClearButton)
- [ ] 3.3 Add state variables (searchQuery, playlistSort, albumSort, yearFilter)
- [ ] 3.4 Add useMemo hooks (filteredPlaylists, filteredAlbums, availableDecades)
- [ ] 3.5 Add useEffect to reset year filter on tab switch
- [ ] 3.6 Add UI controls JSX before TabsContainer
- [ ] 3.7 Update `playlists.map()` → `filteredPlaylists.map()`
- [ ] 3.8 Update `albums.map()` → `filteredAlbums.map()`
- [ ] 3.9 Update empty state messages

### Phase 4: Testing & Polish

- [ ] 4.1 Test search on playlists (name, description, owner matching)
- [ ] 4.2 Test search on albums (name, artist matching)
- [ ] 4.3 Test all sort options for playlists
- [ ] 4.4 Test all sort options for albums
- [ ] 4.5 Test year filter with different decades
- [ ] 4.6 Test "Clear" button resets search and filter
- [ ] 4.7 Test sort persistence (reload page, verify sort retained)
- [ ] 4.8 Test search/filter cleared on reload
- [ ] 4.9 Test responsive layout (mobile, tablet, desktop)
- [ ] 4.10 Run `npm run build` to verify no TypeScript errors

### Phase 5: Documentation

- [ ] 5.1 Update CLAUDE.md with new feature documentation
- [ ] 5.2 Commit changes with descriptive message

---

## Performance Considerations

### No Debouncing Needed

- Filtering 100-500 items takes <10ms on modern devices
- Real-time filtering feels instant
- `useMemo` prevents re-computation on unrelated re-renders

### No Virtualization Needed

- Typical user has <200 playlists/albums
- Standard rendering performs well
- Add virtualization only if users report slowness with 500+ items

### Existing Optimizations Preserved

- Progressive loading (show cached data first)
- Image lazy loading (Intersection Observer)
- AbortController for request cancellation

---

## localStorage Keys

| Key | Type | Default | Persisted |
|-----|------|---------|-----------|
| `vorbis-player-playlist-sort` | `PlaylistSortOption` | `'recently-added'` | Yes |
| `vorbis-player-album-sort` | `AlbumSortOption` | `'recently-added'` | Yes |
| Search query | `string` | `''` | No (transient) |
| Year filter | `YearFilterOption` | `'all'` | No (transient) |

---

## Future Enhancements (Not Included)

These were discussed but deferred for later:

1. **Genre filtering** - Requires extra API calls to get artist genres
2. **Fuzzy search** - Could add fuse.js if users want typo tolerance
3. **Search history** - Show recent searches in dropdown
4. **Multi-select filters** - Filter by multiple decades simultaneously
5. **Custom filter presets** - Save favorite filter combinations

---

## Spotify API Notes

### Playlists (`/v1/me/playlists`)

- Does NOT return `added_at` timestamp
- We use current timestamp as fallback for "Recently Added" sort
- This means all existing playlists will have the same "added" date on first load

### Albums (`/v1/me/albums`)

- DOES return `added_at` timestamp per album
- Response structure: `{ items: [{ added_at: string, album: {...} }] }`
- "Recently Added" sort works accurately for albums

### Rate Limits

- No additional API calls needed for filtering (all client-side)
- Existing pagination handles large libraries (50 items per page)
