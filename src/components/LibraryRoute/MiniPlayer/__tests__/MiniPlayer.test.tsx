import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import type { MediaTrack } from '@/types/domain';

const { mockCurrentTrack } = vi.hoisted(() => ({
  mockCurrentTrack: vi.fn<[], { currentTrack: MediaTrack | null }>(),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useCurrentTrackContext: () => mockCurrentTrack(),
}));

import MiniPlayer, { type MiniPlayerProps } from '../MiniPlayer';

function makeTrack(overrides: Partial<MediaTrack> = {}): MediaTrack {
  return {
    id: 't1',
    name: 'Test Song',
    artists: 'Test Artist',
    duration_ms: 1000,
    image: 'https://example.com/art.png',
    provider: 'spotify',
    uri: 'spotify:track:t1',
    ...overrides,
  } as MediaTrack;
}

function renderMP(propsOverrides: Partial<MiniPlayerProps> = {}) {
  const props: MiniPlayerProps = {
    isPlaying: false,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onExpand: vi.fn(),
    ...propsOverrides,
  };
  const result = render(
    <ThemeProvider theme={theme}>
      <MiniPlayer {...props} />
    </ThemeProvider>,
  );
  return { ...result, props };
}

describe('MiniPlayer', () => {
  beforeEach(() => {
    mockCurrentTrack.mockReset();
  });

  it('renders nothing when currentTrack is null', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: null });

    // #when
    renderMP();

    // #then
    expect(screen.queryByTestId('library-mini-player')).toBeNull();
  });

  it('renders track name and artist', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });

    // #when
    renderMP();

    // #then
    expect(screen.getByText('Test Song')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
  });

  it('shows pause icon and Pause label when isPlaying', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });

    // #when
    renderMP({ isPlaying: true });

    // #then
    expect(screen.getByLabelText('Pause')).toBeInTheDocument();
  });

  it('shows play label when not playing', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });

    // #when
    renderMP({ isPlaying: false });

    // #then
    expect(screen.getByLabelText('Play')).toBeInTheDocument();
  });

  it('fires onPause when play-pause clicked while playing', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });
    const onPause = vi.fn();
    const onPlay = vi.fn();

    // #when
    renderMP({ isPlaying: true, onPause, onPlay });
    fireEvent.click(screen.getByTestId('mini-play-pause'));

    // #then
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('fires onPlay when play-pause clicked while paused', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });
    const onPause = vi.fn();
    const onPlay = vi.fn();

    // #when
    renderMP({ isPlaying: false, onPause, onPlay });
    fireEvent.click(screen.getByTestId('mini-play-pause'));

    // #then
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPause).not.toHaveBeenCalled();
  });

  it('fires onNext / onPrevious from their buttons', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });
    const onNext = vi.fn();
    const onPrevious = vi.fn();

    // #when
    renderMP({ onNext, onPrevious });
    fireEvent.click(screen.getByTestId('mini-next'));
    fireEvent.click(screen.getByTestId('mini-prev'));

    // #then
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it('fires onExpand when art / title region clicked', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });
    const onExpand = vi.fn();

    // #when
    renderMP({ onExpand });
    fireEvent.click(screen.getByTestId('mini-expand'));

    // #then
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onExpand when control buttons clicked (stopPropagation)', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });
    const onExpand = vi.fn();

    // #when
    renderMP({ onExpand });
    fireEvent.click(screen.getByTestId('mini-play-pause'));
    fireEvent.click(screen.getByTestId('mini-next'));
    fireEvent.click(screen.getByTestId('mini-prev'));

    // #then
    expect(onExpand).not.toHaveBeenCalled();
  });

  it('renders radio button only when isRadioAvailable && onStartRadio provided', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });

    // #when (no radio)
    const { rerender } = renderMP();

    // #then
    expect(screen.queryByTestId('mini-radio')).toBeNull();

    // #when (radio available + handler)
    rerender(
      <ThemeProvider theme={theme}>
        <MiniPlayer
          isPlaying={false}
          isRadioAvailable
          onPlay={() => {}}
          onPause={() => {}}
          onNext={() => {}}
          onPrevious={() => {}}
          onExpand={() => {}}
          onStartRadio={() => {}}
        />
      </ThemeProvider>,
    );

    // #then
    expect(screen.getByTestId('mini-radio')).toBeInTheDocument();
  });

  it('disables radio button while isRadioGenerating', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });
    const onStartRadio = vi.fn();

    // #when
    renderMP({ isRadioAvailable: true, isRadioGenerating: true, onStartRadio });
    const btn = screen.getByTestId('mini-radio') as HTMLButtonElement;

    // #then
    expect(btn.disabled).toBe(true);
  });

  it('fires onStartRadio when radio button clicked (not generating)', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });
    const onStartRadio = vi.fn();
    const onExpand = vi.fn();

    // #when
    renderMP({ isRadioAvailable: true, onStartRadio, onExpand });
    fireEvent.click(screen.getByTestId('mini-radio'));

    // #then
    expect(onStartRadio).toHaveBeenCalledTimes(1);
    expect(onExpand).not.toHaveBeenCalled();
  });

  it('marks pulse dot as playing when isPlaying', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });

    // #when
    renderMP({ isPlaying: true });

    // #then
    expect(screen.getByTestId('mini-pulse-dot').dataset.playing).toBe('true');
  });

  it('marks pulse dot as not playing when paused', () => {
    // #given
    mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });

    // #when
    renderMP({ isPlaying: false });

    // #then
    expect(screen.getByTestId('mini-pulse-dot').dataset.playing).toBe('false');
  });
});
