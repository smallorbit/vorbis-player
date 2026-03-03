import { describe, it, expect, vi } from 'vitest';

// Mock modules that trigger Vite HMR / external services at import time
vi.mock('@/services/spotifyPlayer', () => ({ spotifyPlayer: {} }));
vi.mock('@/services/spotify', () => ({ spotifyAuth: {} }));
vi.mock('@/hooks/useSpotifyPlayback', () => ({ useSpotifyPlayback: vi.fn() }));
vi.mock('@/hooks/usePlaylistManager', () => ({ usePlaylistManager: vi.fn() }));
vi.mock('@/hooks/useAutoAdvance', () => ({ useAutoAdvance: vi.fn() }));
vi.mock('@/hooks/useAccentColor', () => ({ useAccentColor: vi.fn() }));
vi.mock('@/contexts/TrackContext', () => ({ useTrackContext: vi.fn() }));
vi.mock('@/contexts/VisualEffectsContext', () => ({ useVisualEffectsContext: vi.fn() }));
vi.mock('@/contexts/ColorContext', () => ({ useColorContext: vi.fn() }));
vi.mock('@/contexts/ProviderContext', () => ({ useProviderContext: vi.fn() }));

import { mediaTrackToTrack } from '../usePlayerLogic';
import type { MediaTrack } from '@/types/domain';

function makeMediaTrack(overrides?: Partial<MediaTrack>): MediaTrack {
  return {
    id: 'track-1',
    provider: 'dropbox',
    playbackRef: { provider: 'dropbox', ref: '/artist/album/01 - song.mp3' },
    name: 'Song',
    artists: 'Artist',
    album: 'Album',
    albumId: '/artist/album',
    durationMs: 180000,
    image: 'data:image/jpeg;base64,abc',
    ...overrides,
  };
}

describe('mediaTrackToTrack', () => {
  it('maps albumId to album_id', () => {
    // #given
    const media = makeMediaTrack({ albumId: '/artist/my-album' });

    // #when
    const track = mediaTrackToTrack(media);

    // #then — regression: album_id must be propagated so color overrides work
    expect(track.album_id).toBe('/artist/my-album');
  });

  it('preserves undefined albumId when not set', () => {
    // #given
    const media = makeMediaTrack({ albumId: undefined });

    // #when
    const track = mediaTrackToTrack(media);

    // #then
    expect(track.album_id).toBeUndefined();
  });

  it('sets empty uri for dropbox provider', () => {
    // #given
    const media = makeMediaTrack({ provider: 'dropbox' });

    // #when
    const track = mediaTrackToTrack(media);

    // #then
    expect(track.uri).toBe('');
  });

  it('uses playbackRef as uri for non-dropbox providers', () => {
    // #given
    const media = makeMediaTrack({
      provider: 'spotify',
      playbackRef: { provider: 'spotify', ref: 'spotify:track:abc123' },
    });

    // #when
    const track = mediaTrackToTrack(media);

    // #then
    expect(track.uri).toBe('spotify:track:abc123');
  });

  it('maps all core fields correctly', () => {
    // #given
    const media = makeMediaTrack({
      id: 'my-id',
      name: 'My Song',
      artists: 'My Artist',
      album: 'My Album',
      albumId: '/path/to/album',
      trackNumber: 3,
      durationMs: 240000,
      image: 'https://example.com/art.jpg',
    });

    // #when
    const track = mediaTrackToTrack(media);

    // #then
    expect(track.id).toBe('my-id');
    expect(track.name).toBe('My Song');
    expect(track.artists).toBe('My Artist');
    expect(track.album).toBe('My Album');
    expect(track.album_id).toBe('/path/to/album');
    expect(track.track_number).toBe(3);
    expect(track.duration_ms).toBe(240000);
    expect(track.image).toBe('https://example.com/art.jpg');
  });
});
