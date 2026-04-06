import { describe, it, expect } from 'vitest';
import { selectMosaicCovers, buildAlbumCoverMap } from '../mosaicSelection';

describe('selectMosaicCovers', () => {
  it('returns empty array when no albums have covers', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();
    map.set('album-a', { coverUrl: '', trackCount: 5 });

    // #when
    const result = selectMosaicCovers(map, 'playlist-1');

    // #then
    expect(result).toEqual([]);
  });

  it('returns single URL for one album with cover', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();
    map.set('album-a', { coverUrl: 'https://art/a.jpg', trackCount: 5 });

    // #when
    const result = selectMosaicCovers(map, 'playlist-1');

    // #then
    expect(result).toEqual(['https://art/a.jpg']);
  });

  it('returns 2 URLs for 2 albums sorted by track count', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();
    map.set('album-a', { coverUrl: 'https://art/a.jpg', trackCount: 3 });
    map.set('album-b', { coverUrl: 'https://art/b.jpg', trackCount: 7 });

    // #when
    const result = selectMosaicCovers(map, 'playlist-1');

    // #then
    expect(result).toEqual(['https://art/b.jpg', 'https://art/a.jpg']);
  });

  it('returns 2 URLs for 3 albums taking the top 2 by track count', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();
    map.set('album-a', { coverUrl: 'https://art/a.jpg', trackCount: 2 });
    map.set('album-b', { coverUrl: 'https://art/b.jpg', trackCount: 10 });
    map.set('album-c', { coverUrl: 'https://art/c.jpg', trackCount: 5 });

    // #when
    const result = selectMosaicCovers(map, 'playlist-1');

    // #then
    expect(result).toEqual(['https://art/b.jpg', 'https://art/c.jpg']);
  });

  it('returns 4 URLs for 4+ albums via weighted random', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();
    map.set('album-a', { coverUrl: 'https://art/a.jpg', trackCount: 10 });
    map.set('album-b', { coverUrl: 'https://art/b.jpg', trackCount: 8 });
    map.set('album-c', { coverUrl: 'https://art/c.jpg', trackCount: 6 });
    map.set('album-d', { coverUrl: 'https://art/d.jpg', trackCount: 4 });
    map.set('album-e', { coverUrl: 'https://art/e.jpg', trackCount: 2 });

    // #when
    const result = selectMosaicCovers(map, 'playlist-1');

    // #then
    expect(result).toHaveLength(4);
    const unique = new Set(result);
    expect(unique.size).toBe(4);
    for (const url of result) {
      expect(url).toMatch(/^https:\/\/art\/[a-e]\.jpg$/);
    }
  });

  it('produces stable results for the same playlist ID', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();
    for (let i = 0; i < 10; i++) {
      map.set(`album-${i}`, { coverUrl: `https://art/${i}.jpg`, trackCount: i + 1 });
    }

    // #when
    const result1 = selectMosaicCovers(map, 'stable-test');
    const result2 = selectMosaicCovers(map, 'stable-test');

    // #then
    expect(result1).toEqual(result2);
  });

  it('produces different results for different playlist IDs', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();
    for (let i = 0; i < 20; i++) {
      map.set(`album-${i}`, { coverUrl: `https://art/${i}.jpg`, trackCount: 5 });
    }

    // #when
    const result1 = selectMosaicCovers(map, 'playlist-alpha');
    const result2 = selectMosaicCovers(map, 'playlist-beta');

    // #then
    expect(result1).not.toEqual(result2);
  });

  it('skips albums with empty cover URLs', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();
    map.set('album-a', { coverUrl: 'https://art/a.jpg', trackCount: 5 });
    map.set('album-b', { coverUrl: '', trackCount: 10 });
    map.set('album-c', { coverUrl: 'https://art/c.jpg', trackCount: 3 });

    // #when
    const result = selectMosaicCovers(map, 'playlist-1');

    // #then
    expect(result).toEqual(['https://art/a.jpg', 'https://art/c.jpg']);
  });
});

describe('buildAlbumCoverMap', () => {
  it('groups tracks by albumId and counts them', () => {
    // #given
    const tracks = [
      { album: 'Album A', albumId: 'a1', image: 'https://art/a.jpg' },
      { album: 'Album A', albumId: 'a1', image: 'https://art/a.jpg' },
      { album: 'Album B', albumId: 'b1', image: 'https://art/b.jpg' },
    ];

    // #when
    const map = buildAlbumCoverMap(tracks);

    // #then
    expect(map.size).toBe(2);
    expect(map.get('a1')).toEqual({ coverUrl: 'https://art/a.jpg', trackCount: 2 });
    expect(map.get('b1')).toEqual({ coverUrl: 'https://art/b.jpg', trackCount: 1 });
  });

  it('falls back to album name when albumId is missing', () => {
    // #given
    const tracks = [
      { album: 'Album X', image: 'https://art/x.jpg' },
      { album: 'Album X', image: 'https://art/x.jpg' },
    ];

    // #when
    const map = buildAlbumCoverMap(tracks);

    // #then
    expect(map.size).toBe(1);
    expect(map.get('Album X')?.trackCount).toBe(2);
  });

  it('uses first available image for an album', () => {
    // #given
    const tracks = [
      { album: 'Album A', albumId: 'a1' },
      { album: 'Album A', albumId: 'a1', image: 'https://art/a.jpg' },
    ];

    // #when
    const map = buildAlbumCoverMap(tracks);

    // #then
    expect(map.get('a1')?.coverUrl).toBe('https://art/a.jpg');
  });
});
