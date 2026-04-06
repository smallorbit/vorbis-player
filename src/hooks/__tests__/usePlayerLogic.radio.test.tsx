/**
 * Tests for radio start behavior: preserve current track, no playback restart, queue ordering, dedupe.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePlayerLogic } from '../usePlayerLogic';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { TrackProvider } from '@/contexts/TrackContext';
import { VisualEffectsProvider } from '@/contexts/VisualEffectsContext';
import { ColorProvider } from '@/contexts/ColorContext';
import { ProviderProvider } from '@/contexts/ProviderContext';
import { RADIO_PLAYLIST_ID } from '@/constants/playlist';
import { makeTrack } from '@/test/fixtures';
import type { MediaTrack } from '@/types/domain';

const playTrackSpy = vi.fn();

vi.mock('@/hooks/usePlaylistManager', () => ({
  usePlaylistManager: vi.fn(() => ({ handlePlaylistSelect: vi.fn() })),
}));

vi.mock('@/hooks/useProviderPlayback', () => ({
  useProviderPlayback: vi.fn(() => ({
    playTrack: playTrackSpy,
    currentPlaybackProviderRef: { current: 'spotify' as const },
  })),
}));

vi.mock('@/hooks/useAutoAdvance', () => ({
  useAutoAdvance: vi.fn(),
}));

vi.mock('@/hooks/useAccentColor', () => ({
  useAccentColor: vi.fn(),
}));

vi.mock('@/hooks/useUnifiedLikedTracks', () => ({
  useUnifiedLikedTracks: vi.fn(() => ({ isUnifiedLikedActive: false })),
}));

const useRadioMock = vi.fn();
vi.mock('@/hooks/useRadio', () => ({
  useRadio: (...args: unknown[]) => useRadioMock(...args),
}));

const mockListTracks = vi.fn().mockResolvedValue([]);
const mockDescriptor = {
  id: 'spotify' as const,
  catalog: { listTracks: mockListTracks },
  playback: { initialize: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), resume: vi.fn(), playTrack: vi.fn(), getState: vi.fn().mockResolvedValue(null), subscribe: vi.fn(() => vi.fn()), prepareTrack: undefined },
  capabilities: { hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true },
};

vi.mock('@/contexts/ProviderContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/ProviderContext')>();
  return {
    ...actual,
    useProviderContext: vi.fn(() => ({
      activeDescriptor: mockDescriptor,
      setActiveProviderId: vi.fn(),
      getDescriptor: vi.fn((id: string) => (id === 'spotify' ? mockDescriptor : undefined)),
      connectedProviderIds: ['spotify'],
      chosenProviderId: 'spotify',
      activeProviderId: 'spotify',
      setProviderSwitchInterceptor: vi.fn(),
      registry: {},
      needsProviderSelection: false,
      enabledProviderIds: ['spotify'],
      toggleProvider: vi.fn(),
      isProviderEnabled: vi.fn(() => true),
      hasMultipleProviders: false,
      fallthroughNotification: null,
      dismissFallthroughNotification: vi.fn(),
    })),
  };
});

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    handleRedirect: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn().mockReturnValue(false),
    getAccessToken: vi.fn().mockReturnValue('test-token'),
    ensureValidToken: vi.fn().mockResolvedValue('test-token'),
    redirectToAuth: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    onPlayerStateChanged: vi.fn(() => vi.fn()),
    getCurrentState: vi.fn().mockResolvedValue(null),
    resume: vi.fn(),
    pause: vi.fn(),
    setVolume: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    playTrack: vi.fn().mockResolvedValue(undefined),
    getDeviceId: vi.fn().mockReturnValue(null),
    getIsReady: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: vi.fn(() => mockDescriptor),
    getAll: vi.fn(() => []),
    register: vi.fn(),
  },
}));

function makeMediaTrack(overrides: Partial<MediaTrack> & { name: string; artists: string }): MediaTrack {
  return {
    id: `mt-${overrides.name}-${overrides.artists}`.toLowerCase().replace(/\s+/g, '-'),
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: `spotify:track:${overrides.name}` },
    name: overrides.name,
    artists: overrides.artists,
    album: 'Test Album',
    durationMs: 200000,
    ...overrides,
  };
}

const defaultRadioReturn = {
  radioState: { isActive: false, seedDescription: null, isGenerating: false, error: null, lastMatchStats: null },
  stopRadio: vi.fn(),
  isRadioAvailable: true,
};

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ProviderProvider>
    <TrackProvider>
      <VisualEffectsProvider>
        <ColorProvider>
          {children}
        </ColorProvider>
      </VisualEffectsProvider>
    </TrackProvider>
  </ProviderProvider>
);

/** Hook that exposes both track context and player logic so we can set initial state then call handleStartRadio. */
function useTrackContextAndPlayerLogic() {
  const trackList = useTrackListContext();
  const currentTrackContext = useCurrentTrackContext();
  const playerLogic = usePlayerLogic();
  return { ...trackList, ...currentTrackContext, ...playerLogic };
}

