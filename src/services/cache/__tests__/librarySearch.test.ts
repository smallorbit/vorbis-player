import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  initCache,
  closeCache,
  clearAll,
  replaceProviderPlaylists,
  replaceProviderAlbums,
  putTrackList,
} from '../libraryCache';
import { searchLibraryCache } from '../librarySearch';
import type { CollectionRef, MediaCollection, MediaTrack, ProviderId } from '@/types/domain';

const SPOTIFY_LIKED: CollectionRef = { provider: 'spotify', kind: 'liked' };
const DROPBOX_LIKED: CollectionRef = { provider: 'dropbox', kind: 'liked' };

function playlistRef(id: string): CollectionRef {
  return { provider: 'spotify', kind: 'playlist', id };
}

function albumRef(id: string): CollectionRef {
  return { provider: 'spotify', kind: 'album', id };
}

function makePlaylist(id: string, name: string): MediaCollection {
  return {
    id,
    provider: 'spotify',
    kind: 'playlist',
    name,
    trackCount: 10,
    ownerName: 'TestUser',
    genres: [],
  };
}

function makeAlbum(id: string, name: string, artists = 'Test Artist'): MediaCollection {
  return {
    id,
    provider: 'spotify',
    kind: 'album',
    name,
    ownerName: artists,
    trackCount: 12,
    releaseDate: '2024-01-01',
    genres: [],
  };
}

function makeTrack(
  id: string,
  name: string,
  artists = 'Test Artist',
  album = 'Test Album',
  provider: ProviderId = 'spotify',
): MediaTrack {
  return {
    id,
    provider,
    playbackRef: { provider, ref: `${provider}:track:${id}` },
    name,
    artists,
    album,
    durationMs: 200_000,
    genres: [],
  };
}

