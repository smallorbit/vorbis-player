/**
 * Tests for handleStartRadio behavior in usePlayerLogic.
 * Verifies:
 * - No playback restart when radio starts (playTrack is NOT called).
 * - Seed track is placed at index 0 in the resulting queue.
 * - Seed track is deduped if it appears in the generated recommendations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Shared mutable mock state ──────────────────────────────────────────────
// Using closures that are captured by vi.mock factories (which are hoisted,
// so we use module-level refs to share state between factory and tests).

const mockPlayTrack = vi.fn().mockResolvedValue(undefined);
const mockStartRadio = vi.fn();
const mockListTracks = vi.fn().mockResolvedValue([]);

// ── Module mocks (hoisted before imports) ─────────────────────────────────

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getIsReady: vi.fn().mockReturnValue(true),
    getDeviceId: vi.fn().mockReturnValue('device-1'),
    transferPlaybackToDevice: vi.fn().mockResolvedValue(undefined),
    ensureDeviceIsActive: vi.fn().mockResolvedValue(true),
    playTrack: vi.fn().mockResolvedValue(undefined),
    playContext: vi.fn().mockResolvedValue(undefined),
    getCurrentState: vi.fn().mockResolvedValue(null),
    resume: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    redirectToAuth: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(false),
    ensureValidToken: vi.fn().mockResolvedValue('token'),
    handleRedirect: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/spotifyResolver', () => ({
  resolveViaSpotify: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/lastfm', () => ({
  isLastFmConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock('@/hooks/useRadio', () => ({
  useRadio: () => ({
    radioState: {
      isActive: false,
      seedDescription: null,
      isGenerating: false,
      error: null,
      lastMatchStats: null,
    },
    startRadio: mockStartRadio,
    stopRadio: vi.fn(),
    isRadioAvailable: true,
  }),
}));

vi.mock('@/hooks/useAutoAdvance', () => ({
  useAutoAdvance: vi.fn(),
}));

vi.mock('@/hooks/useAccentColor', () => ({
  useAccentColor: vi.fn(),
}));

vi.mock('@/hooks/useUnifiedLikedTracks', () => ({
  useUnifiedLikedTracks: () => ({ isUnifiedLikedActive: false }),
}));

vi.mock('@/hooks/usePlaylistManager', () => ({
  usePlaylistManager: () => ({
    handlePlaylistSelect: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSpotifyPlayback', () => ({
  useSpotifyPlayback: () => ({
    playTrack: mockPlayTrack,
    currentPlaybackProviderRef: { current: 'spotify' },
  }),
}));

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    register: vi.fn(),
    get: vi.fn().mockReturnValue({
      id: 'spotify',
      capabilities: { hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true },
      catalog: { listTracks: (...args: unknown[]) => mockListTracks(...args) },
      playback: {
        initialize: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockReturnValue(() => {}),
        getState: vi.fn().mockResolvedValue(null),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
      },
    }),
    getAll: vi.fn().mockReturnValue([]),
  },
}));

// Mock all contexts so we don't need TestWrapper (avoids CSS.supports jsdom errors)
vi.mock('@/contexts/TrackContext', () => ({
  useTrackListContext: vi.fn(),
  useCurrentTrackContext: vi.fn(),
  TrackProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/contexts/VisualEffectsContext', () => ({
  useVisualEffectsContext: vi.fn().mockReturnValue({ setShowVisualEffects: vi.fn() }),
  VisualEffectsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/contexts/ColorContext', () => ({
  useColorContext: vi.fn().mockReturnValue({
    accentColorOverrides: {},
    setAccentColor: vi.fn(),
    setAccentColorOverrides: vi.fn(),
  }),
  ColorProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(),
  ProviderProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ── Types & fixtures ──────────────────────────────────────────────────────

import React from 'react'; // needed for JSX in mocks above
import type { MediaTrack } from '@/types/domain';
import type { Track } from '@/services/spotify';

function makeMediaTrack(overrides?: Partial<MediaTrack>): MediaTrack {
  return {
    id: 'mt-1',
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: 'spotify:track:mt-1' },
    name: 'Seed Track',
    artists: 'Seed Artist',
    album: 'Seed Album',
    durationMs: 210000,
    ...overrides,
  };
}

function makeTrack(overrides?: Partial<Track>): Track {
  return {
    id: 'track-1',
    name: 'Seed Track',
    artists: 'Seed Artist',
    album: 'Seed Album',
    duration_ms: 210000,
    uri: 'spotify:track:track-1',
    provider: 'spotify',
    ...overrides,
  };
}

// ── Context mock setup ────────────────────────────────────────────────────

import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useProviderContext } from '@/contexts/ProviderContext';

function setupContextMocks(currentTrack: Track | null = null) {
  vi.mocked(useTrackListContext).mockReturnValue({
    tracks: [],
    isLoading: false,
    error: null,
    shuffleEnabled: false,
    selectedPlaylistId: null,
    setTracks: vi.fn(),
    setOriginalTracks: vi.fn(),
    setIsLoading: vi.fn(),
    setError: vi.fn(),
    setSelectedPlaylistId: vi.fn(),
    setShuffleEnabled: vi.fn(),
    originalTracks: [],
  } as ReturnType<typeof useTrackListContext>);

  vi.mocked(useCurrentTrackContext).mockReturnValue({
    currentTrack,
    currentTrackIndex: 0,
    setCurrentTrackIndex: vi.fn(),
    setShowPlaylist: vi.fn(),
  } as unknown as ReturnType<typeof useCurrentTrackContext>);

  vi.mocked(useProviderContext).mockReturnValue({
    activeDescriptor: {
      id: 'spotify',
      capabilities: { hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true },
      catalog: { listTracks: (...args: unknown[]) => mockListTracks(...args) },
      playback: {
        initialize: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockReturnValue(() => {}),
        getState: vi.fn().mockResolvedValue(null),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
      },
    } as ReturnType<typeof useProviderContext>['activeDescriptor'],
    setActiveProviderId: vi.fn(),
    getDescriptor: vi.fn(),
    connectedProviderIds: ['spotify'],
  } as unknown as ReturnType<typeof useProviderContext>);
}

// ── Tests ─────────────────────────────────────────────────────────────────

import { usePlayerLogic } from '../usePlayerLogic';

describe('handleStartRadio', () => {
  const seedTrack = makeTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead', uri: 'spotify:track:seed-1' });
  const seedMediaTrack = makeMediaTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead' });
  const radioTrack1 = makeMediaTrack({ id: 'r-1', name: 'Fake Plastic Trees', artists: 'Radiohead' });
  const radioTrack2 = makeMediaTrack({ id: 'r-2', name: 'Street Spirit', artists: 'Radiohead' });

  beforeEach(() => {
    vi.clearAllMocks();
    setupContextMocks(seedTrack);
  });

  it('does not call playTrack when radio generates a non-empty queue', async () => {
    mockListTracks.mockResolvedValue([radioTrack1, radioTrack2]);
    mockStartRadio.mockResolvedValue({
      queue: [radioTrack1, radioTrack2],
      unmatchedSuggestions: [],
      seedDescription: 'Radio based on Creep by Radiohead',
      matchStats: { matched: 2, total: 5 },
    });

    const { result } = renderHook(() => usePlayerLogic());
    result.current.mediaTracksRef.current = [seedMediaTrack];

    await act(async () => {
      await result.current.handlers.handleStartRadio();
    });

    expect(mockPlayTrack).not.toHaveBeenCalled();
  });

  it('places the seed track at index 0 in the resulting queue', async () => {
    mockListTracks.mockResolvedValue([radioTrack1, radioTrack2]);
    mockStartRadio.mockResolvedValue({
      queue: [radioTrack1, radioTrack2],
      unmatchedSuggestions: [],
      seedDescription: 'Radio based on Creep by Radiohead',
      matchStats: { matched: 2, total: 5 },
    });

    const { result } = renderHook(() => usePlayerLogic());
    result.current.mediaTracksRef.current = [seedMediaTrack];

    await act(async () => {
      await result.current.handlers.handleStartRadio();
    });

    const queue = result.current.mediaTracksRef.current;
    expect(queue).toHaveLength(3);
    expect(queue[0].id).toBe('seed-1');
    expect(queue[1].id).toBe('r-1');
    expect(queue[2].id).toBe('r-2');
  });

  it('deduplicates seed track if it appears in recommendations by normalized artist+title', async () => {
    // Same artist+title as seed but different id
    const seedDuplicate = makeMediaTrack({ id: 'dup-1', name: 'Creep', artists: 'Radiohead' });

    mockListTracks.mockResolvedValue([seedDuplicate, radioTrack1]);
    mockStartRadio.mockResolvedValue({
      queue: [seedDuplicate, radioTrack1],
      unmatchedSuggestions: [],
      seedDescription: 'Radio based on Creep by Radiohead',
      matchStats: { matched: 2, total: 5 },
    });

    const { result } = renderHook(() => usePlayerLogic());
    result.current.mediaTracksRef.current = [seedMediaTrack];

    await act(async () => {
      await result.current.handlers.handleStartRadio();
    });

    const queue = result.current.mediaTracksRef.current;
    // Duplicate removed; seed at 0, unique recommendation follows
    expect(queue).toHaveLength(2);
    expect(queue[0].id).toBe('seed-1');
    expect(queue[1].id).toBe('r-1');
  });

  it('deduplicates seed track if recommendation has the same id', async () => {
    // Same id as seed
    const sameIdRec = makeMediaTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead' });

    mockListTracks.mockResolvedValue([sameIdRec, radioTrack1]);
    mockStartRadio.mockResolvedValue({
      queue: [sameIdRec, radioTrack1],
      unmatchedSuggestions: [],
      seedDescription: 'Radio based on Creep by Radiohead',
      matchStats: { matched: 2, total: 5 },
    });

    const { result } = renderHook(() => usePlayerLogic());
    result.current.mediaTracksRef.current = [seedMediaTrack];

    await act(async () => {
      await result.current.handlers.handleStartRadio();
    });

    const queue = result.current.mediaTracksRef.current;
    expect(queue).toHaveLength(2);
    expect(queue[0].id).toBe('seed-1');
    expect(queue[1].id).toBe('r-1');
  });

  it('uses currentTrack as fallback seed when mediaTracksRef is empty (Spotify flow)', async () => {
    mockListTracks.mockResolvedValue([radioTrack1]);
    mockStartRadio.mockResolvedValue({
      queue: [radioTrack1],
      unmatchedSuggestions: [],
      seedDescription: 'Radio based on Creep by Radiohead',
      matchStats: { matched: 1, total: 5 },
    });

    const { result } = renderHook(() => usePlayerLogic());
    // Spotify path: mediaTracksRef is empty
    result.current.mediaTracksRef.current = [];

    await act(async () => {
      await result.current.handlers.handleStartRadio();
    });

    // playTrack must not be called
    expect(mockPlayTrack).not.toHaveBeenCalled();
    // Seed derived from currentTrack is prepended; radio track follows
    const queue = result.current.mediaTracksRef.current;
    expect(queue).toHaveLength(2);
    expect(queue[0].id).toBe('seed-1'); // from currentTrack fallback
    expect(queue[1].id).toBe('r-1');
  });
});
