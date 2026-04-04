import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRadioSession } from '../useRadioSession';
import type { RadioProgress } from '@/types/radio';
import { makeMediaTrack, makeProviderDescriptor } from '@/test/fixtures';
import type { MediaTrack } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: vi.fn(),
    getAll: vi.fn(() => []),
    register: vi.fn(),
  },
}));

vi.mock('@/utils/shuffleArray', () => ({
  shuffleArray: vi.fn((arr: unknown[]) => [...arr]),
}));

vi.mock('@/lib/debugLog', () => ({
  logRadio: vi.fn(),
  logQueue: vi.fn(),
}));

vi.mock('../playerLogicUtils', () => ({
  queueSnapshot: vi.fn(),
}));

import { providerRegistry } from '@/providers/registry';

function makeTrackOps() {
  return {
    setError: vi.fn(),
    setTracks: vi.fn(),
    setOriginalTracks: vi.fn(),
    setCurrentTrackIndex: vi.fn(),
    setSelectedPlaylistId: vi.fn(),
    mediaTracksRef: { current: [] as MediaTrack[] },
  };
}

function track(id: string, name: string, artists: string): MediaTrack {
  return makeMediaTrack({ id, name, artists, provider: 'spotify' });
}

describe('useRadioSession', () => {
  let trackOps: ReturnType<typeof makeTrackOps>;
  let descriptor: ProviderDescriptor;
  let mockStartRadio: ReturnType<typeof vi.fn>;
  let mockStopRadioBase: ReturnType<typeof vi.fn>;
  let mockOnProgress: ReturnType<typeof vi.fn>;
  let mockSetAuthExpired: ReturnType<typeof vi.fn>;
  let seedTrack: MediaTrack;

  beforeEach(() => {
    vi.clearAllMocks();
    trackOps = makeTrackOps();
    descriptor = makeProviderDescriptor({
      id: 'spotify',
      catalog: {
        providerId: 'spotify',
        listCollections: vi.fn().mockResolvedValue([]),
        listTracks: vi.fn().mockResolvedValue([]),
      },
    });
    mockStartRadio = vi.fn();
    mockStopRadioBase = vi.fn();
    mockOnProgress = vi.fn();
    mockSetAuthExpired = vi.fn();
    seedTrack = track('seed-1', 'Creep', 'Radiohead');
    trackOps.mediaTracksRef.current = [seedTrack];
  });

  function renderSession(overrides?: Partial<Parameters<typeof useRadioSession>[0]>) {
    return renderHook(() =>
      useRadioSession({
        trackOps,
        activeDescriptor: descriptor,
        currentTrack: seedTrack,
        currentTrackIndex: 0,
        startRadio: mockStartRadio,
        stopRadioBase: mockStopRadioBase,
        onProgress: mockOnProgress,
        authExpired: null,
        setAuthExpired: mockSetAuthExpired,
        ...overrides,
      }),
    );
  }

  it('returns early when activeDescriptor is undefined', async () => {
    // #given
    const { result } = renderSession({ activeDescriptor: undefined });

    // #when
    await act(async () => {
      await result.current.handleStartRadio();
    });

    // #then
    expect(mockStartRadio).not.toHaveBeenCalled();
    expect(mockOnProgress).not.toHaveBeenCalled();
  });

  it('returns early when currentTrack is null', async () => {
    // #given
    const { result } = renderSession({ currentTrack: null });

    // #when
    await act(async () => {
      await result.current.handleStartRadio();
    });

    // #then
    expect(mockStartRadio).not.toHaveBeenCalled();
  });

  it('fetches all-music catalog first, falls back to liked when empty', async () => {
    // #given
    const likedTracks = [track('l1', 'Lucky', 'Radiohead')];
    const listTracksMock = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(likedTracks);
    descriptor = makeProviderDescriptor({
      id: 'spotify',
      catalog: { providerId: 'spotify', listCollections: vi.fn(), listTracks: listTracksMock },
    });

    mockStartRadio.mockResolvedValue({
      queue: [track('g1', 'Karma Police', 'Radiohead')],
      unmatchedSuggestions: [],
    });

    const { result } = renderSession();

    // #when
    await act(async () => {
      await result.current.handleStartRadio();
    });

    // #then
    expect(listTracksMock).toHaveBeenCalledTimes(2);
    expect(listTracksMock).toHaveBeenCalledWith({ provider: 'spotify', kind: 'folder', id: '' });
    expect(listTracksMock).toHaveBeenCalledWith({ provider: 'spotify', kind: 'liked', id: '' });
    expect(mockStartRadio).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'track', artist: 'Radiohead', track: 'Creep' }),
      likedTracks,
    );
  });

  it('uses all-music catalog when it returns tracks', async () => {
    // #given
    const allMusicTracks = [track('a1', 'OK Computer', 'Radiohead')];
    const listTracksMock = vi.fn().mockResolvedValueOnce(allMusicTracks);
    descriptor = makeProviderDescriptor({
      id: 'spotify',
      catalog: { providerId: 'spotify', listCollections: vi.fn(), listTracks: listTracksMock },
    });

    mockStartRadio.mockResolvedValue({
      queue: [track('g1', 'Karma Police', 'Radiohead')],
      unmatchedSuggestions: [],
    });

    const { result } = renderSession();

    // #when
    await act(async () => {
      await result.current.handleStartRadio();
    });

    // #then
    expect(listTracksMock).toHaveBeenCalledTimes(1);
    expect(mockStartRadio).toHaveBeenCalledWith(
      expect.anything(),
      allMusicTracks,
    );
  });

  it('reports progress through all phases', async () => {
    // #given
    mockStartRadio.mockResolvedValue({
      queue: [track('g1', 'Karma Police', 'Radiohead')],
      unmatchedSuggestions: [],
    });

    const { result } = renderSession();

    // #when
    await act(async () => {
      await result.current.handleStartRadio();
    });

    // #then
    const phases = mockOnProgress.mock.calls.map((c: [RadioProgress | null]) => c[0]?.phase ?? null);
    expect(phases).toEqual(['fetching-catalog', 'generating', 'done']);
  });

  it('includes resolving phase when there are unmatched suggestions', async () => {
    // #given
    const searchProvider = makeProviderDescriptor({
      id: 'spotify',
      capabilities: { hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true, hasTrackSearch: true },
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
        listCollections: vi.fn(),
        listTracks: vi.fn().mockResolvedValue([]),
        searchTrack: vi.fn().mockResolvedValue(track('resolved-1', 'Fake Plastic Trees', 'Radiohead')),
      },
    });
    vi.mocked(providerRegistry.getAll).mockReturnValue([searchProvider]);

    mockStartRadio.mockResolvedValue({
      queue: [track('g1', 'Karma Police', 'Radiohead')],
      unmatchedSuggestions: [{ name: 'Fake Plastic Trees', artist: 'Radiohead', matchScore: 0.8 }],
    });

    const { result } = renderSession();

    // #when
    await act(async () => {
      await result.current.handleStartRadio();
    });

    // #then
    const phases = mockOnProgress.mock.calls.map((c: [RadioProgress | null]) => c[0]?.phase ?? null);
    expect(phases).toContain('resolving');
  });

  it('resolves unmatched suggestions via search-capable providers', async () => {
    // #given
    const resolvedTrack = track('resolved-1', 'Fake Plastic Trees', 'Radiohead');
    const searchProvider = makeProviderDescriptor({
      id: 'spotify',
      capabilities: { hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true, hasTrackSearch: true },
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
        listCollections: vi.fn(),
        listTracks: vi.fn().mockResolvedValue([]),
        searchTrack: vi.fn().mockResolvedValue(resolvedTrack),
      },
    });
    vi.mocked(providerRegistry.getAll).mockReturnValue([searchProvider]);

    mockStartRadio.mockResolvedValue({
      queue: [track('g1', 'Karma Police', 'Radiohead')],
      unmatchedSuggestions: [{ name: 'Fake Plastic Trees', artist: 'Radiohead', matchScore: 0.8 }],
    });

    const { result } = renderSession();

    // #when
    await act(async () => {
      await result.current.handleStartRadio();
    });

    // #then
    expect(trackOps.setTracks).toHaveBeenCalled();
    const setTracksCall = trackOps.setTracks.mock.calls[0][0] as MediaTrack[];
    const names = setTracksCall.map(t => t.name);
    expect(names).toContain('Fake Plastic Trees');
    expect(names).toContain('Karma Police');
  });

  it('deduplicates resolved tracks that already exist in generated queue', async () => {
    // #given
    const existingTrack = track('g1', 'Karma Police', 'Radiohead');
    const duplicateResolved = track('resolved-dup', 'Karma Police', 'Radiohead');
    const searchProvider = makeProviderDescriptor({
      id: 'spotify',
      capabilities: { hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true, hasTrackSearch: true },
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
        listCollections: vi.fn(),
        listTracks: vi.fn().mockResolvedValue([]),
        searchTrack: vi.fn().mockResolvedValue(duplicateResolved),
      },
    });
    vi.mocked(providerRegistry.getAll).mockReturnValue([searchProvider]);

    mockStartRadio.mockResolvedValue({
      queue: [existingTrack],
      unmatchedSuggestions: [{ name: 'Karma Police', artist: 'Radiohead', matchScore: 0.7 }],
    });

    const { result } = renderSession();

    // #when
    await act(async () => {
      await result.current.handleStartRadio();
    });

    // #then
    const setTracksCall = trackOps.setTracks.mock.calls[0][0] as MediaTrack[];
    const karmaCount = setTracksCall.filter(t => t.name === 'Karma Police').length;
    expect(karmaCount).toBe(1);
  });

  it('clears progress when startRadio returns null', async () => {
    // #given
    mockStartRadio.mockResolvedValue(null);

    const { result } = renderSession();

    // #when
    await act(async () => {
      await result.current.handleStartRadio();
    });

    // #then
    expect(mockOnProgress).toHaveBeenLastCalledWith(null);
    expect(trackOps.setTracks).not.toHaveBeenCalled();
  });

  it('sets error state when generation throws', async () => {
    // #given
    mockStartRadio.mockRejectedValue(new Error('Last.fm API down'));

    const { result } = renderSession();

    // #when
    await act(async () => {
      await result.current.handleStartRadio();
    });

    // #then
    expect(trackOps.setError).toHaveBeenCalledWith('Last.fm API down');
    expect(mockOnProgress).toHaveBeenLastCalledWith(null);
  });

  it('sets generic error message for non-Error throws', async () => {
    // #given
    mockStartRadio.mockRejectedValue('network failure');

    const { result } = renderSession();

    // #when
    await act(async () => {
      await result.current.handleStartRadio();
    });

    // #then
    expect(trackOps.setError).toHaveBeenCalledWith('Failed to start radio.');
  });

  it('uses currentTrack as seed when mediaTracksRef entry does not match', async () => {
    // #given
    trackOps.mediaTracksRef.current = [track('other-id', 'Other Song', 'Other Artist')];

    mockStartRadio.mockResolvedValue({
      queue: [track('g1', 'Karma Police', 'Radiohead')],
      unmatchedSuggestions: [],
    });

    const { result } = renderSession({ currentTrackIndex: 0 });

    // #when
    await act(async () => {
      await result.current.handleStartRadio();
    });

    // #then
    const setTracksCall = trackOps.setTracks.mock.calls[0][0] as MediaTrack[];
    expect(setTracksCall[0].id).toBe('seed-1');
    expect(setTracksCall[0].name).toBe('Creep');
  });

  it('stopRadio delegates to stopRadioBase and clears authExpired', () => {
    // #given
    const { result } = renderSession({ authExpired: 'spotify' });

    // #when
    act(() => {
      result.current.stopRadio();
    });

    // #then
    expect(mockStopRadioBase).toHaveBeenCalled();
    expect(mockSetAuthExpired).toHaveBeenCalledWith(null);
  });

  it('clearAuthExpired sets authExpired to null', () => {
    // #given
    const { result } = renderSession({ authExpired: 'spotify' });

    // #when
    act(() => {
      result.current.clearAuthExpired();
    });

    // #then
    expect(mockSetAuthExpired).toHaveBeenCalledWith(null);
  });

  it('initializes search-capable providers for playback', async () => {
    // #given
    const initMock = vi.fn().mockResolvedValue(undefined);
    const searchProvider = makeProviderDescriptor({
      id: 'spotify',
      capabilities: { hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true, hasTrackSearch: true },
      auth: {
        providerId: 'spotify',
        isAuthenticated: vi.fn().mockReturnValue(true),
        getAccessToken: vi.fn(),
        beginLogin: vi.fn(),
        handleCallback: vi.fn(),
        logout: vi.fn(),
      },
      playback: {
        providerId: 'spotify',
        initialize: initMock,
        playTrack: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        seek: vi.fn(),
        next: vi.fn(),
        previous: vi.fn(),
        setVolume: vi.fn(),
        getState: vi.fn(),
        subscribe: vi.fn().mockReturnValue(vi.fn()),
        getLastPlayTime: vi.fn(),
      },
    });
    vi.mocked(providerRegistry.getAll).mockReturnValue([searchProvider]);

    mockStartRadio.mockResolvedValue({
      queue: [track('g1', 'Karma Police', 'Radiohead')],
      unmatchedSuggestions: [],
    });

    const { result } = renderSession();

    // #when
    await act(async () => {
      await result.current.handleStartRadio();
    });

    // #then
    expect(initMock).toHaveBeenCalled();
  });
});
