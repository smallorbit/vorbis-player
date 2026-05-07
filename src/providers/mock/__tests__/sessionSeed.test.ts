import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseMockSessionParam, seedSessionFromUrlParam } from '../sessionSeed';
import { MockCatalogAdapter } from '../mockCatalogAdapter';
import type { ProviderSnapshot } from '../../../../playwright/fixtures/data/snapshot.types';

const SNAPSHOT_SCHEMA_VERSION = 1;

function makeSnapshot(provider: 'spotify' | 'dropbox' = 'spotify'): ProviderSnapshot {
  return {
    meta: {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      provider,
      anonymizationSeed: 'aabbccdd',
    },
    user: { displayName: 'Anonymous User', hashedId: 'user_00000000' },
    tracks: {
      'track-abc': {
        id: 'track-abc',
        name: 'Test Track',
        artists: [{ name: 'Test Artist' }],
        artistsDisplay: 'Test Artist',
        album: { id: 'album-1', name: 'Test Album' },
        durationMs: 240000,
        trackNumber: 1,
        ref: 'spotify:track:track-abc',
        image: { url: '/art/track-abc.jpg' },
      },
    },
    playlists: [],
    albums: [],
    likedTrackIds: [],
    pins: [],
  };
}

function encodeBase64(obj: unknown): string {
  return btoa(JSON.stringify(obj));
}

