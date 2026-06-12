import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import type { MediaTrack } from '@/types/domain';

vi.mock('@/utils/colorExtractor', () => ({
  extractTopVibrantColors: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/components/EyedropperOverlay', () => ({
  default: () => null,
}));

import QuickEffectsRow from '../QuickEffectsRow';

const baseProps = {
  currentTrack: { albumId: 'album-1', image: undefined } as unknown as MediaTrack,
  accentColor: '#abcdef',
  onAccentColorChange: vi.fn(),
  customAccentColorOverrides: {},
  onCustomAccentColor: vi.fn(),
  glowEnabled: true,
  onGlowToggle: vi.fn(),
  glowIntensity: 110,
  onGlowIntensityChange: vi.fn(),
  glowRate: 4.0,
  onGlowRateChange: vi.fn(),
  backgroundVisualizerEnabled: true,
  onBackgroundVisualizerToggle: vi.fn(),
  backgroundVisualizerStyle: 'fireflies' as const,
  onBackgroundVisualizerStyleChange: vi.fn(),
  backgroundVisualizerIntensity: 40,
  onBackgroundVisualizerIntensityChange: vi.fn(),
  backgroundVisualizerSpeed: 0.7,
  onBackgroundVisualizerSpeedChange: vi.fn(),
  translucenceEnabled: false,
  onTranslucenceToggle: vi.fn(),
  isMobile: false,
  isTablet: false,
};

const renderRow = (overrides: Partial<typeof baseProps> = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <QuickEffectsRow {...baseProps} {...overrides} />
    </ThemeProvider>,
  );

describe('QuickEffectsRow ToggleGroup wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the accent toggle groups with the active item selected', () => {
    // #given — glow + visualizer enabled so all sub-setting groups mount
    // #when
    renderRow();

    // #then — the value matching current props is marked active (data-state="on")
    const fireflies = screen.getByRole('radio', { name: 'Fireflies' });
    expect(fireflies).toHaveAttribute('data-state', 'on');
    expect(fireflies.className).toContain('data-[state=on]:bg-[var(--accent-color)]');
    expect(screen.getByRole('radio', { name: 'Comet' })).toHaveAttribute('data-state', 'off');
  });

  it('invokes the style change callback with the typed visualizer style on click', async () => {
    // #given
    const user = userEvent.setup();
    renderRow();

    // #when
    await user.click(screen.getByRole('radio', { name: 'Wave' }));

    // #then
    expect(baseProps.onBackgroundVisualizerStyleChange).toHaveBeenCalledWith('wave');
  });

  it('invokes the numeric glow intensity callback parsed back from the string value', async () => {
    // #given — visualizer off so "More" is unambiguously the glow-intensity pill
    const user = userEvent.setup();
    renderRow({ backgroundVisualizerEnabled: false });

    // #when
    await user.click(screen.getByRole('radio', { name: 'More' }));

    // #then — "125" parses back to the numeric option value
    expect(baseProps.onGlowIntensityChange).toHaveBeenCalledWith(125);
  });

  it('omits sub-setting toggle groups when glow + visualizer are disabled', () => {
    // #given
    // #when
    renderRow({ glowEnabled: false, backgroundVisualizerEnabled: false });

    // #then — no Fireflies/More pills mount
    expect(screen.queryByRole('radio', { name: 'Fireflies' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'More' })).toBeNull();
  });
});
