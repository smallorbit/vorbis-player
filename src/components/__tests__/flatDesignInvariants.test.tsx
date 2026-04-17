/**
 * Regression tests for the flat-design migration (epic #1040, issue #1038).
 *
 * Asserts that surfaces explicitly preserved by the flat-design rules in
 * CLAUDE.md retain a non-zero border-radius after the sweep:
 *
 *   - `AlbumArt` uses theme.borderRadius.xl
 *   - `Switch` track uses theme.borderRadius.full (pill)
 *   - `Switch` knob stays circular (border-radius: 50%)
 */

import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import Switch from '@/components/controls/Switch';
import AlbumArt from '@/components/AlbumArt';
import { makeTrack } from '@/test/fixtures';

vi.mock('@/contexts/PlayerSizingContext', () => ({
  PlayerSizingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePlayerSizingContext: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    hasPointerInput: true,
    viewport: { width: 1024, height: 768, ratio: 1024 / 768 },
    dimensions: { width: 600, height: 600 },
  })),
}));

vi.mock('@/hooks/useImageProcessingWorker', () => ({
  useImageProcessingWorker: () => ({
    processImage: vi.fn(() => new Promise(() => {})),
  }),
}));

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('flat-design preserved surfaces', () => {
  it('AlbumArt container retains the xl border-radius', () => {
    // #given
    const track = makeTrack();

    // #when
    const { container } = renderWithTheme(<AlbumArt currentTrack={track} />);
    const albumArt = container.firstElementChild as HTMLElement;

    // #then
    expect(albumArt).toBeTruthy();
    const computedRadius = window.getComputedStyle(albumArt).borderRadius;
    expect(computedRadius).not.toBe('0px');
    expect(computedRadius).not.toBe('');
    expect(computedRadius).toBe(theme.borderRadius.xl);
  });

  it('Switch track keeps its pill shape via borderRadius.full', () => {
    // #when
    const { getByRole } = renderWithTheme(
      <Switch on={false} onToggle={() => {}} ariaLabel="test" />,
    );
    const track = getByRole('switch');

    // #then
    const computedRadius = window.getComputedStyle(track).borderRadius;
    expect(computedRadius).not.toBe('0px');
    expect(computedRadius).toBe(theme.borderRadius.full);
  });

  it('Switch knob stays circular', () => {
    // #when
    const { getByRole } = renderWithTheme(
      <Switch on={false} onToggle={() => {}} ariaLabel="test" />,
    );
    const knob = getByRole('switch').firstElementChild as HTMLElement;

    // #then
    expect(knob).toBeTruthy();
    const computedRadius = window.getComputedStyle(knob).borderRadius;
    expect(computedRadius).toBe('50%');
  });
});
