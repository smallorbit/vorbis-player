import { render, screen, fireEvent } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import TimelineSlider from '../TimelineSlider';

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: () => ({ isMobile: false, isTablet: false }),
}));

beforeAll(() => {
  // Radix Slider's useSize uses ResizeObserver, which jsdom does not implement.
  // A no-op stub is enough for keyboard interaction tests.
  if (typeof window.ResizeObserver === 'undefined') {
    window.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }
});

function renderSlider(overrides?: Partial<{
  currentPosition: number;
  duration: number;
  onSeek: (position: number) => void;
  onScrubStart: () => void;
  onScrubEnd: (position: number) => void;
}>) {
  const props = {
    currentPosition: 30_000,
    duration: 180_000,
    formatTime: (ms: number) => `${Math.floor(ms / 1000)}s`,
    onSeek: vi.fn(),
    onScrubStart: vi.fn(),
    onScrubEnd: vi.fn(),
    ...overrides,
  };
  const result = render(
    <ThemeProvider theme={theme}>
      <TimelineSlider {...props} />
    </ThemeProvider>,
  );
  return { ...result, props };
}

describe('TimelineSlider', () => {
  it('fires onScrubStart + onSeek + onScrubEnd when ArrowRight nudges the thumb', () => {
    // #given
    const onSeek = vi.fn();
    const onScrubStart = vi.fn();
    const onScrubEnd = vi.fn();
    renderSlider({ onSeek, onScrubStart, onScrubEnd });
    const thumb = screen.getByRole('slider');

    // #when — Radix Slider Arrow nudge: onValueChange and onValueCommit fire
    // together in a single tick, so the wrapper collapses scrub start + seek
    // + scrub end into one immediate-seek sequence.
    thumb.focus();
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });

    // #then
    expect(onScrubStart).toHaveBeenCalledOnce();
    expect(onSeek).toHaveBeenCalledOnce();
    expect(onScrubEnd).toHaveBeenCalledOnce();

    // The bumped position is one step (1ms) above the starting 30_000ms.
    const seekedTo = onSeek.mock.calls[0][0] as number;
    const committedAt = onScrubEnd.mock.calls[0][0] as number;
    expect(seekedTo).toBeGreaterThan(30_000);
    expect(committedAt).toBe(seekedTo);
  });

  it('does not exceed the duration ceiling when ArrowRight is held at the end', () => {
    // #given
    const onSeek = vi.fn();
    renderSlider({ currentPosition: 180_000, duration: 180_000, onSeek });
    const thumb = screen.getByRole('slider');

    // #when
    thumb.focus();
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });

    // #then — Radix clamps to max; if onSeek fires it must not exceed duration
    if (onSeek.mock.calls.length > 0) {
      expect(onSeek.mock.calls[0][0]).toBeLessThanOrEqual(180_000);
    }
  });
});
