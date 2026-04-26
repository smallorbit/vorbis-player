import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CachedPlaylistInfo } from '@/services/cache/cacheTypes';
import type { AlbumInfo, SpotifyImage } from '@/services/spotify';
import type { RecentlyPlayedEntry } from '@/hooks/useRecentlyPlayedCollections';

const { mockRecentlyPlayed, mockLibrarySync } = vi.hoisted(() => ({
  mockRecentlyPlayed: vi.fn(),
  mockLibrarySync: vi.fn(),
}));

vi.mock('@/hooks/useRecentlyPlayedCollections', () => ({
  useRecentlyPlayedCollections: () => mockRecentlyPlayed(),
}));

vi.mock('@/hooks/useLibrarySync', () => ({
  useLibrarySync: () => mockLibrarySync(),
}));

import { useRecentlyPlayedSection } from '../useRecentlyPlayedSection';

function makePlaylist(id: string, imageUrl: string | null = null, provider = 'spotify'): CachedPlaylistInfo {
  const images: SpotifyImage[] = imageUrl ? [{ url: imageUrl, height: null, width: null }] : [];
  return {
    id,
    name: `Playlist ${id}`,
    description: null,
    images,
    tracks: { total: 0 },
    owner: null,
    provider: provider as CachedPlaylistInfo['provider'],
  };
}

function makeAlbum(id: string, imageUrl: string | null = null, provider = 'spotify'): AlbumInfo {
  const images: SpotifyImage[] = imageUrl ? [{ url: imageUrl, height: null, width: null }] : [];
  return {
    id,
    name: `Album ${id}`,
    artists: 'Test',
    images,
    release_date: '2024-01-01',
    total_tracks: 1,
    uri: `spotify:album:${id}`,
    provider: provider as AlbumInfo['provider'],
  };
}

describe('useRecentlyPlayedSection', () => {
  beforeEach(() => {
    mockRecentlyPlayed.mockReset();
    mockLibrarySync.mockReset();
    mockLibrarySync.mockReturnValue({ playlists: [], albums: [] });
  });

  it('returns empty when history is empty', () => {
    // #given
    mockRecentlyPlayed.mockReturnValue({ history: [] });

    // #when
    const { result } = renderHook(() => useRecentlyPlayedSection());

    // #then
    expect(result.current.items).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('preserves entry imageUrl when already present', () => {
    // #given
    const entry: RecentlyPlayedEntry = {
      ref: { provider: 'spotify', kind: 'playlist', id: 'p1' },
      name: 'Already has art',
      imageUrl: 'https://existing.example/art.png',
    };
    mockRecentlyPlayed.mockReturnValue({ history: [entry] });
    mockLibrarySync.mockReturnValue({
      playlists: [makePlaylist('p1', 'https://different.example/art.png')],
      albums: [],
    });

    // #when
    const { result } = renderHook(() => useRecentlyPlayedSection());

    // #then
    expect(result.current.items[0].imageUrl).toBe('https://existing.example/art.png');
  });

  it('hydrates playlist imageUrl from useLibrarySync match by provider+id', () => {
    // #given
    const entry: RecentlyPlayedEntry = {
      ref: { provider: 'spotify', kind: 'playlist', id: 'p1' },
      name: 'No art',
    };
    mockRecentlyPlayed.mockReturnValue({ history: [entry] });
    mockLibrarySync.mockReturnValue({
      playlists: [makePlaylist('p1', 'https://hydrated.example/art.png')],
      albums: [],
    });

    // #when
    const { result } = renderHook(() => useRecentlyPlayedSection());

    // #then
    expect(result.current.items[0].imageUrl).toBe('https://hydrated.example/art.png');
  });

  it('hydrates album imageUrl from useLibrarySync match by provider+id', () => {
    // #given
    const entry: RecentlyPlayedEntry = {
      ref: { provider: 'spotify', kind: 'album', id: 'a1' },
      name: 'Album',
    };
    mockRecentlyPlayed.mockReturnValue({ history: [entry] });
    mockLibrarySync.mockReturnValue({
      playlists: [],
      albums: [makeAlbum('a1', 'https://album.example/art.png')],
    });

    // #when
    const { result } = renderHook(() => useRecentlyPlayedSection());

    // #then
    expect(result.current.items[0].imageUrl).toBe('https://album.example/art.png');
  });

  it('passes through entry unchanged when no match in library', () => {
    // #given
    const entry: RecentlyPlayedEntry = {
      ref: { provider: 'spotify', kind: 'playlist', id: 'missing' },
      name: 'Orphan',
    };
    mockRecentlyPlayed.mockReturnValue({ history: [entry] });

    // #when
    const { result } = renderHook(() => useRecentlyPlayedSection());

    // #then
    expect(result.current.items[0]).toBe(entry);
    expect(result.current.items[0].imageUrl).toBeUndefined();
  });
});
