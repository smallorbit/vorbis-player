/**
 * Tests for the onAuthExpired handler in usePlayerLogic.
 * Verifies that an AuthExpiredError from playback triggers reportUnauthorized()
 * on the affected provider and updates authExpired state.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePlayerLogic } from '../usePlayerLogic';
import { TrackProvider } from '@/contexts/TrackContext';
import { VisualEffectsProvider } from '@/contexts/visualEffects';
import { ColorProvider } from '@/contexts/ColorContext';
import { ProviderProvider } from '@/contexts/ProviderContext';
import type { ProviderId } from '@/types/domain';

let capturedOnAuthExpired: ((providerId: ProviderId) => void) | undefined;

vi.mock('@/hooks/useProviderPlayback', () => ({
  useProviderPlayback: vi.fn((props: { onAuthExpired?: (id: ProviderId) => void }) => {
    capturedOnAuthExpired = props.onAuthExpired;
    return {
      playTrack: vi.fn(),
      currentPlaybackProviderRef: { current: null },
    };
  }),
}));

vi.mock('@/hooks/usePlaylistManager', () => ({
  usePlaylistManager: vi.fn(() => ({ handlePlaylistSelect: vi.fn() })),
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

vi.mock('@/hooks/useRadio', () => ({
  useRadio: vi.fn(() => ({
    radioState: { isActive: false, isGenerating: false, error: null, lastMatchStats: null },
    startRadio: vi.fn(),
    stopRadio: vi.fn(),
    isRadioAvailable: true,
  })),
}));

const reportUnauthorizedSpy = vi.fn();

const mockDescriptor = {
  id: 'spotify' as const,
  name: 'Spotify',
  catalog: { listTracks: vi.fn().mockResolvedValue([]) },
  auth: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    logout: vi.fn(),
    reportUnauthorized: reportUnauthorizedSpy,
  },
  playback: {
    initialize: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn(),
    playTrack: vi.fn(),
    getState: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn(() => vi.fn()),
  },
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
      disconnectToast: null,
      dismissDisconnectToast: vi.fn(),
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
    get: vi.fn((id: string) => (id === 'spotify' ? mockDescriptor : undefined)),
    getAll: vi.fn(() => []),
    has: vi.fn(() => true),
    register: vi.fn(),
  },
}));

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

describe('usePlayerLogic — onAuthExpired handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnAuthExpired = undefined;
  });

  it('calls reportUnauthorized on the provider when auth expires during playback', async () => {
    // #given
    renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when — simulate AuthExpiredError surfacing from playback adapter
    await act(async () => {
      capturedOnAuthExpired?.('spotify');
    });

    // #then
    expect(reportUnauthorizedSpy).toHaveBeenCalledOnce();
  });

  it('sets authExpired state to the affected provider id', async () => {
    // #given
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    await act(async () => {
      capturedOnAuthExpired?.('spotify');
    });

    // #then
    expect(result.current.radio.authExpired).toBe('spotify');
  });

  it('does not call reportUnauthorized when provider has no auth adapter', async () => {
    // #given — provider id that has no registered descriptor
    const { result: _ } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when — unknown provider id
    await act(async () => {
      capturedOnAuthExpired?.('dropbox');
    });

    // #then — reportUnauthorized not called (no descriptor for 'dropbox' in this mock)
    expect(reportUnauthorizedSpy).not.toHaveBeenCalled();
  });
});
