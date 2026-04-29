import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installMockTestApi } from '../test-control';
import type { MockCatalogAdapter } from '../mockCatalogAdapter';
import type { MockPlaybackAdapter } from '../mockPlaybackAdapter';
import type { MediaTrack } from '@/types/domain';

function makeTrack(overrides: Partial<MediaTrack> & Pick<MediaTrack, 'id' | 'provider'>): MediaTrack {
  return {
    name: `Track ${overrides.id}`,
    artists: 'Artist',
    album: 'Album',
    albumId: 'album-1',
    durationMs: 180000,
    playbackRef: { provider: overrides.provider, ref: `${overrides.provider}:track:${overrides.id}` },
    genres: [],
    ...overrides,
  };
}

function makeCatalogStub(tracks: MediaTrack[]): MockCatalogAdapter {
  const map = new Map(tracks.map(t => [t.id, t]));
  return {
    getTrackById: (id: string) => map.get(id),
  } as unknown as MockCatalogAdapter;
}

function makePlaybackStub(): MockPlaybackAdapter {
  return {
    playTrack: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
  } as unknown as MockPlaybackAdapter;
}

const spotifyTrack = makeTrack({ id: 'sp-1', provider: 'spotify' });
const dropboxTrack = makeTrack({ id: 'db-1', provider: 'dropbox' });

describe('installMockTestApi', () => {
  let spotifyPlayback: MockPlaybackAdapter;
  let dropboxPlayback: MockPlaybackAdapter;

  beforeEach(() => {
    delete window.__mockTest;
    spotifyPlayback = makePlaybackStub();
    dropboxPlayback = makePlaybackStub();
    installMockTestApi({
      spotifyCatalog: makeCatalogStub([spotifyTrack]),
      dropboxCatalog: makeCatalogStub([dropboxTrack]),
      spotifyPlayback,
      dropboxPlayback,
    });
  });

  it('installs window.__mockTest', () => {
    // #then
    expect(window.__mockTest).toBeDefined();
  });

  it('is idempotent — second install does not replace first', () => {
    // #given
    const firstApi = window.__mockTest;

    // #when
    installMockTestApi({
      spotifyCatalog: makeCatalogStub([]),
      dropboxCatalog: makeCatalogStub([]),
      spotifyPlayback: makePlaybackStub(),
      dropboxPlayback: makePlaybackStub(),
    });

    // #then
    expect(window.__mockTest).toBe(firstApi);
  });

  describe('setQueue', () => {
    it('dispatches mock:set-queue with resolved MediaTrack objects', async () => {
      // #given
      const received: MediaTrack[][] = [];
      window.addEventListener('mock:set-queue', (e) => {
        received.push((e as CustomEvent<MediaTrack[]>).detail);
      });

      // #when
      await window.__mockTest!.setQueue(['sp-1', 'db-1']);

      // #then
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual([spotifyTrack, dropboxTrack]);
    });

    it('throws when a track id is not found in either snapshot', async () => {
      // #when / #then
      await expect(window.__mockTest!.setQueue(['unknown-id'])).rejects.toThrow(
        'Track id "unknown-id" not found in snapshots.',
      );
    });

    it('resolves an empty id list to an empty queue', async () => {
      // #given
      const received: MediaTrack[][] = [];
      window.addEventListener('mock:set-queue', (e) => {
        received.push((e as CustomEvent<MediaTrack[]>).detail);
      });

      // #when
      await window.__mockTest!.setQueue([]);

      // #then
      expect(received[0]).toEqual([]);
    });
  });

  describe('setPlaybackState', () => {
    it('calls playTrack on the spotify adapter for a spotify track', async () => {
      // #when
      await window.__mockTest!.setPlaybackState({ trackId: 'sp-1', positionMs: 5000, isPlaying: true });

      // #then
      expect(spotifyPlayback.playTrack).toHaveBeenCalledWith(spotifyTrack, { positionMs: 5000 });
      expect(spotifyPlayback.pause).not.toHaveBeenCalled();
    });

    it('calls playTrack on the dropbox adapter for a dropbox track', async () => {
      // #when
      await window.__mockTest!.setPlaybackState({ trackId: 'db-1' });

      // #then
      expect(dropboxPlayback.playTrack).toHaveBeenCalledWith(dropboxTrack, { positionMs: 0 });
    });

    it('calls pause after playTrack when isPlaying is false', async () => {
      // #when
      await window.__mockTest!.setPlaybackState({ trackId: 'sp-1', isPlaying: false });

      // #then
      expect(spotifyPlayback.playTrack).toHaveBeenCalled();
      expect(spotifyPlayback.pause).toHaveBeenCalled();
    });

    it('throws when the trackId is unknown', async () => {
      // #when / #then
      await expect(
        window.__mockTest!.setPlaybackState({ trackId: 'no-such-track' }),
      ).rejects.toThrow('Track id "no-such-track" not found in snapshots.');
    });
  });

  describe('reset', () => {
    it('dispatches mock:reset event', async () => {
      // #given
      let fired = false;
      window.addEventListener('mock:reset', () => { fired = true; });

      // #when
      await window.__mockTest!.reset();

      // #then
      expect(fired).toBe(true);
    });

    it('pauses both playback adapters', async () => {
      // #when
      await window.__mockTest!.reset();

      // #then
      expect(spotifyPlayback.pause).toHaveBeenCalled();
      expect(dropboxPlayback.pause).toHaveBeenCalled();
    });
  });
});
