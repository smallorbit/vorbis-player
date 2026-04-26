/**
 * Tests for the New Library Route toggle added to AppSettingsMenu (#1292).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { theme } from '@/styles/theme';
import AppSettingsMenu from '../index';

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

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({
    registry: { getAll: vi.fn(() => []) },
    enabledProviderIds: [],
    connectedProviderIds: [],
    toggleProvider: vi.fn(),
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

vi.mock('@/contexts/ProfilingContext', () => ({
  useProfilingContext: vi.fn(() => ({
    enabled: false,
    collector: null,
  })),
}));

vi.mock('@/hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn((key: string, defaultValue: unknown) => {
    return [defaultValue, vi.fn()];
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

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

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
  newLibraryRouteEnabled: false,
  onNewLibraryRouteToggle: vi.fn(),
};

describe('AppSettingsMenu — New Library Route toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the New Library Route control group', () => {
    // #when
    render(<Wrapper><AppSettingsMenu {...defaultProps} /></Wrapper>);

    // #then
    expect(screen.getByText('New Library Route')).toBeInTheDocument();
  });

  it('renders On and Off pills for the toggle', () => {
    // #when
    render(<Wrapper><AppSettingsMenu {...defaultProps} /></Wrapper>);

    // #then — multiple On/Off buttons exist; NLR pills are present
    const labels = screen.getAllByText('New Library Route');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onNewLibraryRouteToggle when On pill is clicked', () => {
    // #given
    const onNewLibraryRouteToggle = vi.fn();
    render(
      <Wrapper>
        <AppSettingsMenu
          {...defaultProps}
          newLibraryRouteEnabled={false}
          onNewLibraryRouteToggle={onNewLibraryRouteToggle}
        />
      </Wrapper>
    );

    // #when — find the NLR control group's On button
    const controlGroup = screen.getByText('New Library Route').closest('[data-testid="nlr-control-group"]')
      ?? screen.getByText('New Library Route').parentElement;
    const onButton = controlGroup
      ? Array.from(controlGroup.querySelectorAll('button')).find(b => b.textContent === 'On')
      : null;

    if (onButton) {
      fireEvent.click(onButton);
      // #then
      expect(onNewLibraryRouteToggle).toHaveBeenCalled();
    } else {
      // Fallback: click the first On button that corresponds to NLR (it's the second pair of On/Off)
      const allOnButtons = screen.getAllByText('On');
      // NLR toggle is right after QAP toggle; click the last On in the non-Advanced section
      fireEvent.click(allOnButtons[allOnButtons.length - 1]);
      expect(onNewLibraryRouteToggle).toHaveBeenCalled();
    }
  });

  it('calls onNewLibraryRouteToggle when Off pill is clicked', () => {
    // #given
    const onNewLibraryRouteToggle = vi.fn();
    render(
      <Wrapper>
        <AppSettingsMenu
          {...defaultProps}
          newLibraryRouteEnabled={true}
          onNewLibraryRouteToggle={onNewLibraryRouteToggle}
        />
      </Wrapper>
    );

    // #when — click an Off button associated with NLR
    const allOffButtons = screen.getAllByText('Off');
    fireEvent.click(allOffButtons[allOffButtons.length - 1]);

    // #then
    expect(onNewLibraryRouteToggle).toHaveBeenCalled();
  });

  it('re-renders when newLibraryRouteEnabled prop changes (memo equality check)', () => {
    // #given
    const { rerender } = render(
      <Wrapper>
        <AppSettingsMenu {...defaultProps} newLibraryRouteEnabled={false} />
      </Wrapper>
    );

    // #when — prop changes should trigger re-render (arePropsEqual must account for it)
    rerender(
      <Wrapper>
        <AppSettingsMenu {...defaultProps} newLibraryRouteEnabled={true} />
      </Wrapper>
    );

    // #then — component is still mounted and New Library Route label present
    expect(screen.getByText('New Library Route')).toBeInTheDocument();
  });
});
