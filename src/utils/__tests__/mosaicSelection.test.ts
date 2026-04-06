import { describe, it, expect } from 'vitest';
import { selectMosaicCovers, buildAlbumCoverMap } from '../mosaicSelection';

describe('selectMosaicCovers', () => {
  it('returns empty array when map is empty', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();

    // #when
    const result = selectMosaicCovers(map, 'playlist-1');

    // #then
    expect(result).toEqual([]);
  });

  it('returns single album key for one album', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();
    map.set('/music/artist/album-a', { coverUrl: 'art-a', trackCount: 5 });

    // #when
    const result = selectMosaicCovers(map, 'playlist-1');

    // #then
    expect(result).toEqual(['/music/artist/album-a']);
  });

  it('returns 2 album keys for 2 albums sorted by track count', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();
    map.set('/music/artist/album-a', { coverUrl: 'art-a', trackCount: 3 });
    map.set('/music/artist/album-b', { coverUrl: 'art-b', trackCount: 7 });

    // #when
    const result = selectMosaicCovers(map, 'playlist-1');

    // #then
    expect(result).toEqual(['/music/artist/album-b', '/music/artist/album-a']);
  });

  it('returns 2 album keys for 3 albums taking top 2 by track count', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();
    map.set('album-a', { coverUrl: 'art-a', trackCount: 2 });
    map.set('album-b', { coverUrl: 'art-b', trackCount: 10 });
    map.set('album-c', { coverUrl: 'art-c', trackCount: 5 });

    // #when
    const result = selectMosaicCovers(map, 'playlist-1');

    // #then
    expect(result).toEqual(['album-b', 'album-c']);
  });

  it('returns 4 album keys for 4+ albums via weighted random', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();
    const albumKeys = ['album-a', 'album-b', 'album-c', 'album-d', 'album-e'];
    albumKeys.forEach((key, i) => map.set(key, { coverUrl: `art-${i}`, trackCount: 10 - i * 2 }));

    // #when
    const result = selectMosaicCovers(map, 'playlist-1');

    // #then
    expect(result).toHaveLength(4);
    expect(new Set(result).size).toBe(4);
    for (const key of result) {
      expect(albumKeys).toContain(key);
    }
  });

  it('produces stable results for the same playlist ID', () => {
    const map = new Map<string, { coverUrl: string; trackCount: number }>();
    for (let i = 0; i < 10; i++) {
      map.set(`album-${i}`, { coverUrl: `art-${i}`, trackCount: i + 1 });
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
      map.set(`album-${i}`, { coverUrl: `art-${i}`, trackCount: 5 });
    }

    // #when
    const result1 = selectMosaicCovers(map, 'playlist-alpha');
    const result2 = selectMosaicCovers(map, 'playlist-beta');

    // #then
    expect(result1).not.toEqual(result2);
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
