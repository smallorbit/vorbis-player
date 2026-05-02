import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  initCache,
  closeCache,
  clearAll,
  putAllPlaylists,
  putAllAlbums,
  putTrackList,
} from '../libraryCache';
import { searchLibraryCache } from '../librarySearch';
import type { CachedPlaylistInfo } from '../cacheTypes';
import type { AlbumInfo, Track, SpotifyImage } from '../../spotify';

function makePlaylist(id: string, name: string): CachedPlaylistInfo {
  return {
    id,
    name,
    description: null,
    images: [] as SpotifyImage[],
    tracks: { total: 10 },
    owner: { display_name: 'TestUser' },
  };
}

function makeAlbum(id: string, name: string, artists = 'Test Artist'): AlbumInfo {
  return {
    id,
    name,
    artists,
    images: [] as SpotifyImage[],
    release_date: '2024-01-01',
    total_tracks: 12,
    uri: `spotify:album:${id}`,
    added_at: '2024-06-15T00:00:00Z',
  };
}

function makeTrack(id: string, name: string, artists = 'Test Artist', album = 'Test Album'): Track {
  return {
    id,
    provider: 'spotify',
    name,
    artists,
    album,
    duration_ms: 200_000,
    uri: `spotify:track:${id}`,
  };
}

describe('searchLibraryCache', () => {
  beforeEach(async () => {
    await initCache();
    await clearAll();
    closeCache();
    localStorage.clear();
    await initCache();
  });

  afterEach(() => {
    closeCache();
  });

  describe('empty query', () => {
    it('returns an empty categorized result for an empty string', async () => {
      // #given
      await putAllPlaylists([makePlaylist('p1', 'Rock Mix')]);

      // #when
      const result = await searchLibraryCache('');

      // #then
      expect(result).toEqual({ tracks: [], albums: [], artists: [], playlists: [] });
    });

    it('returns an empty result for whitespace-only queries', async () => {
      // #given
      await putAllPlaylists([makePlaylist('p1', 'Rock Mix')]);

      // #when
      const result = await searchLibraryCache('   \t\n ');

      // #then
      expect(result.tracks).toHaveLength(0);
      expect(result.albums).toHaveLength(0);
      expect(result.artists).toHaveLength(0);
      expect(result.playlists).toHaveLength(0);
    });
  });

  describe('substring matching', () => {
    it('matches playlists by name substring', async () => {
      // #given
      await putAllPlaylists([
        makePlaylist('p1', 'Rock Anthems'),
        makePlaylist('p2', 'Jazz Lounge'),
        makePlaylist('p3', 'Indie Rock Picks'),
      ]);

      // #when
      const result = await searchLibraryCache('rock');

      // #then
      expect(result.playlists.map((p) => p.id).sort()).toEqual(['p1', 'p3']);
    });

    it('matches albums by name or artist', async () => {
      // #given
      await putAllAlbums([
        makeAlbum('a1', 'Kid A', 'Radiohead'),
        makeAlbum('a2', 'Funeral', 'Arcade Fire'),
        makeAlbum('a3', 'Greatest Hits', 'Radiohead'),
      ]);

      // #when
      const byName = await searchLibraryCache('funeral');
      const byArtist = await searchLibraryCache('radiohead');

      // #then
      expect(byName.albums.map((a) => a.id)).toEqual(['a2']);
      expect(byArtist.albums.map((a) => a.id).sort()).toEqual(['a1', 'a3']);
    });

    it('matches tracks by name or artist', async () => {
      // #given
      await putTrackList('liked-songs', [
        makeTrack('t1', 'Karma Police', 'Radiohead'),
        makeTrack('t2', 'Wake Up', 'Arcade Fire'),
        makeTrack('t3', 'Idioteque', 'Radiohead'),
      ]);

      // #when
      const byName = await searchLibraryCache('karma');
      const byArtist = await searchLibraryCache('radiohead');

      // #then
      expect(byName.tracks.map((t) => t.id)).toEqual(['t1']);
      expect(byArtist.tracks.map((t) => t.id).sort()).toEqual(['t1', 't3']);
    });

    it('derives artists from cached tracks and albums', async () => {
      // #given
      await putAllAlbums([makeAlbum('a1', 'Funeral', 'Arcade Fire')]);
      await putTrackList('liked-songs', [makeTrack('t1', 'Karma Police', 'Radiohead')]);

      // #when
      const result = await searchLibraryCache('a');

      // #then
      const names = result.artists.map((a) => a.name).sort();
      expect(names).toEqual(['Arcade Fire', 'Radiohead']);
    });

    it('reads tracks from per-playlist and per-album track lists', async () => {
      // #given
      await putAllPlaylists([makePlaylist('p1', 'Mix')]);
      await putAllAlbums([makeAlbum('a1', 'Album One')]);
      await putTrackList('playlist:p1', [makeTrack('t1', 'Aurora', 'Foo')]);
      await putTrackList('album:a1', [makeTrack('t2', 'Aurelius', 'Bar')]);

      // #when
      const result = await searchLibraryCache('aur');

      // #then
      expect(result.tracks.map((t) => t.id).sort()).toEqual(['t1', 't2']);
    });
  });

  describe('case insensitivity', () => {
    it('matches regardless of query and field casing', async () => {
      // #given
      await putAllPlaylists([makePlaylist('p1', 'Late Night Vibes')]);
      await putAllAlbums([makeAlbum('a1', 'In Rainbows', 'Radiohead')]);
      await putTrackList('liked-songs', [makeTrack('t1', 'Reckoner', 'RADIOHEAD')]);

      // #when
      const upper = await searchLibraryCache('VIBES');
      const mixed = await searchLibraryCache('RaDiOhEaD');

      // #then
      expect(upper.playlists.map((p) => p.id)).toEqual(['p1']);
      expect(mixed.albums.map((a) => a.id)).toEqual(['a1']);
      expect(mixed.tracks.map((t) => t.id)).toEqual(['t1']);
    });
  });

  describe('category caps', () => {
    it('caps each category at 10 results by default', async () => {
      // #given
      const playlists = Array.from({ length: 15 }, (_, i) => makePlaylist(`p${i}`, `Match ${i}`));
      const albums = Array.from({ length: 15 }, (_, i) => makeAlbum(`a${i}`, `Match Album ${i}`));
      const tracks = Array.from({ length: 15 }, (_, i) =>
        makeTrack(`t${i}`, `Match Track ${i}`, `Match Artist ${i}`),
      );
      await putAllPlaylists(playlists);
      await putAllAlbums(albums);
      await putTrackList('liked-songs', tracks);

      // #when
      const result = await searchLibraryCache('match');

      // #then
      expect(result.playlists).toHaveLength(10);
      expect(result.albums).toHaveLength(10);
      expect(result.tracks).toHaveLength(10);
      expect(result.artists).toHaveLength(10);
    });

    it('honors a custom limitPerCategory', async () => {
      // #given
      const playlists = Array.from({ length: 8 }, (_, i) => makePlaylist(`p${i}`, `Match ${i}`));
      await putAllPlaylists(playlists);

      // #when
      const result = await searchLibraryCache('match', { limitPerCategory: 3 });

      // #then
      expect(result.playlists).toHaveLength(3);
    });
  });

  describe('no-match', () => {
    it('returns empty arrays when nothing matches', async () => {
      // #given
      await putAllPlaylists([makePlaylist('p1', 'Rock')]);
      await putAllAlbums([makeAlbum('a1', 'Funeral', 'Arcade Fire')]);
      await putTrackList('liked-songs', [makeTrack('t1', 'Karma Police', 'Radiohead')]);

      // #when
      const result = await searchLibraryCache('zzzzznothing');

      // #then
      expect(result.tracks).toHaveLength(0);
      expect(result.albums).toHaveLength(0);
      expect(result.artists).toHaveLength(0);
      expect(result.playlists).toHaveLength(0);
    });
  });

  describe('artistsData structured path', () => {
    it('derives artists from artistsData when present, matching and deduping by slug', async () => {
      // #given — two tracks sharing one artist via the structured artistsData array
      const trackWithArtistsData: Track = {
        ...makeTrack('t1', 'Lose Yourself', ''),
        artistsData: [
          { name: 'Eminem', url: 'https://open.spotify.com/artist/7dGJo4pcD2V6oG8kP0tJRR' },
        ],
      };
      const trackDuplicate: Track = {
        ...makeTrack('t2', 'Rap God', ''),
        artistsData: [
          { name: 'Eminem', url: 'https://open.spotify.com/artist/7dGJo4pcD2V6oG8kP0tJRR' },
        ],
      };
      await putTrackList('liked-songs', [trackWithArtistsData, trackDuplicate]);

      // #when
      const result = await searchLibraryCache('eminem');

      // #then — matched via artistsData, deduped to a single entry
      expect(result.artists).toEqual([{ id: 'eminem', name: 'Eminem' }]);
    });
  });

  describe('multi-source deduplication', () => {
    it('returns each track once when it appears in both liked-songs and a playlist', async () => {
      // #given — same track id stored in two separate track lists
      const sharedTrack = makeTrack('t1', 'Bohemian Rhapsody', 'Queen');
      await putAllPlaylists([makePlaylist('p1', 'Classics')]);
      await putTrackList('liked-songs', [sharedTrack]);
      await putTrackList('playlist:p1', [sharedTrack]);

      // #when
      const result = await searchLibraryCache('bohemian');

      // #then — deduplicated to a single result despite appearing in two lists
      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0].id).toBe('t1');
    });
  });

  describe('artist deduplication', () => {
    it('deduplicates artists across tracks and albums', async () => {
      // #given
      await putAllAlbums([
        makeAlbum('a1', 'Kid A', 'Radiohead'),
        makeAlbum('a2', 'In Rainbows', 'Radiohead'),
      ]);
      await putTrackList('liked-songs', [
        makeTrack('t1', 'Karma Police', 'Radiohead'),
        makeTrack('t2', 'Reckoner', 'Radiohead'),
      ]);

      // #when
      const result = await searchLibraryCache('radiohead');

      // #then
      expect(result.artists).toEqual([{ id: 'radiohead', name: 'Radiohead' }]);
    });

    it('splits comma-separated artist strings when matching', async () => {
      // #given
      await putTrackList('liked-songs', [
        makeTrack('t1', 'Track', 'Daft Punk, Pharrell Williams'),
      ]);

      // #when
      const result = await searchLibraryCache('pharrell');

      // #then
      expect(result.artists.map((a) => a.name)).toEqual(['Pharrell Williams']);
    });
  });
});
