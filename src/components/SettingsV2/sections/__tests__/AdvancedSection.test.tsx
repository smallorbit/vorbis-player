import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { STORAGE_KEYS } from '@/constants/storage';
import { makeProviderDescriptor } from '@/test/fixtures';
import type { ProviderDescriptor } from '@/types/providers';

// ── Hook + service mocks ────────────────────────────────────────────────────

const mockProfilerToggle = vi.fn();
const mockSetVisualizerDebug = vi.fn();
const mockClearCacheWithOptions = vi.fn().mockResolvedValue(undefined);
const mockClearAllPins = vi.fn().mockResolvedValue(undefined);
const mockClearPreferencesSyncTimestamp = vi.fn();
const mockInitialSync = vi.fn();
const mockGetPreferencesSync = vi.fn(() => ({ initialSync: mockInitialSync }));
const mockSetQapEnabled = vi.fn();

let mockProfilerEnabled = false;
let mockVisualizerDebugEnabled = false;
let mockQapEnabled = false;
let mockEnabledProviderIds: string[] = [];
let mockProviders: ProviderDescriptor[] = [];

// In-memory localStorage shim — the global setup.ts mocks localStorage with
// vi.fn() returning undefined, which prevents this section's accent-color
// cleanup branch from being asserted. Override per-test with a real Map.
const memoryStorage = new Map<string, string>();

vi.mock('@/contexts/ProfilingContext', () => ({
  useProfilingContext: vi.fn(() => ({
    enabled: mockProfilerEnabled,
    collector: null,
    toggle: mockProfilerToggle,
  })),
}));

vi.mock('@/contexts/VisualizerDebugContext', () => ({
  useVisualizerDebug: vi.fn(() => ({
    isDebugMode: mockVisualizerDebugEnabled,
    setIsDebugMode: mockSetVisualizerDebug,
  })),
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({
    registry: {
      getAll: () => mockProviders,
      get: (id: string) => mockProviders.find((p) => p.id === id),
    },
    enabledProviderIds: mockEnabledProviderIds,
  })),
}));

vi.mock('@/services/cache/libraryCache', () => ({
  clearCacheWithOptions: (...args: unknown[]) => mockClearCacheWithOptions(...args),
}));

vi.mock('@/services/settings/pinnedItemsStorage', () => ({
  clearAllPins: () => mockClearAllPins(),
}));

vi.mock('@/providers/dropbox/dropboxPreferencesSync', () => ({
  clearPreferencesSyncTimestamp: () => mockClearPreferencesSyncTimestamp(),
  getPreferencesSync: () => mockGetPreferencesSync(),
}));

vi.mock('@/hooks/useAsyncAction', () => ({
  useAsyncAction: (fn: () => Promise<void>) => {
    return ['idle', fn];
  },
}));

vi.mock('@/hooks/useLibrarySync', () => ({
  ART_REFRESHED_EVENT: 'art-refreshed',
}));

vi.mock('@/hooks/useQapEnabled', () => ({
  useQapEnabled: vi.fn(() => [
    mockQapEnabled,
    (next: boolean) => {
      mockQapEnabled = next;
      mockSetQapEnabled(next);
      memoryStorage.set('vorbis-player-qap-enabled', JSON.stringify(next));
    },
  ]),
}));

import { AdvancedSection } from '../AdvancedSection';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

const QAP_STORAGE_KEY = 'vorbis-player-qap-enabled';

