import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    setVolume: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(),
  ProviderProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: vi.fn().mockReturnValue(undefined),
    getAll: vi.fn().mockReturnValue([]),
    has: vi.fn().mockReturnValue(false),
  },
}));

import { useVolume } from '../useVolume';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { useProviderContext } from '@/contexts/ProviderContext';
import { providerRegistry } from '@/providers/registry';
import { ProviderWrapper } from '@/test/providerTestUtils';
import { makeProviderDescriptor } from '@/test/fixtures';

describe('useVolume', () => {
  let mockSpotifyDescriptor: ReturnType<typeof makeProviderDescriptor>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);

    mockSpotifyDescriptor = makeProviderDescriptor({
      id: 'spotify',
      playback: {
        providerId: 'spotify',
        initialize: vi.fn().mockResolvedValue(undefined),
        playTrack: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
        seek: vi.fn().mockResolvedValue(undefined),
        next: vi.fn().mockResolvedValue(undefined),
        previous: vi.fn().mockResolvedValue(undefined),
        setVolume: vi.mocked(spotifyPlayer.setVolume),
        getState: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockReturnValue(vi.fn()),
        getLastPlayTime: vi.fn().mockReturnValue(Date.now()),
      },
    });

    vi.mocked(useProviderContext).mockReturnValue({
      chosenProviderId: 'spotify',
      activeProviderId: 'spotify',
      activeDescriptor: mockSpotifyDescriptor,
      setActiveProviderId: vi.fn(),
      setProviderSwitchInterceptor: vi.fn(),
      registry: { get: vi.fn(), getAll: vi.fn().mockReturnValue([]), has: vi.fn() },
      needsProviderSelection: false,
      enabledProviderIds: ['spotify'],
      toggleProvider: vi.fn(),
      isProviderEnabled: vi.fn().mockReturnValue(true),
      hasMultipleProviders: false,
      getDescriptor: vi.fn(),
      connectedProviderIds: ['spotify'],
      fallthroughNotification: null,
      dismissFallthroughNotification: vi.fn(),
      disconnectToast: null,
      dismissDisconnectToast: vi.fn(),
    });

    vi.mocked(providerRegistry.get).mockReturnValue(undefined);
  });

  it('defaults volume to 50 when localStorage is empty', () => {
    const { result } = renderHook(() => useVolume(), { wrapper: ProviderWrapper });

    expect(result.current.volume).toBe(50);
    expect(result.current.isMuted).toBe(false);
  });

  it('loads volume from localStorage on init', () => {
    // #given
    vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'vorbis-player-volume') return '75';
      return null;
    });

    // #when
    const { result } = renderHook(() => useVolume(), { wrapper: ProviderWrapper });

    // #then
    expect(result.current.volume).toBe(75);
  });

  it('mute toggle sets volume to 0 and isMuted to true', () => {
    const { result } = renderHook(() => useVolume(), { wrapper: ProviderWrapper });

    // #when
    act(() => {
      result.current.handleMuteToggle();
    });

    // #then
    expect(result.current.isMuted).toBe(true);
    expect(spotifyPlayer.setVolume).toHaveBeenCalledWith(0);
  });

  it('unmute toggle restores previous volume', () => {
    const { result } = renderHook(() => useVolume(), { wrapper: ProviderWrapper });

    // #given - mute first
    act(() => {
      result.current.handleMuteToggle();
    });
    vi.clearAllMocks();

    // #when - unmute
    act(() => {
      result.current.handleMuteToggle();
    });

    // #then
    expect(result.current.isMuted).toBe(false);
    expect(spotifyPlayer.setVolume).toHaveBeenCalledWith(0.5); // 50 / 100
  });

  it('setVolumeLevel(0) auto-sets isMuted to true', () => {
    const { result } = renderHook(() => useVolume(), { wrapper: ProviderWrapper });

    // #when
    act(() => {
      result.current.setVolumeLevel(0);
    });

    // #then
    expect(result.current.isMuted).toBe(true);
    expect(result.current.volume).toBe(0);
  });

  it('setVolumeLevel(50) clears muted state', () => {
    const { result } = renderHook(() => useVolume(), { wrapper: ProviderWrapper });

    // #given - mute first
    act(() => {
      result.current.handleMuteToggle();
    });

    // #when
    act(() => {
      result.current.setVolumeLevel(50);
    });

    // #then
    expect(result.current.isMuted).toBe(false);
    expect(result.current.volume).toBe(50);
  });

  it('clamps volume to [0, 100]', () => {
    // #given
    const { result } = renderHook(() => useVolume(), { wrapper: ProviderWrapper });

    // #when - set above 100
    act(() => {
      result.current.setVolumeLevel(150);
    });

    // #then
    expect(result.current.volume).toBe(100);

    // #when - set below 0
    act(() => {
      result.current.setVolumeLevel(-10);
    });

    // #then
    expect(result.current.volume).toBe(0);
  });

  it('calls spotifyPlayer.setVolume on initial mount', () => {
    renderHook(() => useVolume(), { wrapper: ProviderWrapper });

    expect(spotifyPlayer.setVolume).toHaveBeenCalled();
  });

  it('saves volume to localStorage on change', () => {
    const { result } = renderHook(() => useVolume(), { wrapper: ProviderWrapper });

    // #when
    act(() => {
      result.current.setVolumeLevel(80);
    });

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'vorbis-player-volume',
      '80'
    );
  });

  it('reapplies current volume (not mount-time value) on cross-provider handoff', () => {
    // #given - mount with default volume 50, then change to 80
    vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'vorbis-player-volume') return '80';
      return null;
    });

    const dropboxSetVolume = vi.fn().mockResolvedValue(undefined);
    const dropboxDescriptor = makeProviderDescriptor({
      id: 'dropbox',
      playback: {
        providerId: 'dropbox',
        initialize: vi.fn().mockResolvedValue(undefined),
        playTrack: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
        seek: vi.fn().mockResolvedValue(undefined),
        next: vi.fn().mockResolvedValue(undefined),
        previous: vi.fn().mockResolvedValue(undefined),
        setVolume: dropboxSetVolume,
        getState: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockReturnValue(vi.fn()),
        getLastPlayTime: vi.fn().mockReturnValue(Date.now()),
      },
    });

    vi.mocked(providerRegistry.get).mockImplementation((id) =>
      id === 'dropbox' ? dropboxDescriptor : undefined
    );

    // activeDescriptor is spotify; currentTrackProvider starts as spotify
    const { rerender } = renderHook(
      ({ provider }: { provider: 'spotify' | 'dropbox' }) => useVolume(provider),
      { wrapper: ProviderWrapper, initialProps: { provider: 'spotify' as const } }
    );

    vi.clearAllMocks();

    // #when - queue advances from Spotify to Dropbox (cross-provider handoff)
    rerender({ provider: 'dropbox' });

    // #then - Dropbox playback receives the current volume (80), not the mount-time value
    expect(dropboxSetVolume).toHaveBeenCalledWith(0.8); // 80 / 100
    expect(dropboxSetVolume).not.toHaveBeenCalledWith(0.5); // mount-time 50 / 100 must not appear
  });
});
