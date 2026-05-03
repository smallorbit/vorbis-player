import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';

// jsdom doesn't implement ResizeObserver; Radix Slider uses it via @radix-ui/react-use-size.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as { ResizeObserver?: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;

// ── Hook mocks ─────────────────────────────────────────────────────────────

const mockSetVolumeLevel = vi.fn();
const mockHandleShuffleToggle = vi.fn();

let mockVolume = 50;
let mockShuffleEnabled = false;
let mockOriginalTracks: Array<{ id: string }> = [];
let mockCurrentTrackProvider: string | undefined;

vi.mock('@/hooks/useVolume', () => ({
  useVolume: vi.fn(() => ({
    volume: mockVolume,
    isMuted: false,
    handleMuteToggle: vi.fn(),
    handleVolumeButtonClick: vi.fn(),
    setVolumeLevel: mockSetVolumeLevel,
  })),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useTrackListContext: vi.fn(() => ({
    shuffleEnabled: mockShuffleEnabled,
    handleShuffleToggle: mockHandleShuffleToggle,
    originalTracks: mockOriginalTracks,
  })),
  useCurrentTrackContext: vi.fn(() => ({
    currentTrack: mockCurrentTrackProvider
      ? { id: 't1', provider: mockCurrentTrackProvider }
      : null,
  })),
}));

import { PlaybackSection } from '../PlaybackSection';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('SettingsV2 PlaybackSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVolume = 50;
    mockShuffleEnabled = false;
    mockOriginalTracks = [];
    mockCurrentTrackProvider = undefined;
  });

  describe('Volume control', () => {
    it('renders the persisted volume value in the readout', () => {
      // #given
      mockVolume = 73;

      // #when
      render(
        <Wrapper>
          <PlaybackSection />
        </Wrapper>,
      );

      // #then — Radix Slider thumb carries aria-valuenow; the visible readout is what users see
      expect(screen.getByText('73%')).toBeInTheDocument();
      const thumb = document.querySelector('[role="slider"]');
      expect(thumb).toHaveAttribute('aria-valuenow', '73');
    });

    it('routes slider changes through useVolume().setVolumeLevel', () => {
      // #given
      render(
        <Wrapper>
          <PlaybackSection />
        </Wrapper>,
      );
      const thumb = document.querySelector('[role="slider"]') as HTMLElement;

      // #when — Radix slider responds to keyboard arrows
      thumb.focus();
      fireEvent.keyDown(thumb, { key: 'ArrowRight' });

      // #then
      expect(mockSetVolumeLevel).toHaveBeenCalled();
    });
  });

  describe('Shuffle toggle', () => {
    it('reflects the persisted shuffle state on mount', () => {
      // #given
      mockShuffleEnabled = true;
      mockOriginalTracks = [{ id: 't1' }];

      // #when
      render(
        <Wrapper>
          <PlaybackSection />
        </Wrapper>,
      );

      // #then
      expect(screen.getByLabelText('Toggle shuffle')).toHaveAttribute('data-state', 'checked');
    });

    it('routes through TrackContext.handleShuffleToggle when toggled', () => {
      // #given
      mockOriginalTracks = [{ id: 't1' }];

      // #when
      render(
        <Wrapper>
          <PlaybackSection />
        </Wrapper>,
      );
      fireEvent.click(screen.getByLabelText('Toggle shuffle'));

      // #then
      expect(mockHandleShuffleToggle).toHaveBeenCalledOnce();
    });

    it('disables the shuffle toggle when no playlist is loaded', () => {
      // #given — empty originalTracks means no queue to reorder
      mockOriginalTracks = [];

      // #when
      render(
        <Wrapper>
          <PlaybackSection />
        </Wrapper>,
      );

      // #then
      const toggle = screen.getByLabelText('Toggle shuffle');
      expect(toggle).toBeDisabled();
      expect(screen.getByText(/Load a playlist or album to enable shuffle/i)).toBeInTheDocument();
    });

    it('shows the active-queue help copy when a playlist is loaded', () => {
      // #given
      mockOriginalTracks = [{ id: 't1' }];

      // #when
      render(
        <Wrapper>
          <PlaybackSection />
        </Wrapper>,
      );

      // #then
      expect(
        screen.getByText(/Reorder the current queue and remember the preference/i),
      ).toBeInTheDocument();
    });
  });
});
