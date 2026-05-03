import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { makeProviderDescriptor } from '@/test/fixtures';
import type { ProviderDescriptor } from '@/types/providers';

// ── Context mocks ──────────────────────────────────────────────────────────

const mockToggleProvider = vi.fn();

const mockRegistry = {
  getAll: vi.fn<[], ProviderDescriptor[]>(() => []),
  get: vi.fn<[string], ProviderDescriptor | undefined>(() => undefined),
  has: vi.fn(() => true),
};

let mockEnabledProviderIds: string[] = ['spotify', 'dropbox'];
let mockConnectedProviderIds: string[] = ['spotify'];

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({
    registry: mockRegistry,
    enabledProviderIds: mockEnabledProviderIds,
    connectedProviderIds: mockConnectedProviderIds,
    toggleProvider: mockToggleProvider,
  })),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useTrackListContext: vi.fn(() => ({
    tracks: [],
    setTracks: vi.fn(),
    setOriginalTracks: vi.fn(),
  })),
  useCurrentTrackContext: vi.fn(() => ({
    currentTrackIndex: 0,
    setCurrentTrackIndex: vi.fn(),
  })),
}));

vi.mock('@/hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn((_key: string, defaultValue: unknown) => [defaultValue, vi.fn()]),
}));

import { SourcesSection } from '../SourcesSection';
import { Toaster } from '@/components/ui/sonner';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>
    <Toaster />
    {children}
  </ThemeProvider>
);

function makeDescriptor(
  id: string,
  name: string,
  options: { hasNativeQueueSync?: boolean; isAuthenticated?: boolean } = {},
): ProviderDescriptor {
  const base = makeProviderDescriptor();
  return {
    ...base,
    id: id as ProviderDescriptor['id'],
    name,
    auth: {
      ...base.auth,
      isAuthenticated: vi.fn().mockReturnValue(options.isAuthenticated ?? true),
    },
    capabilities: {
      ...base.capabilities,
      hasNativeQueueSync: options.hasNativeQueueSync ?? false,
    },
  };
}

describe('SettingsV2 SourcesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnabledProviderIds = ['spotify', 'dropbox'];
    mockConnectedProviderIds = ['spotify'];
    mockRegistry.getAll.mockReturnValue([]);
    mockRegistry.get.mockReturnValue(undefined);
  });

  describe('MusicSourcesSection gating', () => {
    it('renders the music-sources rows when ≥2 providers are registered', () => {
      // #given
      const spotify = makeDescriptor('spotify', 'Spotify');
      const dropbox = makeDescriptor('dropbox', 'Dropbox');
      mockRegistry.getAll.mockReturnValue([spotify, dropbox]);
      mockRegistry.get.mockImplementation((id) => (id === 'spotify' ? spotify : dropbox));

      // #when
      render(
        <Wrapper>
          <SourcesSection />
        </Wrapper>,
      );

      // #then
      expect(screen.getByText('Music Sources')).toBeInTheDocument();
      expect(screen.getByText('Spotify')).toBeInTheDocument();
      expect(screen.getByText('Dropbox')).toBeInTheDocument();
    });

    it('hides the music-sources block when only one provider is registered', () => {
      // #given
      const spotify = makeDescriptor('spotify', 'Spotify');
      mockRegistry.getAll.mockReturnValue([spotify]);
      mockRegistry.get.mockReturnValue(spotify);

      // #when
      render(
        <Wrapper>
          <SourcesSection />
        </Wrapper>,
      );

      // #then
      expect(screen.queryByText('Music Sources')).not.toBeInTheDocument();
    });
  });

  describe('NativeQueueSyncSection gating', () => {
    it('renders the queue-sync block when a connected provider exposes hasNativeQueueSync', () => {
      // #given
      const spotify = makeDescriptor('spotify', 'Spotify', { hasNativeQueueSync: true });
      const dropbox = makeDescriptor('dropbox', 'Dropbox');
      mockRegistry.getAll.mockReturnValue([spotify, dropbox]);
      mockConnectedProviderIds = ['spotify'];

      // #when
      render(
        <Wrapper>
          <SourcesSection />
        </Wrapper>,
      );

      // #then — the section title interpolates the provider name
      expect(screen.getByText('Spotify Queue')).toBeInTheDocument();
    });

    it('hides the queue-sync block when no connected provider exposes hasNativeQueueSync', () => {
      // #given
      const dropbox = makeDescriptor('dropbox', 'Dropbox', { hasNativeQueueSync: false });
      mockRegistry.getAll.mockReturnValue([dropbox]);
      mockConnectedProviderIds = ['dropbox'];

      // #when
      render(
        <Wrapper>
          <SourcesSection />
        </Wrapper>,
      );

      // #then
      expect(screen.queryByText(/Queue$/)).not.toBeInTheDocument();
    });

    it('hides the queue-sync block when the capable provider is not connected', () => {
      // #given
      const spotify = makeDescriptor('spotify', 'Spotify', { hasNativeQueueSync: true });
      const dropbox = makeDescriptor('dropbox', 'Dropbox');
      mockRegistry.getAll.mockReturnValue([spotify, dropbox]);
      mockConnectedProviderIds = ['dropbox'];

      // #when
      render(
        <Wrapper>
          <SourcesSection />
        </Wrapper>,
      );

      // #then
      expect(screen.queryByText('Spotify Queue')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders nothing inside the section when both children gate-out', () => {
      // #given — single provider, no native queue sync
      const dropbox = makeDescriptor('dropbox', 'Dropbox');
      mockRegistry.getAll.mockReturnValue([dropbox]);
      mockConnectedProviderIds = ['dropbox'];

      // #when
      render(
        <Wrapper>
          <SourcesSection />
        </Wrapper>,
      );

      // #then
      expect(screen.queryByText('Music Sources')).not.toBeInTheDocument();
      expect(screen.queryByText(/Queue$/)).not.toBeInTheDocument();
    });
  });
});
