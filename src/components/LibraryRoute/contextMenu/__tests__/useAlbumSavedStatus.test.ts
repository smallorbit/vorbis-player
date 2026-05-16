import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ProviderDescriptor } from '@/types/providers';

const mockGetDescriptor = vi.fn();
const mockActiveDescriptor = vi.fn();

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: () => ({
    activeDescriptor: mockActiveDescriptor(),
    getDescriptor: mockGetDescriptor,
  }),
}));

vi.mock('@/lib/debugLog', () => ({
  logLibrary: vi.fn(),
}));

vi.mock('@/services/cache/librarySyncEngine', () => ({
  spotifyLibrarySyncEngine: {
    optimisticRemoveAlbum: vi.fn().mockResolvedValue(undefined),
  },
}));

import { useAlbumSavedStatus } from '../useAlbumSavedStatus';

function makeDescriptor(overrides?: Partial<ProviderDescriptor>): ProviderDescriptor {
  return {
    id: 'spotify',
    name: 'Spotify',
    capabilities: {
      hasSaveTrack: true,
      hasExternalLink: true,
      hasLikedCollection: true,
      hasSaveAlbum: true,
    },
    auth: {
      providerId: 'spotify',
      isAuthenticated: vi.fn().mockReturnValue(true),
      getAccessToken: vi.fn(),
      beginLogin: vi.fn(),
      handleCallback: vi.fn(),
      logout: vi.fn(),
    },
    catalog: {
      providerId: 'spotify',
      listCollections: vi.fn().mockResolvedValue([]),
      listTracks: vi.fn().mockResolvedValue([]),
      isAlbumSaved: vi.fn().mockResolvedValue(false),
      setAlbumSaved: vi.fn().mockResolvedValue(undefined),
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

describe('useAlbumSavedStatus — undeclared capability guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call isAlbumSaved when hasSaveAlbum is false', async () => {
    // #given — provider with isAlbumSaved method present but hasSaveAlbum capability false
    const isAlbumSaved = vi.fn().mockResolvedValue(true);
    const descriptor = makeDescriptor({
      capabilities: { hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true, hasSaveAlbum: false },
      catalog: {
        providerId: 'spotify',
        listCollections: vi.fn().mockResolvedValue([]),
        listTracks: vi.fn().mockResolvedValue([]),
        isAlbumSaved,
        setAlbumSaved: vi.fn().mockResolvedValue(undefined),
      },
    });
    mockActiveDescriptor.mockReturnValue(descriptor);

    // #when
    renderHook(() => useAlbumSavedStatus('album-1', undefined));

    // #then — adapter method not invoked despite being present
    await waitFor(() => {
      expect(isAlbumSaved).not.toHaveBeenCalled();
    });
  });

  it('does not call setAlbumSaved when hasSaveAlbum is false and toggle is attempted', async () => {
    // #given — provider with setAlbumSaved method present but hasSaveAlbum capability false
    const setAlbumSaved = vi.fn().mockResolvedValue(undefined);
    const isAlbumSaved = vi.fn().mockResolvedValue(true);
    const descriptor = makeDescriptor({
      capabilities: { hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true, hasSaveAlbum: false },
      catalog: {
        providerId: 'spotify',
        listCollections: vi.fn().mockResolvedValue([]),
        listTracks: vi.fn().mockResolvedValue([]),
        isAlbumSaved,
        setAlbumSaved,
      },
    });
    mockActiveDescriptor.mockReturnValue(descriptor);

    const { result } = renderHook(() => useAlbumSavedStatus('album-1', undefined));

    await waitFor(() => {
      expect(result.current.canToggle).toBe(false);
    });

    // #when — simulate a toggle attempt even though canToggle is false
    await act(async () => {
      result.current.toggleSaved();
    });

    // #then — adapter method not invoked
    expect(setAlbumSaved).not.toHaveBeenCalled();
  });
});
