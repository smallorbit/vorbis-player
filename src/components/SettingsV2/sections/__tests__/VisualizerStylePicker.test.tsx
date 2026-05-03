import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import { STORAGE_KEYS } from '@/constants/storage';
import type { VisualizerStyle } from '@/types/visualizer';

const mockSetStyle = vi.fn();
const mockSetEnabled = vi.fn();
const mockSetIntensity = vi.fn();
const mockSetSpeed = vi.fn();

let mockEnabled = true;
let mockStyle: VisualizerStyle = 'fireflies';
let mockIntensity = 40;
let mockSpeed = 0.7;

const memoryStorage = new Map<string, string>();

vi.mock('@/contexts/visualEffects', () => ({
  useVisualizer: vi.fn(() => ({
    backgroundVisualizerEnabled: mockEnabled,
    setBackgroundVisualizerEnabled: (next: boolean) => {
      mockEnabled = next;
      mockSetEnabled(next);
      memoryStorage.set(STORAGE_KEYS.BG_VISUALIZER_ENABLED, JSON.stringify(next));
    },
    backgroundVisualizerStyle: mockStyle,
    setBackgroundVisualizerStyle: (next: VisualizerStyle) => {
      mockStyle = next;
      mockSetStyle(next);
      memoryStorage.set(STORAGE_KEYS.BG_VISUALIZER_STYLE, JSON.stringify(next));
    },
    backgroundVisualizerIntensity: mockIntensity,
    setBackgroundVisualizerIntensity: (next: number) => {
      mockIntensity = next;
      mockSetIntensity(next);
      memoryStorage.set(STORAGE_KEYS.BG_VISUALIZER_INTENSITY, JSON.stringify(next));
    },
    backgroundVisualizerSpeed: mockSpeed,
    setBackgroundVisualizerSpeed: (next: number) => {
      mockSpeed = next;
      mockSetSpeed(next);
      memoryStorage.set(STORAGE_KEYS.BG_VISUALIZER_SPEED, JSON.stringify(next));
    },
  })),
}));

import { VisualizerStylePicker } from '../appearance/VisualizerStylePicker';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('SettingsV2 VisualizerStylePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnabled = true;
    mockStyle = 'fireflies';
    mockIntensity = 40;
    mockSpeed = 0.7;
    memoryStorage.clear();
  });

  it('writes BG_VISUALIZER_STYLE when a style button is clicked', () => {
    // #given
    render(
      <Wrapper>
        <VisualizerStylePicker />
      </Wrapper>,
    );

    // #when
    fireEvent.click(screen.getByText('Comet'));

    // #then
    expect(mockSetStyle).toHaveBeenCalledWith('comet');
    expect(memoryStorage.get(STORAGE_KEYS.BG_VISUALIZER_STYLE)).toBe('"comet"');
  });

  it('writes BG_VISUALIZER_ENABLED when the toggle is flipped off', () => {
    // #given
    render(
      <Wrapper>
        <VisualizerStylePicker />
      </Wrapper>,
    );

    // #when
    fireEvent.click(screen.getByLabelText('Toggle background visualizer'));

    // #then
    expect(mockSetEnabled).toHaveBeenCalledWith(false);
    expect(memoryStorage.get(STORAGE_KEYS.BG_VISUALIZER_ENABLED)).toBe('false');
  });

  it('hides style + intensity + speed sub-controls when disabled', () => {
    // #given
    mockEnabled = false;

    // #when
    render(
      <Wrapper>
        <VisualizerStylePicker />
      </Wrapper>,
    );

    // #then — none of the sub-control labels render
    expect(screen.queryByText('Style')).not.toBeInTheDocument();
    expect(screen.queryByText('Intensity')).not.toBeInTheDocument();
    expect(screen.queryByText('Speed')).not.toBeInTheDocument();
  });

  it('writes the canonical intensity preset values (20/40/60)', () => {
    // #given
    render(
      <Wrapper>
        <VisualizerStylePicker />
      </Wrapper>,
    );

    // #when
    const intensityGroup = screen.getByLabelText('Visualizer intensity');
    fireEvent.click(intensityGroup.querySelector('button:nth-of-type(1)')!);
    fireEvent.click(intensityGroup.querySelector('button:nth-of-type(3)')!);

    // #then
    expect(mockSetIntensity).toHaveBeenNthCalledWith(1, 20);
    expect(mockSetIntensity).toHaveBeenNthCalledWith(2, 60);
    expect(memoryStorage.get(STORAGE_KEYS.BG_VISUALIZER_INTENSITY)).toBe('60');
  });

  it('writes the canonical speed preset values (0.5/0.7/1.2)', () => {
    // #given
    render(
      <Wrapper>
        <VisualizerStylePicker />
      </Wrapper>,
    );

    // #when
    const speedGroup = screen.getByLabelText('Visualizer speed');
    fireEvent.click(speedGroup.querySelector('button:nth-of-type(3)')!);

    // #then
    expect(mockSetSpeed).toHaveBeenCalledWith(1.2);
    expect(memoryStorage.get(STORAGE_KEYS.BG_VISUALIZER_SPEED)).toBe('1.2');
  });

  it('marks the active style button via aria-checked', () => {
    // #given
    mockStyle = 'wave';

    // #when
    render(
      <Wrapper>
        <VisualizerStylePicker />
      </Wrapper>,
    );

    // #then
    expect(screen.getByText('Wave')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Fireflies')).toHaveAttribute('aria-checked', 'false');
  });
});
