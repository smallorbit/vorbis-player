import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    setVolume: vi.fn().mockResolvedValue(undefined),
  },
}));

import { useVolume } from '../useVolume';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { ProviderWrapper } from '@/test/providerTestUtils';

describe('useVolume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
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
});
