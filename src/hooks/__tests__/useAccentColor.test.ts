import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/utils/colorExtractor', () => ({
  extractDominantColor: vi.fn(),
}));

vi.mock('@/contexts/ProfilingContext', () => ({
  isProfilingEnabled: () => false,
}));

import { useAccentColor } from '../useAccentColor';
import { extractDominantColor } from '@/utils/colorExtractor';
import { makeTrack } from '@/test/fixtures';

describe('useAccentColor', () => {
  const setAccentColor = vi.fn();
  const setAccentColorOverrides = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractDominantColor).mockResolvedValue({
      hex: '#ff6b6b',
      rgb: 'rgb(255, 107, 107)',
      hsl: 'hsl(0, 100%, 71%)',
    });
  });

  it('uses override from accentColorOverrides when album_id matches', () => {
    const track = makeTrack({ album_id: 'album-1', image: 'img.jpg' });
    const overrides = { 'album-1': '#00ff00' };

    renderHook(() =>
      useAccentColor(track, overrides, setAccentColor, setAccentColorOverrides)
    );

    expect(setAccentColor).toHaveBeenCalledWith('#00ff00');
    expect(extractDominantColor).not.toHaveBeenCalled();
  });

  it('calls extractDominantColor when no override exists', async () => {
    const track = makeTrack({ album_id: 'album-2', image: 'img.jpg' });

    renderHook(() =>
      useAccentColor(track, {}, setAccentColor, setAccentColorOverrides)
    );

    await waitFor(() => {
      expect(extractDominantColor).toHaveBeenCalledWith('img.jpg');
      expect(setAccentColor).toHaveBeenCalledWith('#ff6b6b');
    });
  });

  it('falls back to theme color on extraction failure', async () => {
    vi.mocked(extractDominantColor).mockResolvedValue(null);
    const track = makeTrack({ album_id: 'album-3', image: 'img.jpg' });

    renderHook(() =>
      useAccentColor(track, {}, setAccentColor, setAccentColorOverrides)
    );

    await waitFor(() => {
      expect(setAccentColor).toHaveBeenCalledWith(expect.stringMatching(/^#/));
    });
  });

  it('falls back to theme color when track has no image', () => {
    const track = makeTrack({ album_id: 'album-4', image: undefined });

    renderHook(() =>
      useAccentColor(track, {}, setAccentColor, setAccentColorOverrides)
    );

    expect(setAccentColor).toHaveBeenCalled();
    expect(extractDominantColor).not.toHaveBeenCalled();
  });

  it('sets theme color when currentTrack is null', () => {
    renderHook(() =>
      useAccentColor(null, {}, setAccentColor, setAccentColorOverrides)
    );

    expect(setAccentColor).toHaveBeenCalled();
  });

  it('handleAccentColorChange with auto removes override and re-extracts', async () => {
    const track = makeTrack({ album_id: 'album-5', image: 'img.jpg' });
    const overrides = { 'album-5': '#custom' };

    const { result } = renderHook(() =>
      useAccentColor(track, overrides, setAccentColor, setAccentColorOverrides)
    );

    result.current.handleAccentColorChange('auto');

    expect(setAccentColorOverrides).toHaveBeenCalledWith(expect.any(Function));

    await waitFor(() => {
      expect(extractDominantColor).toHaveBeenCalledWith('img.jpg');
    });
  });

  it('handleAccentColorChange with hex saves to overrides', () => {
    const track = makeTrack({ album_id: 'album-6', image: 'img.jpg' });

    const { result } = renderHook(() =>
      useAccentColor(track, {}, setAccentColor, setAccentColorOverrides)
    );

    result.current.handleAccentColorChange('#ff0000');

    expect(setAccentColorOverrides).toHaveBeenCalledWith(expect.any(Function));
    expect(setAccentColor).toHaveBeenCalledWith('#ff0000');
  });

  it('falls back to theme color on extraction rejection', async () => {
    vi.mocked(extractDominantColor).mockRejectedValue(new Error('CORS'));
    const track = makeTrack({ album_id: 'album-7', image: 'img.jpg' });

    renderHook(() =>
      useAccentColor(track, {}, setAccentColor, setAccentColorOverrides)
    );

    await waitFor(() => {
      expect(setAccentColor).toHaveBeenCalled();
    });
  });
});
