import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockGetDescriptor = vi.fn();
const mockConnectedProviderIds: string[] = [];

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: () => ({
    connectedProviderIds: mockConnectedProviderIds,
    getDescriptor: mockGetDescriptor,
  }),
}));

const mockRegistryGet = vi.fn();
const mockRegistryGetAll = vi.fn().mockReturnValue([]);
vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: (...args: unknown[]) => mockRegistryGet(...args),
    getAll: () => mockRegistryGetAll(),
  },
}));

vi.mock('@/hooks/useLibrarySync', () => ({
  LIBRARY_REFRESH_EVENT: 'vorbis-library-refresh',
}));

import { useUnifiedLikedTracks, resetUnifiedLikedCache } from '../useUnifiedLikedTracks';
import type { MediaTrack, ProviderId } from '@/types/domain';

function makeTrack(id: string, provider: ProviderId, addedAt?: number): MediaTrack {
  return {
    id,
    provider,
    playbackRef: { provider, ref: `ref-${id}` },
    name: `Track ${id}`,
    artists: `Artist ${id}`,
    album: `Album ${id}`,
    durationMs: 200000,
    addedAt,
  };
}

function makeDescriptor(id: ProviderId, tracks: MediaTrack[], likesChangedEvent?: string) {
  return {
    id,
    capabilities: { hasLikedCollection: true, hasSaveTrack: true, hasExternalLink: false },
    catalog: {
      providerId: id,
      listCollections: vi.fn().mockResolvedValue([]),
      listTracks: vi.fn().mockResolvedValue(tracks),
    },
    ...(likesChangedEvent && { likesChangedEvent }),
  };
}

