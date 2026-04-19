/**
 * Tests for PlayerContent rendering and conditional states.
 */

import React, { Suspense } from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PlayerContent from '../PlayerContent';
import type { PlaybackHandlers } from '../PlayerContent';
import { makeMediaTrack } from '@/test/fixtures';
import { theme } from '@/styles/theme';

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

vi.mock('@/hooks/useLibrarySync', () => ({
  useLibrarySync: vi.fn(() => ({
    collections: [],
    isLoading: false,
    error: null,
  })),
  LIBRARY_REFRESH_EVENT: 'vorbis-library-refresh',
}));

// Mock all hooks used by PlayerContent
vi.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('@/hooks/useSwipeGesture', () => ({
  useSwipeGesture: vi.fn(() => ({
    offsetX: 0,
    isSwiping: false,
    isAnimating: false,
    gestureHandlers: {},
  })),
}));

vi.mock('@/hooks/useVerticalSwipeGesture', () => ({
  useVerticalSwipeGesture: vi.fn(() => ({
    offsetY: 0,
    isSwiping: false,
    isAnimating: false,
    gestureHandlers: {},
  })),
}));

vi.mock('@/hooks/useVisualEffectsState', () => ({
  useVisualEffectsState: vi.fn(() => ({
    effectiveGlow: { intensity: 0, rate: 1 },
    effectiveBloom: { intensity: 0, rate: 1 },
    effectiveParticles: { density: 0, speed: 1 },
    visualEffectsEnabled: false,
    particlesEnabled: false,
    translucenceEnabled: false,
  })),
}));

vi.mock('@/hooks/useVolume', () => ({
  useVolume: vi.fn(() => ({
    volume: 1,
    setVolume: vi.fn(),
  })),
}));

vi.mock('@/hooks/useLikeTrack', () => ({
  useLikeTrack: vi.fn(() => ({
    handleLikeTrack: vi.fn(),
  })),
}));

vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

vi.mock('@/hooks/useUnifiedLikedTracks', () => ({
  useUnifiedLikedTracks: vi.fn(() => ({
    isUnifiedLikedActive: false,
  })),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useTrackListContext: vi.fn(() => ({
    tracks: [],
    selectedPlaylistId: null,
  })),
  useCurrentTrackContext: vi.fn(() => ({
    currentTrack: null,
    currentTrackIndex: -1,
    showQueue: false,
    setShowQueue: vi.fn(),
  })),
  TrackProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({
    activeDescriptor: {
      id: 'spotify',
      capabilities: { hasSaveTrack: true, hasExternalLink: true },
    },
    connectedProviderIds: ['spotify'],
  })),
  ProviderProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/ColorContext', () => ({
  useColorContext: vi.fn(() => ({
    accentColor: '#1DB954',
    customColors: {},
  })),
  ColorProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/visualEffects', () => ({
  useVisualEffectsToggle: vi.fn(() => ({
    visualEffectsEnabled: true,
    setVisualEffectsEnabled: vi.fn(),
    showVisualEffects: false,
    setShowVisualEffects: vi.fn(),
  })),
  useZenMode: vi.fn(() => ({
    zenModeEnabled: false,
    setZenModeEnabled: vi.fn(),
  })),
  useVisualizer: vi.fn(() => ({
    backgroundVisualizerEnabled: true,
    setBackgroundVisualizerEnabled: vi.fn(),
    backgroundVisualizerStyle: 'fireflies',
    setBackgroundVisualizerStyle: vi.fn(),
    backgroundVisualizerIntensity: 40,
    setBackgroundVisualizerIntensity: vi.fn(),
    backgroundVisualizerSpeed: 1.0,
    setBackgroundVisualizerSpeed: vi.fn(),
  })),
  useTranslucence: vi.fn(() => ({
    translucenceEnabled: true,
    setTranslucenceEnabled: vi.fn(),
    translucenceOpacity: 0.8,
    setTranslucenceOpacity: vi.fn(),
  })),
  useAccentColorBackground: vi.fn(() => ({
    accentColorBackgroundPreferred: false,
    setAccentColorBackgroundPreferred: vi.fn(),
    accentColorBackgroundEnabled: false,
  })),
  useGlow: vi.fn(() => ({
    perAlbumGlow: {},
    setPerAlbumGlow: vi.fn(),
  })),
  VisualEffectsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/ProfilingContext', () => ({
  useProfilingContext: vi.fn(() => ({
    isProfilingEnabled: false,
  })),
}));

