import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import { STORAGE_KEYS } from '@/constants/storage';

const mockSetEnabled = vi.fn();
const mockSetIntensity = vi.fn();
const mockSetRate = vi.fn();
const mockRestoreGlowSettings = vi.fn();

let mockEnabled = true;
let mockIntensity = 110;
let mockRate = 4.0;

const memoryStorage = new Map<string, string>();

vi.mock('@/contexts/visualEffects', () => ({
  useVisualEffectsToggle: vi.fn(() => ({
    visualEffectsEnabled: mockEnabled,
    setVisualEffectsEnabled: (next: boolean) => {
      mockEnabled = next;
      mockSetEnabled(next);
      memoryStorage.set(STORAGE_KEYS.VISUAL_EFFECTS_ENABLED, JSON.stringify(next));
    },
  })),
}));

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

import { GlowControls } from '../appearance/GlowControls';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('SettingsV2 GlowControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnabled = true;
    mockIntensity = 110;
    mockRate = 4.0;
    memoryStorage.clear();
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
});
