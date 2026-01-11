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