describe('useUnifiedLikedTracks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectedProviderIds.length = 0;
    resetUnifiedLikedCache();
  });

  it('is not active when only one provider is connected', () => {
    // #given
    mockConnectedProviderIds.push('spotify');
    const spotifyDesc = makeDescriptor('spotify', [makeTrack('s1', 'spotify', 1000)]);
    mockGetDescriptor.mockImplementation((id: string) => id === 'spotify' ? spotifyDesc : undefined);
    mockRegistryGet.mockImplementation((id: string) => id === 'spotify' ? spotifyDesc : undefined);

    // #when
    const { result } = renderHook(() => useUnifiedLikedTracks());

    // #then
    expect(result.current.isUnifiedLikedActive).toBe(false);
    expect(result.current.unifiedTracks).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('merges tracks from multiple providers sorted by timestamp descending', async () => {
    // #given - set up two providers with tracks at different timestamps
    const spotifyTracks = [
      makeTrack('s1', 'spotify', 3000),
      makeTrack('s2', 'spotify', 1000),
    ];
    const dropboxTracks = [
      makeTrack('d1', 'dropbox', 2000),
      makeTrack('d2', 'dropbox', 500),
    ];
    mockConnectedProviderIds.push('spotify', 'dropbox');
    const spotifyDesc = makeDescriptor('spotify', spotifyTracks);
    const dropboxDesc = makeDescriptor('dropbox', dropboxTracks);
    mockGetDescriptor.mockImplementation((id: string) => {
      if (id === 'spotify') return spotifyDesc;
      if (id === 'dropbox') return dropboxDesc;
      return undefined;
    });
    mockRegistryGet.mockImplementation((id: string) => {
      if (id === 'spotify') return spotifyDesc;
      if (id === 'dropbox') return dropboxDesc;
      return undefined;
    });

    // #when - render hook
    const { result } = renderHook(() => useUnifiedLikedTracks());

    // #then - unified likes active with merged and sorted tracks
    expect(result.current.isUnifiedLikedActive).toBe(true);

    await waitFor(() => {
      expect(result.current.unifiedTracks.length).toBe(4);
    });

    expect(result.current.unifiedTracks.map(t => t.id)).toEqual(['s1', 'd1', 's2', 'd2']);
    expect(result.current.totalCount).toBe(4);
  });

  it('places tracks without timestamps after timestamped tracks', async () => {
    // #given - one provider with timestamp, one without
    const spotifyTracks = [makeTrack('s1', 'spotify', 1000)];
    const dropboxTracks = [makeTrack('d1', 'dropbox')]; // no addedAt
    mockConnectedProviderIds.push('spotify', 'dropbox');
    const spotifyDesc = makeDescriptor('spotify', spotifyTracks);
    const dropboxDesc = makeDescriptor('dropbox', dropboxTracks);
    mockGetDescriptor.mockImplementation((id: string) => {
      if (id === 'spotify') return spotifyDesc;
      if (id === 'dropbox') return dropboxDesc;
      return undefined;
    });
    mockRegistryGet.mockImplementation((id: string) => {
      if (id === 'spotify') return spotifyDesc;
      if (id === 'dropbox') return dropboxDesc;
      return undefined;
    });

    // #when - render hook
    const { result } = renderHook(() => useUnifiedLikedTracks());

    // #then - timestamped tracks first, unset timestamps at end
    await waitFor(() => {
      expect(result.current.unifiedTracks.length).toBe(2);
    });
    expect(result.current.unifiedTracks[0].id).toBe('s1');
    expect(result.current.unifiedTracks[1].id).toBe('d1');
  });

  it('handles provider fetch failure gracefully', async () => {
    // #given - one provider succeeds, one fails with network error
    const spotifyTracks = [makeTrack('s1', 'spotify', 1000)];
    mockConnectedProviderIds.push('spotify', 'dropbox');
    const spotifyDesc = makeDescriptor('spotify', spotifyTracks);
    const dropboxDesc = {
      id: 'dropbox',
      capabilities: { hasLikedCollection: true, hasSaveTrack: true, hasExternalLink: false },
      catalog: {
        providerId: 'dropbox' as ProviderId,
        listCollections: vi.fn().mockResolvedValue([]),
        listTracks: vi.fn().mockRejectedValue(new Error('Network error')),
      },
    };
    mockGetDescriptor.mockImplementation((id: string) => {
      if (id === 'spotify') return spotifyDesc;
      if (id === 'dropbox') return dropboxDesc;
      return undefined;
    });
    mockRegistryGet.mockImplementation((id: string) => {
      if (id === 'spotify') return spotifyDesc;
      if (id === 'dropbox') return dropboxDesc;
      return undefined;
    });

    // #when - render hook with failing dropbox provider
    const { result } = renderHook(() => useUnifiedLikedTracks());

    // #then - only spotify tracks included
    await waitFor(() => {
      expect(result.current.unifiedTracks.length).toBe(1);
    });
    expect(result.current.unifiedTracks[0].id).toBe('s1');
  });

  it('refreshes when Dropbox likes change event fires', async () => {
    // #given - set up providers with dynamic dropbox track list
    const spotifyTracks = [makeTrack('s1', 'spotify', 2000)];
    let dropboxTracks = [makeTrack('d1', 'dropbox', 1000)];
    mockConnectedProviderIds.push('spotify', 'dropbox');

    const dropboxCatalog = {
      providerId: 'dropbox' as ProviderId,
      listCollections: vi.fn().mockResolvedValue([]),
      listTracks: vi.fn().mockImplementation(() => Promise.resolve(dropboxTracks)),
    };
    const spotifyDesc = makeDescriptor('spotify', spotifyTracks);
    const dropboxDesc = {
      id: 'dropbox',
      capabilities: { hasLikedCollection: true, hasSaveTrack: true, hasExternalLink: false },
      catalog: dropboxCatalog,
      likesChangedEvent: 'vorbis-dropbox-likes-changed',
    };
    mockGetDescriptor.mockImplementation((id: string) => {
      if (id === 'spotify') return spotifyDesc;
      if (id === 'dropbox') return dropboxDesc;
      return undefined;
    });
    mockRegistryGet.mockImplementation((id: string) => {
      if (id === 'spotify') return spotifyDesc;
      if (id === 'dropbox') return dropboxDesc;
      return undefined;
    });
    mockRegistryGetAll.mockReturnValue([spotifyDesc, dropboxDesc]);

    const { result } = renderHook(() => useUnifiedLikedTracks());
    await waitFor(() => expect(result.current.totalCount).toBe(2));

    // #when - add a new dropbox track and fire change event
    dropboxTracks = [makeTrack('d1', 'dropbox', 1000), makeTrack('d2', 'dropbox', 3000)];
    act(() => {
      window.dispatchEvent(new Event('vorbis-dropbox-likes-changed'));
    });

    // #then - unified tracks refreshed with new track
    await waitFor(() => {
      expect(result.current.totalCount).toBe(3);
    });
  });

  it('serves cached data immediately on subsequent hook mounts', async () => {
    // #given - set up providers
    const spotifyTracks = [makeTrack('s1', 'spotify', 2000)];
    const dropboxTracks = [makeTrack('d1', 'dropbox', 1000)];
    mockConnectedProviderIds.push('spotify', 'dropbox');
    const spotifyDesc = makeDescriptor('spotify', spotifyTracks);
    const dropboxDesc = makeDescriptor('dropbox', dropboxTracks);
    mockGetDescriptor.mockImplementation((id: string) => {
      if (id === 'spotify') return spotifyDesc;
      if (id === 'dropbox') return dropboxDesc;
      return undefined;
    });
    mockRegistryGet.mockImplementation((id: string) => {
      if (id === 'spotify') return spotifyDesc;
      if (id === 'dropbox') return dropboxDesc;
      return undefined;
    });

    // #when - first mount populates cache
    const { result: first, unmount } = renderHook(() => useUnifiedLikedTracks());
    await waitFor(() => expect(first.current.totalCount).toBe(2));
    unmount();

    // #when - second mount reads from cache
    const { result: second } = renderHook(() => useUnifiedLikedTracks());

    // #then - data available synchronously without loading state
    expect(second.current.totalCount).toBe(2);
    expect(second.current.isLoading).toBe(false);
  });
});