describe('searchLibraryCache', () => {
  beforeEach(async () => {
    await initCache();
    await clearAll();
  });

  afterEach(() => {
    closeCache();
  });

  describe('empty query', () => {
    it('returns an empty categorized result for an empty string', async () => {
      // #given
      await replaceProviderPlaylists('spotify', [makePlaylist('p1', 'Rock Mix')]);

      // #when
      const result = await searchLibraryCache('');

      // #then
      expect(result).toEqual({ tracks: [], albums: [], artists: [], playlists: [] });
    });

    it('returns an empty result for whitespace-only queries', async () => {
      // #given
      await replaceProviderPlaylists('spotify', [makePlaylist('p1', 'Rock Mix')]);

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
      await replaceProviderPlaylists('spotify', [
        makePlaylist('p1', 'Rock Anthems'),
        makePlaylist('p2', 'Jazz Lounge'),
        makePlaylist('p3', 'Indie Rock Picks'),
      ]);

      // #when
      const result = await searchLibraryCache('rock');

      // #then
      expect(result.playlists.map((p) => p.id).sort()).toEqual(['p1', 'p3']);
    });

    it('matches albums by name or owner (artist)', async () => {
      // #given
      await replaceProviderAlbums('spotify', [
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
      await putTrackList(SPOTIFY_LIKED, [
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
      await replaceProviderAlbums('spotify', [makeAlbum('a1', 'Funeral', 'Arcade Fire')]);
      await putTrackList(SPOTIFY_LIKED, [makeTrack('t1', 'Karma Police', 'Radiohead')]);

      // #when
      const result = await searchLibraryCache('a');

      // #then
      const names = result.artists.map((a) => a.name).sort();
      expect(names).toEqual(['Arcade Fire', 'Radiohead']);
    });

    it('reads tracks from per-playlist and per-album track lists', async () => {
      // #given
      await replaceProviderPlaylists('spotify', [makePlaylist('p1', 'Mix')]);
      await replaceProviderAlbums('spotify', [makeAlbum('a1', 'Album One')]);
      await putTrackList(playlistRef('p1'), [makeTrack('t1', 'Aurora', 'Foo')]);
      await putTrackList(albumRef('a1'), [makeTrack('t2', 'Aurelius', 'Bar')]);

      // #when
      const result = await searchLibraryCache('aur');

      // #then
      expect(result.tracks.map((t) => t.id).sort()).toEqual(['t1', 't2']);
    });

    it('reads liked track lists from every provider', async () => {
      // #given — liked songs cached for both providers
      await putTrackList(SPOTIFY_LIKED, [makeTrack('t1', 'Aurora', 'Foo')]);
      await putTrackList(DROPBOX_LIKED, [
        makeTrack('t2', 'Aurelius', 'Bar', 'Local Album', 'dropbox'),
      ]);

      // #when
      const result = await searchLibraryCache('aur');

      // #then — matches from both providers' liked lists
      expect(result.tracks.map((t) => `${t.provider}:${t.id}`).sort()).toEqual([
        'dropbox:t2',
        'spotify:t1',
      ]);
    });
  });

  describe('case insensitivity', () => {
    it('matches regardless of query and field casing', async () => {
      // #given
      await replaceProviderPlaylists('spotify', [makePlaylist('p1', 'Late Night Vibes')]);
      await replaceProviderAlbums('spotify', [makeAlbum('a1', 'In Rainbows', 'Radiohead')]);
      await putTrackList(SPOTIFY_LIKED, [makeTrack('t1', 'Reckoner', 'RADIOHEAD')]);

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
      await replaceProviderPlaylists('spotify', playlists);
      await replaceProviderAlbums('spotify', albums);
      await putTrackList(SPOTIFY_LIKED, tracks);

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
      await replaceProviderPlaylists('spotify', playlists);

      // #when
      const result = await searchLibraryCache('match', { limitPerCategory: 3 });

      // #then
      expect(result.playlists).toHaveLength(3);
    });
  });

  describe('no-match', () => {
    it('returns empty arrays when nothing matches', async () => {
      // #given
      await replaceProviderPlaylists('spotify', [makePlaylist('p1', 'Rock')]);
      await replaceProviderAlbums('spotify', [makeAlbum('a1', 'Funeral', 'Arcade Fire')]);
      await putTrackList(SPOTIFY_LIKED, [makeTrack('t1', 'Karma Police', 'Radiohead')]);

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
      const trackWithArtistsData: MediaTrack = {
        ...makeTrack('t1', 'Lose Yourself', ''),
        artistsData: [
          { name: 'Eminem', url: 'https://open.spotify.com/artist/7dGJo4pcD2V6oG8kP0tJRR' },
        ],
      };
      const trackDuplicate: MediaTrack = {
        ...makeTrack('t2', 'Rap God', ''),
        artistsData: [
          { name: 'Eminem', url: 'https://open.spotify.com/artist/7dGJo4pcD2V6oG8kP0tJRR' },
        ],
      };
      await putTrackList(SPOTIFY_LIKED, [trackWithArtistsData, trackDuplicate]);

      // #when
      const result = await searchLibraryCache('eminem');

      // #then — matched via artistsData, deduped to a single entry
      expect(result.artists).toEqual([{ id: 'eminem', name: 'Eminem' }]);
    });
  });

  describe('multi-source deduplication', () => {
    it('returns each track once when it appears in both liked songs and a playlist', async () => {
      // #given — same track id stored in two separate track lists
      const sharedTrack = makeTrack('t1', 'Bohemian Rhapsody', 'Queen');
      await replaceProviderPlaylists('spotify', [makePlaylist('p1', 'Classics')]);
      await putTrackList(SPOTIFY_LIKED, [sharedTrack]);
      await putTrackList(playlistRef('p1'), [sharedTrack]);

      // #when
      const result = await searchLibraryCache('bohemian');

      // #then — deduplicated to a single result despite appearing in two lists
      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0].id).toBe('t1');
    });

    it('keeps same-id tracks from different providers distinct', async () => {
      // #given — identical track id under two providers; dedupe key is "{provider}:{id}"
      await putTrackList(SPOTIFY_LIKED, [makeTrack('t1', 'Bohemian Rhapsody', 'Queen')]);
      await putTrackList(DROPBOX_LIKED, [
        makeTrack('t1', 'Bohemian Rhapsody', 'Queen', 'A Night at the Opera', 'dropbox'),
      ]);

      // #when
      const result = await searchLibraryCache('bohemian');

      // #then
      expect(result.tracks).toHaveLength(2);
      expect(result.tracks.map((t) => t.provider).sort()).toEqual(['dropbox', 'spotify']);
    });
  });

  describe('artist deduplication', () => {
    it('deduplicates artists across tracks and albums', async () => {
      // #given
      await replaceProviderAlbums('spotify', [
        makeAlbum('a1', 'Kid A', 'Radiohead'),
        makeAlbum('a2', 'In Rainbows', 'Radiohead'),
      ]);
      await putTrackList(SPOTIFY_LIKED, [
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
      await putTrackList(SPOTIFY_LIKED, [
        makeTrack('t1', 'Track', 'Daft Punk, Pharrell Williams'),
      ]);

      // #when
      const result = await searchLibraryCache('pharrell');

      // #then
      expect(result.artists.map((a) => a.name)).toEqual(['Pharrell Williams']);
    });
  });
});
