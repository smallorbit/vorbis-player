import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { theme } from '@/styles/theme';
import { makeProviderDescriptor } from '@/test/fixtures';

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: vi.fn(() => ({
    viewport: { width: 1200, height: 800 },
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    transitionDuration: 300,
    transitionEasing: 'ease',
  })),
}));

const mockToggleProvider = vi.fn();
const mockRegistry = {
  getAll: vi.fn(() => []),
  get: vi.fn(),
};

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({
    registry: mockRegistry,
    enabledProviderIds: ['spotify'],
    connectedProviderIds: ['spotify'],
    toggleProvider: mockToggleProvider,
  })),
}));

vi.mock('@/contexts/ProfilingContext', () => ({
  useProfilingContext: vi.fn(() => ({
    enabled: false,
    collector: null,
  })),
}));

vi.mock('@/hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn((key: string, defaultValue: unknown) => {
    const state = { value: defaultValue };
    return [state.value, vi.fn((v: unknown) => { state.value = v; })];
  }),
}));

vi.mock('@/hooks/useLibrarySync', () => ({
  useLibrarySync: vi.fn(() => ({
    collections: [],
    isLoading: false,
    error: null,
  })),
  LIBRARY_REFRESH_EVENT: 'vorbis-library-refresh',
  ART_REFRESHED_EVENT: 'vorbis-art-refreshed',
}));

