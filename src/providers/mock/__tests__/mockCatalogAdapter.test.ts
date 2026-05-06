import { describe, it, expect, beforeEach } from 'vitest';
import { MockCatalogAdapter } from '../mockCatalogAdapter';
import type { ProviderSnapshot } from '../../../../playwright/fixtures/data/snapshot.types';

const SNAPSHOT_SCHEMA_VERSION = 1;

function makeSnapshot(overrides?: Partial<ProviderSnapshot>): ProviderSnapshot {
  return {
    meta: {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      provider: 'spotify',
      anonymizationSeed: 'aabbccdd',
    },
    user: { displayName: 'Anonymous User', hashedId: 'user_00000000' },
    tracks: {
      'track-1': {
        id: 'track-1',
        name: 'Alpha',
        artists: [{ name: 'Artist One' }],
        artistsDisplay: 'Artist One',
        album: { id: 'album-1', name: 'Album A' },
        durationMs: 180000,
        ref: 'spotify:track:track-1',
      },
      'track-2': {
        id: 'track-2',
        name: 'Beta',
        artists: [{ name: 'Artist Two' }],
        artistsDisplay: 'Artist Two',
        album: { id: 'album-1', name: 'Album A' },
        durationMs: 240000,
        ref: 'spotify:track:track-2',
      },
      'track-3': {
        id: 'track-3',
        name: 'Gamma',
        artists: [{ name: 'Artist One' }],
        artistsDisplay: 'Artist One',
        album: { id: 'album-2', name: 'Album B' },
        durationMs: 120000,
        ref: 'spotify:track:track-3',
      },
    },
    playlists: [
      {
        id: 'playlist-1',
        name: 'My Playlist 1',
        description: '',
        ownerName: 'Anonymous User',
        trackCount: 2,
        revision: null,
        trackIds: ['track-1', 'track-2'],
      },
    ],
    albums: [
      {
        id: 'album-2',
        name: 'Album B',
        artists: [{ name: 'Artist One' }],
        trackCount: 1,
        trackIds: ['track-3'],
        image: { url: '/playwright-fixtures/art/album-2.jpg' },
      },
    ],
    likedTrackIds: ['track-1', 'track-3'],
    pins: { playlistIds: ['playlist-1'], albumIds: ['album-2'] },
    ...overrides,
  };
}

describe('MockCatalogAdapter (spotify)', () => {
  let adapter: MockCatalogAdapter;

  beforeEach(() => {
    adapter = new MockCatalogAdapter(makeSnapshot());
  });

  // #given a snapshot with 1 playlist, 1 album, 2 liked tracks
  // #when listCollections is called
  // #then returns playlist + album only — Liked Songs is exposed via getLikedCount,
  //  matching the real Spotify catalog's listCollections shape
  it('listCollections returns playlist + album', async () => {
    const collections = await adapter.listCollections();
    const kinds = collections.map(c => c.kind);
    expect(kinds).toContain('playlist');
    expect(kinds).toContain('album');
    expect(kinds).not.toContain('liked');
    expect(collections).toHaveLength(2);
  });

  it('listTracks resolves liked tracks', async () => {
    const tracks = await adapter.listTracks({ provider: 'spotify', kind: 'liked' });
    expect(tracks).toHaveLength(2);
    expect(tracks.map(t => t.id)).toEqual(expect.arrayContaining(['track-1', 'track-3']));
  });

  it('listTracks resolves playlist tracks', async () => {
    const tracks = await adapter.listTracks({ provider: 'spotify', kind: 'playlist', id: 'playlist-1' });
    expect(tracks).toHaveLength(2);
    expect(tracks[0].id).toBe('track-1');
    expect(tracks[1].id).toBe('track-2');
  });

  it('listTracks resolves album tracks', async () => {
    const tracks = await adapter.listTracks({ provider: 'spotify', kind: 'album', id: 'album-2' });
    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe('track-3');
  });

  it('listTracks returns empty for unknown playlist', async () => {
    const tracks = await adapter.listTracks({ provider: 'spotify', kind: 'playlist', id: 'nope' });
    expect(tracks).toHaveLength(0);
  });

  it('listTracks filters out broken liked refs with console.warn', async () => {
    const snapshot = makeSnapshot({ likedTrackIds: ['track-1', 'missing-id'] });
    const adapter2 = new MockCatalogAdapter(snapshot);
    const tracks = await adapter2.listTracks({ provider: 'spotify', kind: 'liked' });
    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe('track-1');
  });

  it('getLikedCount returns correct count', async () => {
    const count = await adapter.getLikedCount();
    expect(count).toBe(2);
  });

  it('isTrackSaved returns true for liked track', async () => {
    expect(await adapter.isTrackSaved('track-1')).toBe(true);
    expect(await adapter.isTrackSaved('track-2')).toBe(false);
  });

  it('setTrackSaved mutates in-memory set', async () => {
    await adapter.setTrackSaved('track-2', true);
    expect(await adapter.isTrackSaved('track-2')).toBe(true);
    await adapter.setTrackSaved('track-2', false);
    expect(await adapter.isTrackSaved('track-2')).toBe(false);
  });

  it('searchTrack finds by artist+title substring', async () => {
    const track = await adapter.searchTrack('Artist One', 'Alpha');
    expect(track?.id).toBe('track-1');
  });

  it('searchTrack returns null for no match', async () => {
    const track = await adapter.searchTrack('Unknown', 'Nothing');
    expect(track).toBeNull();
  });

  it('resolveDuration returns snapshot durationMs', async () => {
    const t = (await adapter.listTracks({ provider: 'spotify', kind: 'playlist', id: 'playlist-1' }))[0];
    const dur = await adapter.resolveDuration(t);
    expect(dur).toBe(180000);
  });

  it('resolveArtwork returns album image URL', async () => {
    const url = await adapter.resolveArtwork('album-2');
    expect(url).toBe('/playwright-fixtures/art/album-2.jpg');
  });
});

describe('MockCatalogAdapter (dropbox)', () => {
  it('listCollections includes All Music folder as first entry', async () => {
    const snapshot = makeSnapshot();
    (snapshot.meta as { provider: string }).provider = 'dropbox';
    const adapter = new MockCatalogAdapter(snapshot);
    const collections = await adapter.listCollections();
    expect(collections[0]).toMatchObject({ kind: 'folder', id: '', name: 'All Music' });
  });

  it('listTracks for folder id="" returns all tracks', async () => {
    const snapshot = makeSnapshot();
    (snapshot.meta as { provider: string }).provider = 'dropbox';
    const adapter = new MockCatalogAdapter(snapshot);
    const tracks = await adapter.listTracks({ provider: 'dropbox', kind: 'folder', id: '' });
    expect(tracks).toHaveLength(Object.keys(snapshot.tracks).length);
  });
});
