import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Keep the real Spotify provider import (pulled in by ProviderContext) inert.
// Its descriptor auto-registers at module load; we overwrite the 'spotify'
// entry with a spy-backed mock below, so these stubs only prevent the real
// SDK/network code from running during import.
vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    setVolume: vi.fn().mockResolvedValue(undefined),
    onPlayerStateChanged: vi.fn(() => vi.fn()),
    getCurrentState: vi.fn().mockResolvedValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
    playTrack: vi.fn().mockResolvedValue(undefined),
    getDeviceId: vi.fn().mockReturnValue(null),
    getIsReady: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('@/services/spotify', () => ({
  checkTrackSaved: vi.fn(),
  saveTrack: vi.fn(),
  unsaveTrack: vi.fn(),
  spotifyAuth: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    getAccessToken: vi.fn().mockReturnValue('test-token'),
    ensureValidToken: vi.fn().mockResolvedValue('test-token'),
    handleRedirect: vi.fn().mockResolvedValue(undefined),
    redirectToAuth: vi.fn(),
    logout: vi.fn(),
  },
  getUserLibraryInterleaved: vi.fn(),
  getPlaylistTracks: vi.fn(),
  getAlbumTracks: vi.fn(),
  getLikedSongs: vi.fn(),
  getLikedSongsCount: vi.fn(),
}));

// NOTE: unlike useVolume.test.ts, this suite does NOT mock '@/providers/registry'
// or '@/contexts/ProviderContext'. It exercises the real ProviderProvider and the
// real singleton registry so the cross-provider handoff resolves the playing
// descriptor through the genuine `getPlayingPlayback` → registry path — the exact
// seam bug #1648 broke.
import { useVolume } from '../useVolume';
import { providerRegistry } from '@/providers/registry';
import { ProviderWrapper } from '@/test/providerTestUtils';
import { makeProviderDescriptor } from '@/test/fixtures';
import { STORAGE_KEYS } from '@/constants/storage';
import type { ProviderId } from '@/types/domain';

function makePlayback(providerId: ProviderId, setVolume: ReturnType<typeof vi.fn>) {
  return {
    providerId,
    initialize: vi.fn().mockResolvedValue(undefined),
    playTrack: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    seek: vi.fn().mockResolvedValue(undefined),
    next: vi.fn().mockResolvedValue(undefined),
    previous: vi.fn().mockResolvedValue(undefined),
    setVolume,
    getState: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    getLastPlayTime: vi.fn().mockReturnValue(0),
  };
}

function authenticatedAuth(providerId: ProviderId) {
  return {
    providerId,
    isAuthenticated: vi.fn().mockReturnValue(true),
    getAccessToken: vi.fn(),
    beginLogin: vi.fn(),
    handleCallback: vi.fn(),
    logout: vi.fn(),
  };
}

describe('useVolume (integration — real registry + ProviderProvider)', () => {
  let spotifySetVolume: ReturnType<typeof vi.fn>;
  let dropboxSetVolume: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    spotifySetVolume = vi.fn().mockResolvedValue(undefined);
    dropboxSetVolume = vi.fn().mockResolvedValue(undefined);

    // Register spy-backed descriptors into the REAL registry. Re-registering
    // 'spotify' overwrites the inert real descriptor pulled in at import. The
    // registry is isolated per test file (vitest module isolation), so this
    // does not leak to other suites.
    providerRegistry.register(
      makeProviderDescriptor({
        id: 'spotify',
        auth: authenticatedAuth('spotify'),
        playback: makePlayback('spotify', spotifySetVolume),
      }),
    );
    providerRegistry.register(
      makeProviderDescriptor({
        id: 'dropbox',
        name: 'Dropbox',
        auth: authenticatedAuth('dropbox'),
        playback: makePlayback('dropbox', dropboxSetVolume),
      }),
    );

    // Active provider = spotify; volume/mute fall back to defaults (50, false).
    vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => {
      if (key === STORAGE_KEYS.ACTIVE_PROVIDER) return JSON.stringify('spotify');
      return null;
    });
  });

  it('resolves the active descriptor through the real ProviderProvider on mount', () => {
    // #given / #when - hook mounts with spotify as the playing provider
    renderHook(() => useVolume('spotify'), { wrapper: ProviderWrapper });

    // #then - the real registry resolved the active (spotify) descriptor and the
    // effect applied the live default volume (50/100) to it.
    expect(spotifySetVolume).toHaveBeenCalledWith(0.5);
    expect(dropboxSetVolume).not.toHaveBeenCalled();
  });

  it('reapplies the live volume to the new provider on a real cross-provider handoff', () => {
    // #given - mounted with spotify playing
    const { result, rerender } = renderHook(
      ({ provider }: { provider: ProviderId }) => useVolume(provider),
      { wrapper: ProviderWrapper, initialProps: { provider: 'spotify' as ProviderId } },
    );

    // #given - user raises the volume to 80 mid-session
    act(() => {
      result.current.setVolumeLevel(80);
    });
    expect(spotifySetVolume).toHaveBeenLastCalledWith(0.8);

    dropboxSetVolume.mockClear();

    // #when - the queue advances to a Dropbox track (currentTrackProvider flips).
    // getPlayingPlayback now resolves the Dropbox descriptor via the REAL registry.
    rerender({ provider: 'dropbox' });

    // #then - Dropbox receives the live volume (0.8), never the mount-time 0.5.
    expect(dropboxSetVolume).toHaveBeenCalledWith(0.8);
    expect(dropboxSetVolume).not.toHaveBeenCalledWith(0.5);
  });

  it('keeps the new provider muted across a real cross-provider handoff', () => {
    // #given - mounted with spotify playing, user mutes mid-session
    const { result, rerender } = renderHook(
      ({ provider }: { provider: ProviderId }) => useVolume(provider),
      { wrapper: ProviderWrapper, initialProps: { provider: 'spotify' as ProviderId } },
    );

    act(() => {
      result.current.handleMuteToggle();
    });

    dropboxSetVolume.mockClear();

    // #when - queue advances to a Dropbox track
    rerender({ provider: 'dropbox' });

    // #then - Dropbox is handed the muted level (0), not the underlying volume
    expect(dropboxSetVolume).toHaveBeenCalledWith(0);
    expect(dropboxSetVolume).not.toHaveBeenCalledWith(0.5);
    expect(result.current.isMuted).toBe(true);
  });
});
