import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import { STORAGE_KEYS } from '@/constants/storage';

// In-memory localStorage shim — setup.ts replaces window.localStorage with
// vi.fn() returning undefined, which prevents any `useLocalStorage`-backed
// context from observing writes. This shim lets v1 and v2 surfaces share
// real persistence within a single test.
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

vi.mock('@/contexts/ColorContext', () => ({
  useColorContext: vi.fn(() => ({
    accentColor: '#ff0000',
    accentColorOverrides: {},
    customAccentColors: {},
    setAccentColor: vi.fn(),
    setAccentColorOverrides: vi.fn(),
    handleSetAccentColorOverride: vi.fn(),
    handleRemoveAccentColorOverride: vi.fn(),
    handleResetAccentColorOverride: vi.fn(),
    handleSetCustomAccentColor: vi.fn(),
    handleRemoveCustomAccentColor: vi.fn(),
  })),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useCurrentTrackContext: vi.fn(() => ({
    currentTrack: null,
    currentTrackIndex: 0,
    setCurrentTrackIndex: vi.fn(),
    showQueue: false,
    setShowQueue: vi.fn(),
  })),
}));

vi.mock('@/utils/colorExtractor', () => ({
  extractTopVibrantColors: vi.fn(async () => []),
}));

vi.mock('@/components/EyedropperOverlay', () => ({
  default: () => null,
}));

vi.mock('@/providers/dropbox/dropboxPreferencesSync', () => ({
  getPreferencesSync: () => null,
}));

import { AppearanceSection } from '../AppearanceSection';
import { VisualizerProvider, VisualEffectsToggleProvider, TranslucenceProvider } from '@/contexts/visualEffects';
import { useVisualizer, useTranslucence, useVisualEffectsToggle } from '@/contexts/visualEffects';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <VisualEffectsToggleProvider>
      <VisualizerProvider>
        <TranslucenceProvider>{children}</TranslucenceProvider>
      </VisualizerProvider>
    </VisualEffectsToggleProvider>
  </ThemeProvider>
);

describe('SettingsV2 AppearanceSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryStorage.clear();
    installLocalStorageShim();
  });

  it('renders all four control groups', () => {
    // #given + #when
    render(
      <Wrapper>
        <AppearanceSection />
      </Wrapper>,
    );

    // #then
    expect(screen.getByText('Accent Color')).toBeInTheDocument();
    expect(screen.getByText('Glow')).toBeInTheDocument();
    expect(screen.getByText('Visualizer')).toBeInTheDocument();
    expect(screen.getByText('Translucence')).toBeInTheDocument();
  });

  it('writes TRANSLUCENCE_ENABLED only (no opacity slider) when toggled', () => {
    // #given
    render(
      <Wrapper>
        <AppearanceSection />
      </Wrapper>,
    );

    // #when — translucence default is `true`, click toggles to `false`
    fireEvent.click(screen.getByLabelText('Toggle translucence'));

    // #then — single key is written; TRANSLUCENCE_OPACITY is untouched (deferred to #1463)
    expect(memoryStorage.get(STORAGE_KEYS.TRANSLUCENCE_ENABLED)).toBe('false');
    expect(memoryStorage.has(STORAGE_KEYS.TRANSLUCENCE_OPACITY)).toBe(false);
  });

  it('does not render an opacity slider for translucence', () => {
    // #given + #when
    render(
      <Wrapper>
        <AppearanceSection />
      </Wrapper>,
    );

    // #then — TranslucenceToggle is on/off only per stage 2 scope
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByText(/opacity/i)).not.toBeInTheDocument();
  });

  describe('v1 ↔ v2 storage round-trip', () => {
    /**
     * Mounts both surfaces against the same context providers. A toggle in
     * v2 writes to `localStorage`; a sibling consumer (`v1Reader`) reads
     * the same `useLocalStorage`-backed value via the same provider tree
     * and reflects the change on next render. This is the strict definition
     * of "shared storage parity" the brief asks for — both surfaces own the
     * same key via the same hook.
     */

    const VisualizerStateProbe: React.FC<{ onState: (state: ReturnType<typeof useVisualizer>) => void }> = ({
      onState,
    }) => {
      const state = useVisualizer();
      onState(state);
      return null;
    };

    const TranslucenceStateProbe: React.FC<{ onState: (state: ReturnType<typeof useTranslucence>) => void }> = ({
      onState,
    }) => {
      const state = useTranslucence();
      onState(state);
      return null;
    };

    const GlowStateProbe: React.FC<{ onState: (state: ReturnType<typeof useVisualEffectsToggle>) => void }> = ({
      onState,
    }) => {
      const state = useVisualEffectsToggle();
      onState(state);
      return null;
    };

    it('reflects a v2 visualizer-style change in a sibling v1-style reader', () => {
      // #given — both surfaces mounted against the same provider
      let lastVizState: ReturnType<typeof useVisualizer> | null = null;
      render(
        <Wrapper>
          <AppearanceSection />
          <VisualizerStateProbe onState={(s) => (lastVizState = s)} />
        </Wrapper>,
      );

      // #when — v2 changes the style
      act(() => {
        fireEvent.click(screen.getByText('Wave'));
      });

      // #then — the sibling reader sees the same value, and the storage key was written
      expect(lastVizState!.backgroundVisualizerStyle).toBe('wave');
      expect(memoryStorage.get(STORAGE_KEYS.BG_VISUALIZER_STYLE)).toBe('"wave"');
    });

    it('reflects a v1-side write to BG_VISUALIZER_ENABLED in the v2 visualizer toggle', () => {
      // #given — pre-populate storage as if v1 wrote `false`
      memoryStorage.set(STORAGE_KEYS.BG_VISUALIZER_ENABLED, JSON.stringify(false));

      // #when
      render(
        <Wrapper>
          <AppearanceSection />
        </Wrapper>,
      );

      // #then — v2 reads the v1-written value on mount via the shared context
      expect(screen.getByLabelText('Toggle background visualizer')).toHaveAttribute('data-state', 'unchecked');
    });

    it('reflects a v2 glow toggle in a sibling visual-effects-toggle reader', () => {
      // #given
      let lastGlowState: ReturnType<typeof useVisualEffectsToggle> | null = null;
      render(
        <Wrapper>
          <AppearanceSection />
          <GlowStateProbe onState={(s) => (lastGlowState = s)} />
        </Wrapper>,
      );

      // #when — default is `true`, toggle flips it
      act(() => {
        fireEvent.click(screen.getByLabelText('Toggle album-art glow'));
      });

      // #then
      expect(lastGlowState!.visualEffectsEnabled).toBe(false);
      expect(memoryStorage.get(STORAGE_KEYS.VISUAL_EFFECTS_ENABLED)).toBe('false');
    });

    it('reflects a v2 translucence toggle in a sibling translucence reader', () => {
      // #given
      let lastTransState: ReturnType<typeof useTranslucence> | null = null;
      render(
        <Wrapper>
          <AppearanceSection />
          <TranslucenceStateProbe onState={(s) => (lastTransState = s)} />
        </Wrapper>,
      );

      // #when
      act(() => {
        fireEvent.click(screen.getByLabelText('Toggle translucence'));
      });

      // #then
      expect(lastTransState!.translucenceEnabled).toBe(false);
      expect(memoryStorage.get(STORAGE_KEYS.TRANSLUCENCE_ENABLED)).toBe('false');
    });
  });
});
