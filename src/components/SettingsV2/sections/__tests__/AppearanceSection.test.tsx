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
import { useCurrentTrackContext } from '@/contexts/TrackContext';
import {
  VisualizerProvider,
  VisualEffectsToggleProvider,
  TranslucenceProvider,
  AccentColorBackgroundProvider,
  GlowProvider,
} from '@/contexts/visualEffects';
import {
  useVisualizer,
  useTranslucence,
  useVisualEffectsToggle,
  useAccentColorBackground,
} from '@/contexts/visualEffects';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <VisualEffectsToggleProvider>
      <AccentColorBackgroundProvider>
        <VisualizerProvider>
          <TranslucenceProvider>
            <GlowProvider>{children}</GlowProvider>
          </TranslucenceProvider>
        </VisualizerProvider>
      </AccentColorBackgroundProvider>
    </VisualEffectsToggleProvider>
  </ThemeProvider>
);

describe('SettingsV2 AppearanceSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryStorage.clear();
    installLocalStorageShim();
  });

  it('renders all five control groups', () => {
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
    expect(screen.getByText('Background gradient')).toBeInTheDocument();
    expect(screen.getByText('Translucence')).toBeInTheDocument();
  });

  it('renders the per-album glow override row when a track with albumId is playing', () => {
    // #given
    vi.mocked(useCurrentTrackContext).mockReturnValue({
      currentTrack: {
        id: 'track-1',
        name: 'Track One',
        artist: 'Artist',
        album: 'Album One',
        albumId: 'album-1',
        duration: 1000,
        uri: 'spotify:track:1',
      },
      currentTrackIndex: 0,
      setCurrentTrackIndex: vi.fn(),
      showQueue: false,
      setShowQueue: vi.fn(),
    } as unknown as ReturnType<typeof useCurrentTrackContext>);

    // #when
    render(
      <Wrapper>
        <AppearanceSection />
      </Wrapper>,
    );

    // #then
    expect(screen.getByLabelText('Album glow intensity')).toBeInTheDocument();
    expect(screen.getByLabelText('Album glow rate')).toBeInTheDocument();
    expect(screen.getByText('Album One')).toBeInTheDocument();
  });

  it('writes TRANSLUCENCE_ENABLED only (no opacity side-effect) when master toggled', () => {
    // #given
    render(
      <Wrapper>
        <AppearanceSection />
      </Wrapper>,
    );

    // #when — translucence default is `true`, click toggles to `false`
    fireEvent.click(screen.getByLabelText('Toggle translucence'));

    // #then — single key is written; opacity preset must not auto-write on master flip
    expect(memoryStorage.get(STORAGE_KEYS.TRANSLUCENCE_ENABLED)).toBe('false');
    expect(memoryStorage.has(STORAGE_KEYS.TRANSLUCENCE_OPACITY)).toBe(false);
  });

  it('renders the opacity preset only when translucence is enabled', () => {
    // #given
    render(
      <Wrapper>
        <AppearanceSection />
      </Wrapper>,
    );

    // #then — translucence default is `true`, all three presets are visible
    expect(screen.getByRole('button', { name: 'Subtle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Default' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Strong' })).toBeInTheDocument();

    // #when — flip the master off
    fireEvent.click(screen.getByLabelText('Toggle translucence'));

    // #then — presets unmount
    expect(screen.queryByRole('button', { name: 'Subtle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Default' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Strong' })).not.toBeInTheDocument();
  });

  it('writes the chosen opacity to TRANSLUCENCE_OPACITY when a preset is clicked', () => {
    // #given
    render(
      <Wrapper>
        <AppearanceSection />
      </Wrapper>,
    );

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'Subtle' }));

    // #then
    expect(memoryStorage.get(STORAGE_KEYS.TRANSLUCENCE_OPACITY)).toBe('0.6');
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

    const AccentBgStateProbe: React.FC<{ onState: (state: ReturnType<typeof useAccentColorBackground>) => void }> = ({
      onState,
    }) => {
      const state = useAccentColorBackground();
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

    it('reflects a v2 accent-color-background toggle in a sibling reader and persists the key', () => {
      // #given
      let lastAccentBgState: ReturnType<typeof useAccentColorBackground> | null = null;
      render(
        <Wrapper>
          <AppearanceSection />
          <AccentBgStateProbe onState={(s) => (lastAccentBgState = s)} />
        </Wrapper>,
      );

      // #when — default is `false`, click flips it to `true`
      act(() => {
        fireEvent.click(screen.getByLabelText('Toggle accent-color background'));
      });

      // #then
      expect(lastAccentBgState!.accentColorBackgroundPreferred).toBe(true);
      expect(memoryStorage.get(STORAGE_KEYS.ACCENT_COLOR_BG_PREFERRED)).toBe('true');
    });
  });
});
