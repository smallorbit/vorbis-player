import type { CollectionSelection, MediaCollection, MediaTrack, ProviderId } from '@/types/domain';
import type {
  PlaybackProvider,
  ProviderCapabilities,
  ProviderDescriptor,
} from '@/types/providers';
import type { BrowserFeatures } from '@/utils/featureDetection';
import type { useLibrarySync } from '@/hooks/useLibrarySync';
import type { useRecentlyPlayedCollections } from '@/hooks/useRecentlyPlayedCollections';
import type { usePinnedItems } from '@/hooks/usePinnedItems';
import type { usePlayerSizing } from '@/hooks/usePlayerSizing';
import type { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { vi } from 'vitest';

export function makeTrack(overrides: Partial<MediaTrack> = {}): MediaTrack {
  return {
    id: 'track-1',
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: 'spotify:track:track-1' },
    name: 'Test Track',
    artists: 'Test Artist',
    album: 'Test Album',
    albumId: 'album-1',
    durationMs: 210000,
    image: 'https://i.scdn.co/image/test',
    genres: [],
    ...overrides,
  };
}

export function makeMediaTrack(overrides: Partial<MediaTrack> = {}): MediaTrack {
  return makeTrack(overrides);
}

export function makeCollection(
  overrides: Partial<MediaCollection> & Pick<MediaCollection, 'id' | 'kind'> = {
    id: 'playlist-1',
    kind: 'playlist',
  },
): MediaCollection {
  return {
    provider: 'spotify',
    name: 'Test Collection',
    genres: [],
    ...overrides,
  };
}

export function makeCollectionSelection(
  kind: 'playlist' | 'album' | 'folder' | 'liked' = 'playlist',
  id = 'p1',
  provider: ProviderId = 'spotify',
): CollectionSelection {
  if (kind === 'liked') {
    return { type: 'liked', provider };
  }
  return { type: 'collection', ref: { provider, kind, id } };
}

export function makeCapabilities(
  overrides: Partial<ProviderCapabilities> = {},
): ProviderCapabilities {
  return {
    hasSaveTrack: true,
    hasExternalLink: true,
    hasLikedCollection: true,
    hasSaveAlbum: false,
    hasTrackSearch: false,
    ...overrides,
  };
}

export function makePlaybackProvider(
  overrides: Partial<PlaybackProvider> = {},
): PlaybackProvider {
  return {
    providerId: 'spotify',
    initialize: vi.fn().mockResolvedValue(undefined),
    playTrack: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    seek: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    getLastPlayTime: vi.fn().mockReturnValue(Date.now()),
    ...overrides,
  };
}

export function makeProviderDescriptor(
  overrides: Partial<ProviderDescriptor> = {},
): ProviderDescriptor {
  const { capabilities, catalog, playback, auth, ...rest } = overrides;
  return {
    id: 'spotify',
    name: 'Spotify',
    capabilities: makeCapabilities(capabilities),
    auth: {
      providerId: 'spotify',
      isAuthenticated: vi.fn().mockReturnValue(false),
      getAccessToken: vi.fn(),
      beginLogin: vi.fn(),
      handleCallback: vi.fn(),
      logout: vi.fn(),
      ...auth,
    },
    catalog: {
      providerId: 'spotify',
      listCollections: vi.fn().mockResolvedValue([]),
      listTracks: vi.fn().mockResolvedValue([]),
      ...catalog,
    },
    playback: makePlaybackProvider({
      providerId: rest.id ?? playback?.providerId ?? 'spotify',
      ...playback,
    }),
    ...rest,
  };
}

export type LibrarySyncResult = ReturnType<typeof useLibrarySync>;

export function makeLibrarySyncResult(
  overrides: Partial<LibrarySyncResult> = {},
): LibrarySyncResult {
  return {
    playlists: [],
    albums: [],
    likedSongsCount: 0,
    likedSongsPerProvider: [],
    allMusicCount: 0,
    isInitialLoadComplete: true,
    isSyncing: false,
    isLikedSongsSyncing: false,
    lastSyncTimestamp: null,
    syncError: null,
    refreshNow: vi.fn().mockResolvedValue(undefined),
    removeCollection: vi.fn(),
    ...overrides,
  };
}

export type RecentlyPlayedResult = ReturnType<typeof useRecentlyPlayedCollections>;

export function makeRecentlyPlayedResult(
  overrides: Partial<RecentlyPlayedResult> = {},
): RecentlyPlayedResult {
  return {
    history: [],
    record: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };
}

export type PinnedItemsResult = ReturnType<typeof usePinnedItems>;

export function makePinnedItemsResult(
  overrides: Partial<PinnedItemsResult> = {},
): PinnedItemsResult {
  return {
    pinnedPlaylistIds: [],
    pinnedAlbumIds: [],
    isPlaylistPinned: vi.fn(() => false),
    isAlbumPinned: vi.fn(() => false),
    togglePinPlaylist: vi.fn(),
    togglePinAlbum: vi.fn(),
    canPinMorePlaylists: true,
    canPinMoreAlbums: true,
    ...overrides,
  };
}

export function makeBrowserFeatures(
  overrides: Partial<BrowserFeatures> = {},
): BrowserFeatures {
  return {
    visualViewport: true,
    containerQueries: true,
    backdropFilter: true,
    cssCustomProperties: true,
    cssGrid: true,
    cssFlexbox: true,
    cssGap: true,
    cssClamp: true,
    cssAspectRatio: true,
    cssLogicalProperties: true,
    cssScrollBehavior: true,
    cssFocusVisible: true,
    cssIs: true,
    cssHas: true,
    cssColorMix: true,
    cssRelativeColors: true,
    cssAnchorPositioning: true,
    cssViewportUnits: true,
    cssSubgrid: true,
    intersectionObserver: true,
    resizeObserver: true,
    requestAnimationFrame: true,
    matchMedia: true,
    devicePixelRatio: true,
    ...overrides,
  };
}

export type PlayerSizingValue = ReturnType<typeof usePlayerSizing>;

export function makePlayerSizingValue(
  overrides: Partial<PlayerSizingValue> = {},
): PlayerSizingValue {
  return {
    dimensions: { width: 600, height: 600, scale: 1, aspectRatio: 1 },
    viewport: {
      width: 1024,
      height: 768,
      orientation: 'landscape',
      devicePixelRatio: 1,
    },
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    hasPointerInput: true,
    isTouchDevice: false,
    orientation: 'landscape',
    useFluidSizing: false,
    padding: 16,
    aspectRatio: 1,
    optimalAspectRatio: 1,
    aspectRatioConstraints: { min: 0.5, max: 2 },
    updateDimensions: vi.fn(),
    transitionDuration: 200,
    transitionEasing: 'ease',
    browserFeatures: makeBrowserFeatures(),
    compatibilityScore: 1,
    supportsContainerQueries: true,
    supportsBackdropFilter: true,
    supportsVisualViewport: true,
    ...overrides,
  };
}

export type UnifiedLikedResult = ReturnType<typeof useUnifiedLikedTracks>;

export function makeUnifiedLikedResult(
  overrides: Partial<UnifiedLikedResult> = {},
): UnifiedLikedResult {
  return {
    unifiedTracks: [],
    totalCount: 0,
    isLoading: false,
    refresh: vi.fn(),
    isUnifiedLikedActive: false,
    ...overrides,
  };
}
