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
    const track = makeTrack({ albumId: 'album-1', image: 'img.jpg' });
    const overrides = { 'album-1': '#00ff00' };

    renderHook(() =>
      useAccentColor(track, overrides, setAccentColor, setAccentColorOverrides)
    );

    expect(setAccentColor).toHaveBeenCalledWith('#00ff00');
    expect(extractDominantColor).not.toHaveBeenCalled();
  });

  it('calls extractDominantColor when no override exists', async () => {
    // #given
    const track = makeTrack({ albumId: 'album-2', image: 'img.jpg' });

    // #when - render with no overrides
    renderHook(() =>
      useAccentColor(track, {}, setAccentColor, setAccentColorOverrides)
    );

    // #then
    await waitFor(() => {
      expect(extractDominantColor).toHaveBeenCalledWith('img.jpg');
      expect(setAccentColor).toHaveBeenCalledWith('#ff6b6b');
    });
  });

  it('falls back to theme color on extraction failure', async () => {
    // #given - extraction returns null
    vi.mocked(extractDominantColor).mockResolvedValue(null);
    const track = makeTrack({ albumId: 'album-3', image: 'img.jpg' });

    // #when - render with failing extraction
    renderHook(() =>
      useAccentColor(track, {}, setAccentColor, setAccentColorOverrides)
    );

    // #then
    await waitFor(() => {
      expect(setAccentColor).toHaveBeenCalledWith(expect.stringMatching(/^#/));
    });
  });

  it('falls back to theme color when track has no image', () => {
    const track = makeTrack({ albumId: 'album-4', image: undefined });

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
    // #given
    const track = makeTrack({ albumId: 'album-5', image: 'img.jpg' });
    const overrides = { 'album-5': '#custom' };

    const { result } = renderHook(() =>
      useAccentColor(track, overrides, setAccentColor, setAccentColorOverrides)
    );

    // #when - change to 'auto'
    result.current.handleAccentColorChange('auto');

    // #then
    expect(setAccentColorOverrides).toHaveBeenCalledWith(expect.any(Function));

    await waitFor(() => {
      expect(extractDominantColor).toHaveBeenCalledWith('img.jpg');
    });
  });

  it('handleAccentColorChange with hex saves to overrides', () => {
    // #given
    const track = makeTrack({ albumId: 'album-6', image: 'img.jpg' });

    const { result } = renderHook(() =>
      useAccentColor(track, {}, setAccentColor, setAccentColorOverrides)
    );

    // #when - change to specific hex color
    result.current.handleAccentColorChange('#ff0000');

    // #then
    expect(setAccentColorOverrides).toHaveBeenCalledWith(expect.any(Function));
    expect(setAccentColor).toHaveBeenCalledWith('#ff0000');
  });

  it('falls back to theme color on extraction rejection', async () => {
    // #given - extraction promise rejects
    vi.mocked(extractDominantColor).mockRejectedValue(new Error('CORS'));
    const track = makeTrack({ albumId: 'album-7', image: 'img.jpg' });

    // #when - render with rejection error
    renderHook(() =>
      useAccentColor(track, {}, setAccentColor, setAccentColorOverrides)
    );

    // #then
    await waitFor(() => {
      expect(setAccentColor).toHaveBeenCalled();
    });
  });
});
