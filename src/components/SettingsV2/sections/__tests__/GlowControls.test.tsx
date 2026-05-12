import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import { STORAGE_KEYS } from '@/constants/storage';
import type { MediaTrack } from '@/types/domain';

const mockSetEnabled = vi.fn();
const mockSetIntensity = vi.fn();
const mockSetRate = vi.fn();
const mockRestoreGlowSettings = vi.fn();

let mockEnabled = true;
let mockIntensity = 110;
let mockRate = 4.0;
let mockCurrentTrack: MediaTrack | null = null;

const memoryStorage = new Map<string, string>();

const installLocalStorageShim = () => {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => memoryStorage.set(key, value),
      removeItem: (key: string) => memoryStorage.delete(key),
      clear: () => memoryStorage.clear(),
      key: () => null,
      length: 0,
    },
    writable: true,
    configurable: true,
  });
};

vi.mock('@/contexts/visualEffects', async () => {
  const actual = await vi.importActual<typeof import('@/contexts/visualEffects')>(
    '@/contexts/visualEffects',
  );
  return {
    ...actual,
    useVisualEffectsToggle: vi.fn(() => ({
      visualEffectsEnabled: mockEnabled,
      setVisualEffectsEnabled: (next: boolean) => {
        mockEnabled = next;
        mockSetEnabled(next);
        memoryStorage.set(STORAGE_KEYS.VISUAL_EFFECTS_ENABLED, JSON.stringify(next));
      },
    })),
  };
});

vi.mock('@/hooks/useVisualEffectsState', () => ({
  useVisualEffectsState: vi.fn(() => ({
    glowIntensity: mockIntensity,
    glowRate: mockRate,
    handleGlowIntensityChange: (next: number) => {
      mockIntensity = next;
      mockSetIntensity(next);
      memoryStorage.set(STORAGE_KEYS.GLOW_INTENSITY, JSON.stringify(next));
    },
    handleGlowRateChange: (next: number) => {
      mockRate = next;
      mockSetRate(next);
      memoryStorage.set(STORAGE_KEYS.GLOW_RATE, JSON.stringify(next));
    },
    restoreGlowSettings: mockRestoreGlowSettings,
  })),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useCurrentTrackContext: vi.fn(() => ({
    currentTrack: mockCurrentTrack,
    currentTrackIndex: 0,
    setCurrentTrackIndex: vi.fn(),
    showQueue: false,
    setShowQueue: vi.fn(),
  })),
}));

import { GlowControls } from '../appearance/GlowControls';
import { GlowProvider } from '@/contexts/visualEffects';

const buildTrack = (overrides: Partial<MediaTrack> = {}): MediaTrack => ({
  id: 'track-1',
  name: 'Track One',
  artist: 'Artist',
  album: 'Album One',
  albumId: 'album-1',
  duration: 1000,
  uri: 'spotify:track:1',
  ...overrides,
});

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <GlowProvider>{children}</GlowProvider>
  </ThemeProvider>
);

