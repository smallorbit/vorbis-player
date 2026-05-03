import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import type { MediaTrack } from '@/types/domain';

const mockSetAccentColor = vi.fn();
const mockHandleSetAccentColorOverride = vi.fn();
const mockHandleRemoveAccentColorOverride = vi.fn();
const mockHandleResetAccentColorOverride = vi.fn();
const mockHandleSetCustomAccentColor = vi.fn();
const mockHandleRemoveCustomAccentColor = vi.fn();

let mockAccentColor = '#ff0000';
let mockCustomAccentColors: Record<string, string> = {};
let mockCurrentTrack: MediaTrack | null = {
  id: 't1',
  provider: 'spotify',
  playbackRef: { provider: 'spotify', ref: 'spotify:track:t1' },
  name: 'Test Track',
  artists: 'Test Artist',
  album: 'Test Album',
  albumId: 'album-123',
  durationMs: 1000,
  image: 'https://example.com/image.jpg',
};

vi.mock('@/contexts/ColorContext', () => ({
  useColorContext: vi.fn(() => ({
    accentColor: mockAccentColor,
    accentColorOverrides: {},
    customAccentColors: mockCustomAccentColors,
    setAccentColor: mockSetAccentColor,
    setAccentColorOverrides: vi.fn(),
    handleSetAccentColorOverride: mockHandleSetAccentColorOverride,
    handleRemoveAccentColorOverride: mockHandleRemoveAccentColorOverride,
    handleResetAccentColorOverride: mockHandleResetAccentColorOverride,
    handleSetCustomAccentColor: mockHandleSetCustomAccentColor,
    handleRemoveCustomAccentColor: mockHandleRemoveCustomAccentColor,
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

vi.mock('@/utils/colorExtractor', () => ({
  extractTopVibrantColors: vi.fn(async () => [
    { hex: '#ff0000', score: 1 },
    { hex: '#00ff00', score: 0.9 },
  ]),
}));

vi.mock('@/components/EyedropperOverlay', () => ({
  default: ({ onPick, onClose }: { onPick: (color: string) => void; onClose: () => void }) => (
    <div data-testid="eyedropper-overlay">
      <button data-testid="eyedropper-pick" onClick={() => onPick('#abcdef')}>
        Pick
      </button>
      <button data-testid="eyedropper-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

import { AccentColorManager } from '../appearance/AccentColorManager';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('SettingsV2 AccentColorManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccentColor = '#ff0000';
    mockCustomAccentColors = {};
    mockCurrentTrack = {
      id: 't1',
      provider: 'spotify',
      playbackRef: { provider: 'spotify', ref: 'spotify:track:t1' },
      name: 'Test Track',
      artists: 'Test Artist',
      album: 'Test Album',
      albumId: 'album-123',
      durationMs: 1000,
      image: 'https://example.com/image.jpg',
    };
  });

  describe('palette swatch selection', () => {
    it('writes ACCENT_COLOR_OVERRIDES only (not CUSTOM_ACCENT_COLORS) when a palette swatch is clicked', async () => {
      // #given
      render(
        <Wrapper>
          <AccentColorManager />
        </Wrapper>,
      );
      await waitFor(() => screen.getByLabelText('Choose color #ff0000'));

      // #when
      fireEvent.click(screen.getByLabelText('Choose color #00ff00'));

      // #then — palette clicks single-write to ACCENT_COLOR_OVERRIDES so the
      // eyedropper-picked custom swatch is preserved (matches legacy rule).
      expect(mockHandleSetAccentColorOverride).toHaveBeenCalledWith('album-123', '#00ff00');
      expect(mockHandleSetCustomAccentColor).not.toHaveBeenCalled();
      expect(mockSetAccentColor).toHaveBeenCalledWith('#00ff00');
    });
  });

  describe('eyedropper pick (dual-key write contract)', () => {
    it('writes BOTH ACCENT_COLOR_OVERRIDES AND CUSTOM_ACCENT_COLORS when the eyedropper picks a color', async () => {
      // #given
      render(
        <Wrapper>
          <AccentColorManager />
        </Wrapper>,
      );
      fireEvent.click(screen.getByLabelText('Pick color from album art'));
      await waitFor(() => screen.getByTestId('eyedropper-overlay'));

      // #when
      fireEvent.click(screen.getByTestId('eyedropper-pick'));

      // #then — dual-key write contract verbatim from
      // PlayerContent/AlbumArtSection.handleCustomAccentColor
      expect(mockHandleSetAccentColorOverride).toHaveBeenCalledWith('album-123', '#abcdef');
      expect(mockHandleSetCustomAccentColor).toHaveBeenCalledWith('album-123', '#abcdef');
      expect(mockSetAccentColor).toHaveBeenCalledWith('#abcdef');
    });

    it('renders the custom-accent swatch when one is stored', async () => {
      // #given
      mockCustomAccentColors = { 'album-123': '#deadbe' };

      // #when
      render(
        <Wrapper>
          <AccentColorManager />
        </Wrapper>,
      );

      // #then
      expect(screen.getByLabelText('Use custom color')).toBeInTheDocument();
    });
  });

  describe('reset (RESET_TO_DEFAULT sentinel)', () => {
    it('clears BOTH ACCENT_COLOR_OVERRIDES AND CUSTOM_ACCENT_COLORS when Reset is clicked', () => {
      // #given
      render(
        <Wrapper>
          <AccentColorManager />
        </Wrapper>,
      );

      // #when
      fireEvent.click(screen.getByRole('button', { name: 'Reset accent color to default' }));

      // #then — mirrors QuickEffectsRow's reset:
      //   onCustomAccentColor('') → removes BOTH keys
      //   onAccentColorChange('RESET_TO_DEFAULT') → handleResetAccentColorOverride
      expect(mockHandleRemoveAccentColorOverride).toHaveBeenCalledWith('album-123');
      expect(mockHandleRemoveCustomAccentColor).toHaveBeenCalledWith('album-123');
      expect(mockHandleResetAccentColorOverride).toHaveBeenCalledWith('album-123');
    });
  });

  describe('no-track guard', () => {
    it('does not call any setter when no track is playing and a swatch action is attempted', async () => {
      // #given
      mockCurrentTrack = null;

      // #when
      render(
        <Wrapper>
          <AccentColorManager />
        </Wrapper>,
      );

      // #then — Reset button is disabled, eyedropper button is disabled,
      // and no palette swatches render (no album art to extract from).
      expect(screen.getByRole('button', { name: 'Reset accent color to default' })).toBeDisabled();
      expect(screen.getByLabelText('Pick color from album art')).toBeDisabled();
    });

    it('does not write keys when albumId is missing', () => {
      // #given
      mockCurrentTrack = { ...mockCurrentTrack!, albumId: undefined };

      // #when
      render(
        <Wrapper>
          <AccentColorManager />
        </Wrapper>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Reset accent color to default' }));

      // #then
      expect(mockHandleRemoveAccentColorOverride).not.toHaveBeenCalled();
      expect(mockHandleRemoveCustomAccentColor).not.toHaveBeenCalled();
      expect(mockHandleResetAccentColorOverride).not.toHaveBeenCalled();
    });
  });
});
