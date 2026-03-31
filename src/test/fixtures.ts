import type { AlbumInfo, PlaylistInfo } from '@/services/spotify';
import type { MediaTrack, ProviderId } from '@/types/domain';
import type { CachedPlaylistInfo } from '@/services/cache/cacheTypes';

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

export function makeSpotifyPlaybackState(
  overrides?: Partial<SpotifyPlaybackState>
): SpotifyPlaybackState {
  return {
    context: {
      uri: 'spotify:playlist:playlist-1',
      metadata: {},
    },
    disallows: {
      pausing: false,
      peeking_next: false,
      peeking_prev: false,
      resuming: false,
      seeking: false,
      skipping_next: false,
      skipping_prev: false,
    },
    paused: false,
    position: 30000,
    repeat_mode: 0,
    shuffle: false,
    track_window: {
      current_track: {
        id: 'track-1',
        uri: 'spotify:track:track-1',
        name: 'Test Track',
        duration_ms: 210000,
        artists: [{ name: 'Test Artist', uri: 'spotify:artist:artist-1' }],
        album: {
          name: 'Test Album',
          uri: 'spotify:album:album-1',
          images: [{ url: 'https://i.scdn.co/image/test', height: 300, width: 300 }],
        },
      },
      next_tracks: [],
      previous_tracks: [],
    },
    ...overrides,
  };
}