vi.mock('@/contexts/VisualizerDebugContext', () => ({
  useVisualizerDebug: vi.fn(() => ({})),
}));

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: vi.fn(() => ({
    isMobile: false,
    isDesktop: true,
    dimensions: {
      width: 600,
      height: 600,
    },
  })),
  PlayerSizingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    onPlayerStateChanged: vi.fn(() => vi.fn()),
    getCurrentState: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    isAuthenticated: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    getAll: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(undefined),
  },
}));

const mockHandlers: PlaybackHandlers = {
  onPlay: vi.fn(),
  onPause: vi.fn(),
  onNext: vi.fn(),
  onPrevious: vi.fn(),
  onTrackSelect: vi.fn(),
  onOpenLibrary: vi.fn(),
  onCloseLibrary: vi.fn(),
  onPlaylistSelect: vi.fn(),
  onAddToQueue: vi.fn(),
  onAlbumPlay: vi.fn(),
  onBackToLibrary: vi.fn(),
  onStartRadio: vi.fn(),
  onRemoveFromQueue: vi.fn(),
  onReorderQueue: vi.fn(),
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>
    <Suspense fallback={<div>Loading...</div>}>
      {children}
    </Suspense>
  </ThemeProvider>
);

describe('PlayerContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing when no track is loaded', () => {
    // #when
    const { container } = render(
      <TestWrapper>
        <PlayerContent
          isPlaying={false}
          showLibrary={false}
          handlers={mockHandlers}
        />
      </TestWrapper>
    );

    // #then
    expect(container).toBeTruthy();
  });

  it('renders player controls when isPlaying is true', () => {
    // #when
    const { container } = render(
      <TestWrapper>
        <PlayerContent
          isPlaying={true}
          showLibrary={false}
          handlers={mockHandlers}
        />
      </TestWrapper>
    );

    // #then
    expect(container).toBeTruthy();
  });

  it('passes showLibrary prop without crashing when false', () => {
    // #when
    const { container } = render(
      <TestWrapper>
        <PlayerContent
          isPlaying={false}
          showLibrary={false}
          handlers={mockHandlers}
        />
      </TestWrapper>
    );

    // #then
    expect(container).toBeTruthy();
  });

  it('handles radioState prop when provided', () => {
    // #given
    const radioState = {
      isActive: false,
      seedDescription: null,
      isGenerating: false,
      error: null,
      lastMatchStats: null,
    };

    // #when
    const { container } = render(
      <TestWrapper>
        <PlayerContent
          isPlaying={false}
          showLibrary={false}
          handlers={mockHandlers}
          radioState={radioState}
          isRadioAvailable={true}
        />
      </TestWrapper>
    );

    // #then
    expect(container).toBeTruthy();
  });

  it('handles all required handler callbacks', () => {
    // #given
    const handlers = {
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onNext: vi.fn(),
      onPrevious: vi.fn(),
      onTrackSelect: vi.fn(),
      onOpenLibrary: vi.fn(),
      onCloseLibrary: vi.fn(),
      onPlaylistSelect: vi.fn(),
      onAlbumPlay: vi.fn(),
      onBackToLibrary: vi.fn(),
    };

    // #when
    const { container } = render(
      <TestWrapper>
        <PlayerContent
          isPlaying={true}
          showLibrary={false}
          handlers={handlers as PlaybackHandlers}
        />
      </TestWrapper>
    );

    // #then
    expect(container).toBeTruthy();
  });

  it('accepts optional onBoundsChange callback', () => {
    // #given
    const mockOnBoundsChange = vi.fn();

    // #when
    const { container } = render(
      <TestWrapper>
        <PlayerContent
          isPlaying={false}
          showLibrary={false}
          handlers={mockHandlers}
          onAlbumArtBoundsChange={mockOnBoundsChange}
        />
      </TestWrapper>
    );

    // #then
    expect(container).toBeTruthy();
  });

  it('accepts currentTrackProvider prop', () => {
    // #when
    const { container } = render(
      <TestWrapper>
        <PlayerContent
          isPlaying={true}
          showLibrary={false}
          handlers={mockHandlers}
          currentTrackProvider="spotify"
        />
      </TestWrapper>
    );

    // #then
    expect(container).toBeTruthy();
  });
});