describe('SettingsV2 AdvancedSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfilerEnabled = false;
    mockVisualizerDebugEnabled = false;
    mockQapEnabled = false;
    mockEnabledProviderIds = [];
    mockProviders = [];
    memoryStorage.clear();
    // Override global localStorage mock with an in-memory shim so writes are
    // observable. setup.ts replaces localStorage with vi.fn()s that return
    // undefined; we restore real behaviour for this suite.
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => memoryStorage.get(key) ?? null,
        setItem: (key: string, value: string) => memoryStorage.set(key, value),
        removeItem: (key: string) => memoryStorage.delete(key),
        clear: () => memoryStorage.clear(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    memoryStorage.clear();
  });

  describe('Quick Access Panel toggle', () => {
    it('writes the QAP-enabled storage key when toggled on', () => {
      // #given
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );

      // #when
      const qapToggle = screen.getByLabelText('Toggle Quick Access Panel');
      fireEvent.click(qapToggle);

      // #then — the hook's setter persists JSON-encoded `true` under the canonical key
      expect(mockSetQapEnabled).toHaveBeenCalledWith(true);
      expect(memoryStorage.get(QAP_STORAGE_KEY)).toBe('true');
    });

    it('reflects the persisted QAP-enabled value on mount', () => {
      // #given
      mockQapEnabled = true;

      // #when
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );

      // #then
      const qapToggle = screen.getByLabelText('Toggle Quick Access Panel');
      expect(qapToggle).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('Performance Profiler toggle', () => {
    it('routes through useProfilingContext().toggle', () => {
      // #given
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );

      // #when
      fireEvent.click(screen.getByLabelText('Toggle Performance Profiler'));

      // #then
      expect(mockProfilerToggle).toHaveBeenCalledOnce();
    });

    it('shows checked when profiler is enabled', () => {
      // #given
      mockProfilerEnabled = true;

      // #when
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );

      // #then
      expect(screen.getByLabelText('Toggle Performance Profiler')).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('Visualizer Debug toggle', () => {
    it('routes through useVisualizerDebug().setIsDebugMode', () => {
      // #given
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );

      // #when
      fireEvent.click(screen.getByLabelText('Toggle Visualizer Debug'));

      // #then
      expect(mockSetVisualizerDebug).toHaveBeenCalledOnce();
    });

    it('disables profiler when enabling visualizer debug while profiler is on', () => {
      // #given
      mockProfilerEnabled = true;
      mockVisualizerDebugEnabled = false;
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );

      // #when
      fireEvent.click(screen.getByLabelText('Toggle Visualizer Debug'));

      // #then
      expect(mockProfilerToggle).toHaveBeenCalledOnce();
    });
  });

  describe('Clear Library Cache', () => {
    it('shows confirm flow with the three option checkboxes when "Clear Cache" is pressed', () => {
      // #given
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );

      // #when
      fireEvent.click(screen.getByText('Clear Cache'));

      // #then
      expect(screen.getByText('Also clear Likes')).toBeInTheDocument();
      expect(screen.getByText('Also clear Pins')).toBeInTheDocument();
      expect(screen.getByText('Also clear Accent Colors')).toBeInTheDocument();
    });

    it('hides the "Also clear Likes" checkbox when a data provider is enabled', () => {
      // #given — a provider exposing exportLikes lives in `dataProviders`
      const spotify: ProviderDescriptor = {
        ...makeProviderDescriptor(),
        catalog: {
          ...makeProviderDescriptor().catalog,
          clearArtCache: vi.fn(),
          exportLikes: vi.fn(),
          importLikes: vi.fn(),
        },
      };
      mockProviders = [spotify];
      mockEnabledProviderIds = ['spotify'];

      // #when
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );
      fireEvent.click(screen.getByText('Clear Cache'));

      // #then
      expect(screen.queryByText('Also clear Likes')).not.toBeInTheDocument();
    });

    it('forwards the selected options to clearCacheWithOptions and clearAllPins', async () => {
      // #given
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );
      fireEvent.click(screen.getByText('Clear Cache'));
      fireEvent.click(screen.getByLabelText('Also clear Pins'));

      // #when
      fireEvent.click(screen.getByText('Confirm Clear'));

      // #then
      await waitFor(() => {
        expect(mockClearCacheWithOptions).toHaveBeenCalledWith({ clearLikes: false });
      });
      expect(mockClearAllPins).toHaveBeenCalledOnce();
    });

    it('removes the accent-color storage keys when "Also clear Accent Colors" is checked', async () => {
      // #given
      memoryStorage.set(STORAGE_KEYS.ACCENT_COLOR_OVERRIDES, '{}');
      memoryStorage.set(STORAGE_KEYS.CUSTOM_ACCENT_COLORS, '{}');
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );
      fireEvent.click(screen.getByText('Clear Cache'));
      fireEvent.click(screen.getByLabelText('Also clear Accent Colors'));

      // #when
      fireEvent.click(screen.getByText('Confirm Clear'));

      // #then
      await waitFor(() => {
        expect(memoryStorage.has(STORAGE_KEYS.ACCENT_COLOR_OVERRIDES)).toBe(false);
      });
      expect(memoryStorage.has(STORAGE_KEYS.CUSTOM_ACCENT_COLORS)).toBe(false);
    });

    it('returns to idle when Cancel is pressed during confirm', () => {
      // #given
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );
      fireEvent.click(screen.getByText('Clear Cache'));

      // #when
      fireEvent.click(screen.getByText('Cancel'));

      // #then
      expect(screen.queryByText('Confirm Clear')).not.toBeInTheDocument();
      expect(screen.getByText('Clear Cache')).toBeInTheDocument();
    });
  });

  describe('Provider Data accordion', () => {
    it('renders one accordion entry per data-capable provider', () => {
      // #given
      const spotify: ProviderDescriptor = {
        ...makeProviderDescriptor(),
        id: 'spotify',
        name: 'Spotify',
        catalog: {
          ...makeProviderDescriptor().catalog,
          clearArtCache: vi.fn(),
        },
      };
      const dropbox: ProviderDescriptor = {
        ...makeProviderDescriptor(),
        id: 'dropbox' as 'spotify',
        name: 'Dropbox',
        catalog: {
          ...makeProviderDescriptor().catalog,
          clearArtCache: vi.fn(),
        },
      };
      mockProviders = [spotify, dropbox];
      mockEnabledProviderIds = ['spotify', 'dropbox'];

      // #when
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );

      // #then
      expect(screen.getByText('Spotify Data')).toBeInTheDocument();
      expect(screen.getByText('Dropbox Data')).toBeInTheDocument();
    });

    it('hides the Provider Data block when no enabled provider exposes data ops', () => {
      // #given — provider enabled but its catalog has neither clearArtCache nor exportLikes
      const dropbox: ProviderDescriptor = {
        ...makeProviderDescriptor(),
        id: 'dropbox' as 'spotify',
        name: 'Dropbox',
      };
      mockProviders = [dropbox];
      mockEnabledProviderIds = ['dropbox'];

      // #when
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );

      // #then
      expect(screen.queryByText('Provider Data')).not.toBeInTheDocument();
      expect(screen.queryByText('Dropbox Data')).not.toBeInTheDocument();
    });
  });

  describe('About section', () => {
    it('renders the keyboard-shortcut hints', () => {
      // #given + #when
      render(
        <Wrapper>
          <AdvancedSection />
        </Wrapper>,
      );

      // #then
      expect(screen.getByText('About')).toBeInTheDocument();
      expect(screen.getByText('Show keyboard shortcuts')).toBeInTheDocument();
      expect(screen.getByText('Open settings')).toBeInTheDocument();
    });
  });
});
