import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import { STORAGE_KEYS } from '@/constants/storage';
import {
  AccentColorBackgroundProvider,
  VisualEffectsToggleProvider,
  useVisualEffectsToggle,
} from '@/contexts/visualEffects';

import { AccentColorBackgroundToggle } from '../appearance/AccentColorBackgroundToggle';

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

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <VisualEffectsToggleProvider>
      <AccentColorBackgroundProvider>{children}</AccentColorBackgroundProvider>
    </VisualEffectsToggleProvider>
  </ThemeProvider>
);

const MasterToggleProbe: React.FC = () => {
  const { setVisualEffectsEnabled } = useVisualEffectsToggle();
  return (
    <button type="button" onClick={() => setVisualEffectsEnabled(false)}>
      disable-master
    </button>
  );
};

describe('SettingsV2 AccentColorBackgroundToggle', () => {
  beforeEach(() => {
    memoryStorage.clear();
    installLocalStorageShim();
  });

  it('renders the labeled switch with help text', () => {
    // #given + #when
    render(
      <Wrapper>
        <AccentColorBackgroundToggle />
      </Wrapper>,
    );

    // #then
    expect(screen.getByText('Background gradient')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle accent-color background')).toBeInTheDocument();
    expect(
      screen.getByText('Tint the page background with the current accent color. Visible when album-art glow is on.'),
    ).toBeInTheDocument();
  });

  it('reflects the default ACCENT_COLOR_BG_PREFERRED = false in the switch state', () => {
    // #given + #when
    render(
      <Wrapper>
        <AccentColorBackgroundToggle />
      </Wrapper>,
    );

    // #then
    expect(screen.getByLabelText('Toggle accent-color background')).toHaveAttribute('data-state', 'unchecked');
  });

  it('persists ACCENT_COLOR_BG_PREFERRED when toggled on', () => {
    // #given
    render(
      <Wrapper>
        <AccentColorBackgroundToggle />
      </Wrapper>,
    );

    // #when
    fireEvent.click(screen.getByLabelText('Toggle accent-color background'));

    // #then
    expect(memoryStorage.get(STORAGE_KEYS.ACCENT_COLOR_BG_PREFERRED)).toBe('true');
  });

  it('stays toggleable when visualEffectsEnabled is false', () => {
    // #given
    render(
      <Wrapper>
        <AccentColorBackgroundToggle />
        <MasterToggleProbe />
      </Wrapper>,
    );

    // #when — flip the master off
    fireEvent.click(screen.getByText('disable-master'));

    // #then — the preference toggle is still enabled and writable
    const toggle = screen.getByLabelText('Toggle accent-color background');
    expect(toggle).not.toBeDisabled();

    fireEvent.click(toggle);
    expect(memoryStorage.get(STORAGE_KEYS.ACCENT_COLOR_BG_PREFERRED)).toBe('true');
  });
});