describe('SettingsV2 GlowControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnabled = true;
    mockIntensity = 110;
    mockRate = 4.0;
    mockCurrentTrack = null;
    memoryStorage.clear();
    installLocalStorageShim();
  });

  it('writes VISUAL_EFFECTS_ENABLED when the toggle is flipped off', () => {
    // #given
    render(
      <Wrapper>
        <GlowControls />
      </Wrapper>,
    );

    // #when
    fireEvent.click(screen.getByLabelText('Toggle album-art glow'));

    // #then
    expect(mockSetEnabled).toHaveBeenCalledWith(false);
    expect(memoryStorage.get(STORAGE_KEYS.VISUAL_EFFECTS_ENABLED)).toBe('false');
  });

  it('restores glow settings when toggling back on', () => {
    // #given
    mockEnabled = false;
    render(
      <Wrapper>
        <GlowControls />
      </Wrapper>,
    );

    // #when
    fireEvent.click(screen.getByLabelText('Toggle album-art glow'));

    // #then
    expect(mockSetEnabled).toHaveBeenCalledWith(true);
    expect(mockRestoreGlowSettings).toHaveBeenCalledOnce();
  });

  it('writes the canonical glow intensity preset values (95/110/125)', () => {
    // #given
    render(
      <Wrapper>
        <GlowControls />
      </Wrapper>,
    );

    // #when
    const intensityGroup = screen.getByLabelText('Glow intensity');
    fireEvent.click(intensityGroup.querySelector('button:nth-of-type(1)')!);
    fireEvent.click(intensityGroup.querySelector('button:nth-of-type(3)')!);

    // #then
    expect(mockSetIntensity).toHaveBeenNthCalledWith(1, 95);
    expect(mockSetIntensity).toHaveBeenNthCalledWith(2, 125);
    expect(memoryStorage.get(STORAGE_KEYS.GLOW_INTENSITY)).toBe('125');
  });

  it('writes the canonical glow rate preset values (5.0/4.0/3.0)', () => {
    // #given
    render(
      <Wrapper>
        <GlowControls />
      </Wrapper>,
    );

    // #when
    const rateGroup = screen.getByLabelText('Glow rate');
    fireEvent.click(rateGroup.querySelector('button:nth-of-type(1)')!);
    fireEvent.click(rateGroup.querySelector('button:nth-of-type(3)')!);

    // #then
    expect(mockSetRate).toHaveBeenNthCalledWith(1, 5.0);
    expect(mockSetRate).toHaveBeenNthCalledWith(2, 3.0);
    expect(memoryStorage.get(STORAGE_KEYS.GLOW_RATE)).toBe('3');
  });

  it('hides intensity + rate sub-controls when glow is disabled', () => {
    // #given
    mockEnabled = false;

    // #when
    render(
      <Wrapper>
        <GlowControls />
      </Wrapper>,
    );

    // #then
    expect(screen.queryByText('Intensity')).not.toBeInTheDocument();
    expect(screen.queryByText('Rate')).not.toBeInTheDocument();
  });

  describe('per-album override sub-row', () => {
    it('does not render when visual effects are off but a track with albumId is playing', () => {
      // #given
      mockEnabled = false;
      mockCurrentTrack = buildTrack();

      // #when
      render(
        <Wrapper>
          <GlowControls />
        </Wrapper>,
      );

      // #then
      expect(screen.queryByTestId('album-override-row')).not.toBeInTheDocument();
    });

    it('does not render when visual effects are on but no current track is set', () => {
      // #given
      mockEnabled = true;
      mockCurrentTrack = null;

      // #when
      render(
        <Wrapper>
          <GlowControls />
        </Wrapper>,
      );

      // #then
      expect(screen.queryByTestId('album-override-row')).not.toBeInTheDocument();
    });

    it('does not render when visual effects are on but the current track has no albumId', () => {
      // #given
      mockEnabled = true;
      mockCurrentTrack = buildTrack({ albumId: undefined });

      // #when
      render(
        <Wrapper>
          <GlowControls />
        </Wrapper>,
      );

      // #then
      expect(screen.queryByTestId('album-override-row')).not.toBeInTheDocument();
    });

    it('highlights override presets (not the global preset) when an override exists for the album', () => {
      // #given
      mockCurrentTrack = buildTrack({ albumId: 'album-1' });
      memoryStorage.set(
        STORAGE_KEYS.PER_ALBUM_GLOW,
        JSON.stringify({ 'album-1': { intensity: 95, rate: 3.0 } }),
      );

      // #when
      render(
        <Wrapper>
          <GlowControls />
        </Wrapper>,
      );

      // #then
      const intensityGroup = screen.getByLabelText('Album glow intensity');
      const rateGroup = screen.getByLabelText('Album glow rate');
      expect(intensityGroup.querySelector('button:nth-of-type(1)')).toHaveTextContent('Less');
      expect(intensityGroup.querySelector('button:nth-of-type(1)')).toHaveStyle({
        background: 'hsl(var(--primary))',
      });
      expect(intensityGroup.querySelector('button:nth-of-type(2)')).not.toHaveStyle({
        background: 'hsl(var(--primary))',
      });
      expect(rateGroup.querySelector('button:nth-of-type(3)')).toHaveTextContent('Faster');
      expect(rateGroup.querySelector('button:nth-of-type(3)')).toHaveStyle({
        background: 'hsl(var(--primary))',
      });
    });

    it('falls through to the global preset highlight when no override exists for the album', () => {
      // #given
      mockCurrentTrack = buildTrack({ albumId: 'album-1' });
      mockIntensity = 125;
      mockRate = 5.0;

      // #when
      render(
        <Wrapper>
          <GlowControls />
        </Wrapper>,
      );

      // #then
      const intensityGroup = screen.getByLabelText('Album glow intensity');
      const rateGroup = screen.getByLabelText('Album glow rate');
      expect(intensityGroup.querySelector('button:nth-of-type(3)')).toHaveStyle({
        background: 'hsl(var(--primary))',
      });
      expect(rateGroup.querySelector('button:nth-of-type(1)')).toHaveStyle({
        background: 'hsl(var(--primary))',
      });
    });

    it('writes both intensity and rate to the albumId key when a preset is clicked', () => {
      // #given
      mockCurrentTrack = buildTrack({ albumId: 'album-1' });
      mockIntensity = 110;
      mockRate = 4.0;

      // #when
      render(
        <Wrapper>
          <GlowControls />
        </Wrapper>,
      );
      const intensityGroup = screen.getByLabelText('Album glow intensity');
      fireEvent.click(intensityGroup.querySelector('button:nth-of-type(1)')!);

      // #then
      const stored = JSON.parse(memoryStorage.get(STORAGE_KEYS.PER_ALBUM_GLOW) ?? '{}');
      expect(stored).toEqual({ 'album-1': { intensity: 95, rate: 4.0 } });
    });

    it('clears the albumId key when Reset is clicked', () => {
      // #given
      mockCurrentTrack = buildTrack({ albumId: 'album-1' });
      memoryStorage.set(
        STORAGE_KEYS.PER_ALBUM_GLOW,
        JSON.stringify({ 'album-1': { intensity: 95, rate: 3.0 }, 'album-2': { intensity: 125, rate: 5.0 } }),
      );

      // #when
      render(
        <Wrapper>
          <GlowControls />
        </Wrapper>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Reset album glow override' }));

      // #then
      const stored = JSON.parse(memoryStorage.get(STORAGE_KEYS.PER_ALBUM_GLOW) ?? '{}');
      expect(stored).toEqual({ 'album-2': { intensity: 125, rate: 5.0 } });
    });

    it('disables Reset when no override exists for the current album', () => {
      // #given
      mockCurrentTrack = buildTrack({ albumId: 'album-1' });

      // #when
      render(
        <Wrapper>
          <GlowControls />
        </Wrapper>,
      );

      // #then
      expect(screen.getByRole('button', { name: 'Reset album glow override' })).toBeDisabled();
    });

    it('renders the album name as the override label when present', () => {
      // #given
      mockCurrentTrack = buildTrack({ album: 'Kid A' });

      // #when
      render(
        <Wrapper>
          <GlowControls />
        </Wrapper>,
      );

      // #then
      expect(screen.getByTestId('album-override-row')).toHaveTextContent('Kid A');
      expect(screen.queryByText('This album')).not.toBeInTheDocument();
    });

    it('falls back to "This album" when the track has an empty album string', () => {
      // #given
      mockCurrentTrack = buildTrack({ album: '' });

      // #when
      render(
        <Wrapper>
          <GlowControls />
        </Wrapper>,
      );

      // #then
      expect(screen.getByTestId('album-override-row')).toHaveTextContent('This album');
    });
  });
});