function encodeBase64UrlSafe(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

describe('parseMockSessionParam', () => {
  it('returns null when param is absent', () => {
    // #given a search string with no mock-session param
    // #when parsed
    // #then returns null
    expect(parseMockSessionParam('')).toBeNull();
    expect(parseMockSessionParam('?foo=bar')).toBeNull();
  });

  it('decodes a valid base64-encoded JSON payload', () => {
    // #given a valid payload with trackId and positionMs
    const payload = { trackId: 'track-abc', positionMs: 45000 };
    const encoded = encodeBase64(payload);
    // #when parsed
    const result = parseMockSessionParam(`?mock-session=${encoded}`);
    // #then returns the decoded seed
    expect(result).toEqual({ trackId: 'track-abc', positionMs: 45000 });
  });

  it('decodes a URL-safe base64 payload (- and _ variants)', () => {
    // #given a URL-safe encoded payload
    const payload = { trackId: 'track-abc', positionMs: 45000 };
    const encoded = encodeBase64UrlSafe(payload);
    // #when parsed
    const result = parseMockSessionParam(`?mock-session=${encoded}`);
    // #then returns the decoded seed
    expect(result).toEqual({ trackId: 'track-abc', positionMs: 45000 });
  });

  it('returns null for invalid base64', () => {
    // #given a non-base64 value
    // #when parsed
    const result = parseMockSessionParam('?mock-session=!!!not-base64!!!');
    // #then returns null without throwing
    expect(result).toBeNull();
  });

  it('returns null for valid base64 that decodes to invalid JSON', () => {
    // #given valid base64 of a non-JSON string
    const encoded = btoa('not json at all');
    // #when parsed
    const result = parseMockSessionParam(`?mock-session=${encoded}`);
    // #then returns null without throwing
    expect(result).toBeNull();
  });

  it('returns null when trackId is missing', () => {
    // #given a payload without trackId
    const encoded = encodeBase64({ positionMs: 45000 });
    // #when parsed
    const result = parseMockSessionParam(`?mock-session=${encoded}`);
    // #then returns null
    expect(result).toBeNull();
  });

  it('returns null when positionMs is missing', () => {
    // #given a payload without positionMs
    const encoded = encodeBase64({ trackId: 'track-abc' });
    // #when parsed
    const result = parseMockSessionParam(`?mock-session=${encoded}`);
    // #then returns null
    expect(result).toBeNull();
  });

  it('returns null when positionMs is negative', () => {
    // #given a payload with negative positionMs
    const encoded = encodeBase64({ trackId: 'track-abc', positionMs: -1 });
    // #when parsed
    const result = parseMockSessionParam(`?mock-session=${encoded}`);
    // #then returns null
    expect(result).toBeNull();
  });

  it('returns null when positionMs is not a number', () => {
    // #given a payload with a string positionMs
    const encoded = encodeBase64({ trackId: 'track-abc', positionMs: '45000' });
    // #when parsed
    const result = parseMockSessionParam(`?mock-session=${encoded}`);
    // #then returns null
    expect(result).toBeNull();
  });

  it('accepts positionMs of zero', () => {
    // #given a payload with positionMs=0
    const encoded = encodeBase64({ trackId: 'track-abc', positionMs: 0 });
    // #when parsed
    const result = parseMockSessionParam(`?mock-session=${encoded}`);
    // #then returns the seed (zero is a valid non-negative position)
    expect(result).toEqual({ trackId: 'track-abc', positionMs: 0 });
  });
});

describe('seedSessionFromUrlParam', () => {
  let spotifyCatalog: MockCatalogAdapter;
  let dropboxCatalog: MockCatalogAdapter;
  let savedItems: Record<string, string>;

  beforeEach(() => {
    spotifyCatalog = new MockCatalogAdapter(makeSnapshot('spotify'));
    dropboxCatalog = new MockCatalogAdapter(makeSnapshot('dropbox'));
    savedItems = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => savedItems[key] ?? null,
      setItem: (key: string, value: string) => { savedItems[key] = value; },
      removeItem: (key: string) => { delete savedItems[key]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes a SessionSnapshot to localStorage for a known Spotify track', () => {
    // #given a valid mock-session param for a known Spotify track
    const payload = { trackId: 'track-abc', positionMs: 45000 };
    const encoded = encodeBase64(payload);
    vi.stubGlobal('location', { search: `?mock-session=${encoded}` });

    // #when seedSessionFromUrlParam is called
    seedSessionFromUrlParam(spotifyCatalog, dropboxCatalog);

    // #then a SessionSnapshot is written to localStorage
    const stored = savedItems['vorbis-player-last-session'];
    expect(stored).toBeTruthy();
    const session = JSON.parse(stored) as Record<string, unknown>;
    expect(session.trackId).toBe('track-abc');
    expect(session.playbackPosition).toBe(45000);
    expect(Array.isArray(session.queueTracks)).toBe(true);
  });

  it('writes a SessionSnapshot to localStorage for a known Dropbox track', () => {
    // #given a valid mock-session param for a known Dropbox track
    const payload = { trackId: 'track-abc', positionMs: 10000 };
    const encoded = encodeBase64(payload);
    vi.stubGlobal('location', { search: `?mock-session=${encoded}` });

    // #when seedSessionFromUrlParam is called (Spotify catalog has no match for this test,
    // so we pass an empty Spotify catalog and the Dropbox catalog with the track)
    const emptySpotify = new MockCatalogAdapter({
      ...makeSnapshot('spotify'),
      tracks: {},
    });
    seedSessionFromUrlParam(emptySpotify, dropboxCatalog);

    // #then the Dropbox track is found and stored
    const stored = savedItems['vorbis-player-last-session'];
    expect(stored).toBeTruthy();
    const session = JSON.parse(stored) as Record<string, unknown>;
    expect(session.trackId).toBe('track-abc');
    expect(session.playbackPosition).toBe(10000);
  });

  it('does not write to localStorage when param is absent', () => {
    // #given no mock-session param
    vi.stubGlobal('location', { search: '' });

    // #when seedSessionFromUrlParam is called
    seedSessionFromUrlParam(spotifyCatalog, dropboxCatalog);

    // #then nothing is written
    expect(savedItems['vorbis-player-last-session']).toBeUndefined();
  });

  it('does not write to localStorage for an unknown track id', () => {
    // #given a valid param but referencing a track not in either catalog
    const payload = { trackId: 'track-unknown-xyz', positionMs: 45000 };
    const encoded = encodeBase64(payload);
    vi.stubGlobal('location', { search: `?mock-session=${encoded}` });

    // #when seedSessionFromUrlParam is called
    seedSessionFromUrlParam(spotifyCatalog, dropboxCatalog);

    // #then nothing is written
    expect(savedItems['vorbis-player-last-session']).toBeUndefined();
  });

  it('does not throw on malformed base64 input', () => {
    // #given a malformed param
    vi.stubGlobal('location', { search: '?mock-session=!!!bad!!!' });

    // #when / #then no throw
    expect(() => seedSessionFromUrlParam(spotifyCatalog, dropboxCatalog)).not.toThrow();
    expect(savedItems['vorbis-player-last-session']).toBeUndefined();
  });
});
