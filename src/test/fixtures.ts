import type { AlbumInfo, PlaylistInfo, SpotifyPlaybackState } from '@/services/spotify';
import type { CachedPlaylistInfo } from '@/services/cache/cacheTypes';
import type { MediaTrack, PlaybackState, ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import { vi } from 'vitest';

export function makeTrack(overrides?: Partial<MediaTrack>): MediaTrack {
  return {
    id: 'track-1',
    provider: 'spotify' as ProviderId,
    playbackRef: { provider: 'spotify' as ProviderId, ref: 'spotify:track:track-1' },
    name: 'Test Track',
    artists: 'Test Artist',
    album: 'Test Album',
    albumId: 'album-1',
    durationMs: 210000,
    image: 'https://i.scdn.co/image/test',
    ...overrides,
  };
}

export function makePlaylistInfo(overrides?: Partial<CachedPlaylistInfo>): CachedPlaylistInfo {
  return {
    id: 'playlist-1',
    name: 'Test Playlist',
    description: 'A test playlist',
    images: [{ url: 'https://i.scdn.co/image/playlist', height: 300, width: 300 }],
    tracks: { total: 25 },
    owner: { display_name: 'Test User' },
    ...overrides,
  };
}

export function makeAlbumInfo(overrides?: Partial<AlbumInfo>): AlbumInfo {
  return {
    id: 'album-1',
    name: 'Test Album',
    artists: 'Test Artist',
    images: [{ url: 'https://i.scdn.co/image/album', height: 300, width: 300 }],
    release_date: '2024-01-15',
    total_tracks: 12,
    uri: 'spotify:album:album-1',
    ...overrides,
  };
}

export function makeMediaTrack(overrides?: Partial<MediaTrack>): MediaTrack {
  return {
    id: 'track-1',
    provider: 'spotify',
    playbackRef: {
      provider: 'spotify',
      ref: 'spotify:track:track-1',
    },
    name: 'Test Track',
    artists: 'Test Artist',
    album: 'Test Album',
    durationMs: 210000,
    ...overrides,
  };
}

export function makeProviderDescriptor(
  overrides?: Partial<ProviderDescriptor>
): ProviderDescriptor {
  return {
    id: 'spotify',
    name: 'Spotify',
    capabilities: {
      hasSaveTrack: true,
      hasExternalLink: true,
      hasLikedCollection: true,
    },
    auth: {
      providerId: 'spotify',
      isAuthenticated: vi.fn().mockReturnValue(false),
      getAccessToken: vi.fn(),
      beginLogin: vi.fn(),
      handleCallback: vi.fn(),
      logout: vi.fn(),
    },
    catalog: {
      providerId: 'spotify',
      listCollections: vi.fn().mockResolvedValue([]),
      listTracks: vi.fn().mockResolvedValue([]),
    },
    playback: {
      providerId: 'spotify',
      initialize: vi.fn().mockResolvedValue(undefined),
      playTrack: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn().mockResolvedValue(undefined),
      next: vi.fn().mockResolvedValue(undefined),
      previous: vi.fn().mockResolvedValue(undefined),
      setVolume: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockReturnValue(vi.fn()),
      getLastPlayTime: vi.fn().mockReturnValue(Date.now()),
    },
    ...overrides,
  };
}