import { useProviderContext } from '@/contexts/ProviderContext';
import AppSettingsMenu from '../VisualEffectsMenu/index';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('AppSettingsMenu', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onClearCache: vi.fn().mockResolvedValue(undefined),
    profilerEnabled: false,
    onProfilerToggle: vi.fn(),
    visualizerDebugEnabled: false,
    onVisualizerDebugToggle: vi.fn(),
    qapEnabled: false,
    onQapToggle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.getAll.mockReturnValue([]);
  });

  describe('rendering', () => {
    it('renders with the Settings title', () => {
      // #given
      render(<Wrapper><AppSettingsMenu {...defaultProps} /></Wrapper>);

      // #then
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders close button with accessible label', () => {
      // #given
      render(<Wrapper><AppSettingsMenu {...defaultProps} /></Wrapper>);

      // #then
      expect(screen.getByLabelText('Close settings drawer')).toBeInTheDocument();
    });

    it('renders Advanced collapsible section', () => {
      // #given
      render(<Wrapper><AppSettingsMenu {...defaultProps} /></Wrapper>);

      // #then
      expect(screen.getByText('Advanced')).toBeInTheDocument();
    });
  });

  describe('close behavior', () => {
    it('calls onClose when close button is clicked', () => {
      // #given
      const onClose = vi.fn();
      render(<Wrapper><AppSettingsMenu {...defaultProps} onClose={onClose} /></Wrapper>);

      // #when
      fireEvent.click(screen.getByLabelText('Close settings drawer'));

      // #then
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('music sources section', () => {
    it('renders provider toggles when multiple providers exist', () => {
      // #given
      const spotifyDesc = makeProviderDescriptor({ id: 'spotify', name: 'Spotify' });
      const dropboxDesc = makeProviderDescriptor({ id: 'dropbox' as 'spotify', name: 'Dropbox' });
      mockRegistry.getAll.mockReturnValue([spotifyDesc, dropboxDesc]);

      render(<Wrapper><AppSettingsMenu {...defaultProps} /></Wrapper>);

      // #then
      expect(screen.getByText('Music Sources')).toBeInTheDocument();
      expect(screen.getByText('Spotify')).toBeInTheDocument();
      expect(screen.getByText('Dropbox')).toBeInTheDocument();
    });

    it('does not render Music Sources section with a single provider', () => {
      // #given
      const spotifyDesc = makeProviderDescriptor({ id: 'spotify', name: 'Spotify' });
      mockRegistry.getAll.mockReturnValue([spotifyDesc]);

      render(<Wrapper><AppSettingsMenu {...defaultProps} /></Wrapper>);

      // #then
      expect(screen.queryByText('Music Sources')).not.toBeInTheDocument();
    });
  });

  describe('advanced section', () => {
    it('shows cache and profiler options when Advanced is expanded', () => {
      // #given
      render(<Wrapper><AppSettingsMenu {...defaultProps} /></Wrapper>);

      // #when
      fireEvent.click(screen.getByText('Advanced'));

      // #then
      expect(screen.getByText('Clear Library Cache')).toBeInTheDocument();
      expect(screen.getByText('Performance Profiler')).toBeInTheDocument();
      expect(screen.getByText('Visualizer Debug')).toBeInTheDocument();
    });

    it('calls onProfilerToggle when profiler button is clicked', () => {
      // #given
      const onProfilerToggle = vi.fn();
      render(
        <Wrapper>
          <AppSettingsMenu {...defaultProps} onProfilerToggle={onProfilerToggle} />
        </Wrapper>
      );

      // #when
      fireEvent.click(screen.getByText('Advanced'));
      const onButtons = screen.getAllByText('On');
      fireEvent.click(onButtons[1]);

      // #then
      expect(onProfilerToggle).toHaveBeenCalled();
    });

    it('calls onVisualizerDebugToggle when debug button is clicked', () => {
      // #given
      const onVisualizerDebugToggle = vi.fn();
      render(
        <Wrapper>
          <AppSettingsMenu {...defaultProps} onVisualizerDebugToggle={onVisualizerDebugToggle} />
        </Wrapper>
      );

      // #when
      fireEvent.click(screen.getByText('Advanced'));
      const onButtons = screen.getAllByText('On');
      fireEvent.click(onButtons[2]);

      // #then
      expect(onVisualizerDebugToggle).toHaveBeenCalled();
    });
  });

  describe('cache clearing', () => {
    it('shows confirmation options when Clear Cache is clicked', () => {
      // #given
      render(<Wrapper><AppSettingsMenu {...defaultProps} /></Wrapper>);
      fireEvent.click(screen.getByText('Advanced'));

      // #when
      fireEvent.click(screen.getByText('Clear Cache'));

      // #then
      expect(screen.getByText('Confirm Clear')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('returns to initial state when cancel is clicked', () => {
      // #given
      render(<Wrapper><AppSettingsMenu {...defaultProps} /></Wrapper>);
      fireEvent.click(screen.getByText('Advanced'));
      fireEvent.click(screen.getByText('Clear Cache'));

      // #when
      fireEvent.click(screen.getByText('Cancel'));

      // #then
      expect(screen.getByText('Clear Cache')).toBeInTheDocument();
      expect(screen.queryByText('Confirm Clear')).not.toBeInTheDocument();
    });

    it('calls onClearCache when confirmed', async () => {
      // #given
      const onClearCache = vi.fn().mockResolvedValue(undefined);
      render(
        <Wrapper>
          <AppSettingsMenu {...defaultProps} onClearCache={onClearCache} />
        </Wrapper>
      );
      fireEvent.click(screen.getByText('Advanced'));
      fireEvent.click(screen.getByText('Clear Cache'));

      // #when
      fireEvent.click(screen.getByText('Confirm Clear'));

      // #then
      await waitFor(() => {
        expect(onClearCache).toHaveBeenCalledWith({
          clearLikes: false,
          clearPins: false,
          clearAccentColors: false,
        });
      });
    });
  });

  describe('provider data sections', () => {
    it('renders provider data section for providers with clearArtCache', () => {
      // #given
      const descriptor = makeProviderDescriptor({
        id: 'dropbox' as 'spotify',
        name: 'Dropbox',
      });
      (descriptor.catalog as Record<string, unknown>).clearArtCache = vi.fn();
      mockRegistry.getAll.mockReturnValue([descriptor]);

      vi.mocked(useProviderContext).mockReturnValue({
        registry: mockRegistry,
        enabledProviderIds: ['dropbox'],
        connectedProviderIds: ['dropbox'],
        toggleProvider: mockToggleProvider,
      } as unknown as ReturnType<typeof useProviderContext>);

      render(<Wrapper><AppSettingsMenu {...defaultProps} /></Wrapper>);

      // #then
      expect(screen.getByText('Dropbox Data')).toBeInTheDocument();
    });
  });
});