describe('usePlayerLogic — radio start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playTrackSpy.mockClear();
    mockListTracks.mockResolvedValue([]);
  });

  it('does not call playTrack when starting radio (preserves current track playback)', async () => {
    // #given
    const generatedA = makeMediaTrack({ name: 'Karma Police', artists: 'Radiohead' });
    const generatedB = makeMediaTrack({ name: 'No Surprises', artists: 'Radiohead' });

    useRadioMock.mockReturnValue({
      ...defaultRadioReturn,
      startRadio: vi.fn().mockResolvedValue({
        queue: [generatedA, generatedB],
        seedDescription: 'Radio based on Creep by Radiohead',
        matchStats: { lastfmCandidates: 10, matched: 2, byMbid: 0, byName: 2 },
        unmatchedSuggestions: [],
      }),
    });

    const seedTrack = makeTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead', playbackRef: { provider: 'spotify', ref: 'spotify:track:creep' } });
    const { result } = renderHook(() => useTrackContextAndPlayerLogic(), { wrapper: AllProviders });

    act(() => {
      result.current.setTracks([seedTrack]);
      result.current.setCurrentTrackIndex(0);
    });

    // #when
    await act(async () => {
      await result.current.handlers.handleStartRadio();
    });

    // #then
    expect(playTrackSpy).not.toHaveBeenCalled();
  });

  it('sets queue with current track at index 0 and generated tracks after', async () => {
    // #given
    const seedTrack = makeTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead', playbackRef: { provider: 'spotify', ref: 'spotify:track:creep' } });
    const generatedA = makeMediaTrack({ name: 'Karma Police', artists: 'Radiohead' });
    const generatedB = makeMediaTrack({ name: 'No Surprises', artists: 'Radiohead' });

    useRadioMock.mockReturnValue({
      ...defaultRadioReturn,
      startRadio: vi.fn().mockResolvedValue({
        queue: [generatedA, generatedB],
        seedDescription: 'Radio based on Creep by Radiohead',
        matchStats: { lastfmCandidates: 10, matched: 2, byMbid: 0, byName: 2 },
        unmatchedSuggestions: [],
      }),
    });

    const { result } = renderHook(() => useTrackContextAndPlayerLogic(), { wrapper: AllProviders });

    act(() => {
      result.current.setTracks([seedTrack]);
      result.current.setCurrentTrackIndex(0);
    });

    // #when
    await act(async () => {
      await result.current.handlers.handleStartRadio();
    });

    // #then
    const tracks = result.current.state.tracks;
    expect(tracks.length).toBe(3);
    expect(tracks[0].id).toBe(seedTrack.id);
    expect(tracks[0].name).toBe('Creep');
    const generatedNames = tracks.slice(1).map((t) => t.name);
    expect(generatedNames).toContain('Karma Police');
    expect(generatedNames).toContain('No Surprises');
    expect(result.current.state.selectedPlaylistId).toBe(RADIO_PLAYLIST_ID);
  });

  it('deduplicates seed track from generated queue when it appears in recommendations', async () => {
    // #given
    const seedTrack = makeTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead', playbackRef: { provider: 'spotify', ref: 'spotify:track:creep' } });
    const generatedIncludingSeed = makeMediaTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead' });
    const generatedB = makeMediaTrack({ name: 'No Surprises', artists: 'Radiohead' });

    useRadioMock.mockReturnValue({
      ...defaultRadioReturn,
      startRadio: vi.fn().mockResolvedValue({
        queue: [generatedIncludingSeed, generatedB],
        seedDescription: 'Radio based on Creep by Radiohead',
        matchStats: { lastfmCandidates: 10, matched: 2, byMbid: 0, byName: 2 },
        unmatchedSuggestions: [],
      }),
    });

    const { result } = renderHook(() => useTrackContextAndPlayerLogic(), { wrapper: AllProviders });

    act(() => {
      result.current.setTracks([seedTrack]);
      result.current.setCurrentTrackIndex(0);
    });

    // #when
    await act(async () => {
      await result.current.handlers.handleStartRadio();
    });

    // #then
    expect(result.current.state.tracks.length).toBe(2);
    expect(result.current.state.tracks[0].id).toBe('seed-1');
    expect(result.current.state.tracks[0].name).toBe('Creep');
    expect(result.current.state.tracks[1].name).toBe('No Surprises');
  });

  it('deduplicates seed by normalized artist+title when recommendation has different id', async () => {
    // #given
    const seedTrack = makeTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead', playbackRef: { provider: 'spotify', ref: 'spotify:track:creep' } });
    const seedDuplicate = makeMediaTrack({ id: 'dup-1', name: 'Creep', artists: 'Radiohead' });
    const generatedB = makeMediaTrack({ name: 'No Surprises', artists: 'Radiohead' });

    useRadioMock.mockReturnValue({
      ...defaultRadioReturn,
      startRadio: vi.fn().mockResolvedValue({
        queue: [seedDuplicate, generatedB],
        seedDescription: 'Radio based on Creep by Radiohead',
        matchStats: { lastfmCandidates: 10, matched: 2, byMbid: 0, byName: 2 },
        unmatchedSuggestions: [],
      }),
    });

    const { result } = renderHook(() => useTrackContextAndPlayerLogic(), { wrapper: AllProviders });

    act(() => {
      result.current.setTracks([seedTrack]);
      result.current.setCurrentTrackIndex(0);
    });

    // #when
    await act(async () => {
      await result.current.handlers.handleStartRadio();
    });

    // #then
    expect(result.current.state.tracks.length).toBe(2);
    expect(result.current.state.tracks[0].id).toBe('seed-1');
    expect(result.current.state.tracks[0].name).toBe('Creep');
    expect(result.current.state.tracks[1].name).toBe('No Surprises');
  });

  it('uses currentTrack as fallback seed when mediaTracksRef is empty (Spotify flow)', async () => {
    // #given
    const seedTrack = makeTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead', playbackRef: { provider: 'spotify', ref: 'spotify:track:creep' } });
    const generatedA = makeMediaTrack({ name: 'Karma Police', artists: 'Radiohead' });

    useRadioMock.mockReturnValue({
      ...defaultRadioReturn,
      startRadio: vi.fn().mockResolvedValue({
        queue: [generatedA],
        seedDescription: 'Radio based on Creep by Radiohead',
        matchStats: { lastfmCandidates: 10, matched: 1, byMbid: 0, byName: 1 },
        unmatchedSuggestions: [],
      }),
    });

    const { result } = renderHook(() => useTrackContextAndPlayerLogic(), { wrapper: AllProviders });

    act(() => {
      result.current.setTracks([seedTrack]);
      result.current.setCurrentTrackIndex(0);
    });

    // #when
    await act(async () => {
      await result.current.handlers.handleStartRadio();
    });

    // #then
    expect(playTrackSpy).not.toHaveBeenCalled();
    expect(result.current.state.tracks.length).toBe(2);
    expect(result.current.state.tracks[0].id).toBe('seed-1');
    expect(result.current.state.tracks[0].name).toBe('Creep');
    expect(result.current.state.tracks[1].name).toBe('Karma Police');
  });
});
