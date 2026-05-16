import React from 'react';
import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import type { MediaTrack } from '@/types/domain';

const optionButtonRenders: Array<Record<string, unknown>> = [];

vi.mock('@/components/AppSettingsMenu/styled', async () => {
  const actual = await vi.importActual<typeof import('@/components/AppSettingsMenu/styled')>(
    '@/components/AppSettingsMenu/styled',
  );
  return {
    ...actual,
    OptionButton: (props: Record<string, unknown>) => {
      optionButtonRenders.push(props);
      const { children, $isActive: _$isActive, $variant: _$variant, ...rest } = props as {
        children?: React.ReactNode;
        $isActive?: boolean;
        $variant?: string;
      } & Record<string, unknown>;
      return <button {...rest}>{children}</button>;
    },
  };
});

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

describe('QuickEffectsRow OptionButton variant wiring', () => {
  beforeEach(() => {
    optionButtonRenders.length = 0;
    vi.clearAllMocks();
  });

  it('renders every OptionButton with $variant="accent"', () => {
    // #given — Glow + Visualizer both enabled so all sub-setting pills mount
    // #when
    render(
      <ThemeProvider theme={theme}>
        <QuickEffectsRow {...baseProps} />
      </ThemeProvider>,
    );

    // #then — every rendered pill carries the accent variant. React 18 StrictMode
    // can double-invoke the render, so we assert against the full set instead of a
    // fixed count: at least the 16 expected pills (3 glow intensity + 3 glow rate +
    // 4 viz style + 3 viz intensity + 3 viz speed) must be present.
    expect(optionButtonRenders.length).toBeGreaterThanOrEqual(16);
    for (const props of optionButtonRenders) {
      expect(props.$variant).toBe('accent');
    }
  });

  it('omits sub-setting pills (and so OptionButtons) when glow + visualizer are disabled', () => {
    // #given
    // #when
    render(
      <ThemeProvider theme={theme}>
        <QuickEffectsRow
          {...baseProps}
          glowEnabled={false}
          backgroundVisualizerEnabled={false}
        />
      </ThemeProvider>,
    );

    // #then
    expect(optionButtonRenders).toHaveLength(0);
  });
});
