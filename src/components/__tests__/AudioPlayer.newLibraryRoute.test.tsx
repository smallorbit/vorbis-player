/**
 * Tests for AudioPlayer — library overlay swaps to LibraryRoute when
 * the newLibraryRoute flag is enabled and needsSetup + showLibrary are true (#1292).
 *
 * The overlay at the bottom of AudioPlayer (needsSetup && state.showLibrary) is the
 * render site under test. PlayerStateRenderer's library path is covered separately.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import AudioPlayer from '../AudioPlayer';

// ── Minimal mock helpers ──────────────────────────────────────────────────────

vi.mock('@/hooks/usePlayerLogic', () => ({
  usePlayerLogic: vi.fn(),
}));

vi.mock('@/hooks/useNewLibraryRoute', () => ({
  useNewLibraryRoute: vi.fn(),
}));

vi.mock('@/hooks/useSessionPersistence', () => ({
  useSessionPersistence: vi.fn(() => ({
    lastSession: null,
    resetLastSession: vi.fn(),
  })),
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(),
}));

vi.mock('@/contexts/ColorContext', () => ({
  useColorContext: vi.fn(() => ({
    accentColor: '#000000',
    setAccentColor: vi.fn(),
    setAccentColorOverrides: vi.fn(),
    accentColorOverrides: {},
  })),
}));

vi.mock('@/contexts/visualEffects', () => ({
  useVisualEffectsToggle: vi.fn(() => ({
    showVisualEffects: false,
    setShowVisualEffects: vi.fn(),
  })),
  useVisualizer: vi.fn(() => ({
    backgroundVisualizerEnabled: false,
    backgroundVisualizerStyle: 'bars',
    backgroundVisualizerIntensity: 0.5,
    backgroundVisualizerSpeed: 1,
  })),
  useAccentColorBackground: vi.fn(() => ({
    accentColorBackgroundEnabled: false,
  })),
  VisualEffectsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/TrackContext', () => ({
  useTrackListContext: vi.fn(() => ({
    tracks: [],
    selectedPlaylistId: null,
    setTracks: vi.fn(),
    setOriginalTracks: vi.fn(),
    setSelectedPlaylistId: vi.fn(),
    isLoading: false,
    error: null,
    shuffleEnabled: false,
    setIsLoading: vi.fn(),
    setError: vi.fn(),
  })),
  useCurrentTrackContext: vi.fn(() => ({
    currentTrack: null,
    currentTrackIndex: 0,
    setCurrentTrackIndex: vi.fn(),
    showQueue: false,
    setShowQueue: vi.fn(),
  })),
  TrackProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../DebugOverlay', () => ({
  default: () => null,
  useDebugActivator: vi.fn(() => ({ debugActive: false, handleActivatorTap: vi.fn() })),
}));

vi.mock('../BackgroundVisualizer', () => ({
  default: () => null,
}));

vi.mock('../AccentColorBackground', () => ({
  default: () => null,
}));

vi.mock('@/contexts/ProfilingContext', () => ({
  ProfilingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useProfilingContext: vi.fn(() => ({ enabled: false, collector: null })),
}));

vi.mock('@/components/ProfilingOverlay', () => ({
  ProfilingOverlay: () => null,
}));

vi.mock('@/components/ProfiledComponent', () => ({
  ProfiledComponent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../PlayerStateRenderer', () => ({
  default: () => <div data-testid="player-state-renderer" />,
}));

vi.mock('../PlayerContent', () => ({
  default: () => <div data-testid="player-content" />,
}));

vi.mock('../ProviderSetupScreen', () => ({
  default: () => <div data-testid="provider-setup-screen" />,
}));

vi.mock('../PlaylistSelection', () => ({
  default: () => <div data-testid="library-page">LibraryPage</div>,
}));

vi.mock('../LibraryRoute', () => ({
  LibraryRoute: () => <div data-testid="library-route">LibraryRoute</div>,
}));

vi.mock('../QuickAccessPanel', () => ({
  default: () => <div data-testid="quick-access-panel" />,
}));

vi.mock('../QuickAccessPanel/ResumeCard', () => ({
  default: () => <div data-testid="resume-card" />,
}));

vi.mock('../AppSettingsMenu/index', () => ({
  default: () => null,
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { dismiss: vi.fn() }),
  Toaster: () => null,
}));

// ── Import mocked modules ─────────────────────────────────────────────────────

import { usePlayerLogic } from '@/hooks/usePlayerLogic';
import { useNewLibraryRoute } from '@/hooks/useNewLibraryRoute';
import { useProviderContext } from '@/contexts/ProviderContext';

const mockUsePlayerLogic = vi.mocked(usePlayerLogic);
const mockUseNewLibraryRoute = vi.mocked(useNewLibraryRoute);
const mockUseProviderContext = vi.mocked(useProviderContext);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeMinimalPlayerLogicReturn = (showLibrary: boolean) => ({
  state: {
    showLibrary,
    currentView: showLibrary ? 'library' as const : 'player' as const,
    isLoading: false,
    error: null,
    selectedPlaylistId: null,
    tracks: [],
    isPlaying: false,
    playbackPosition: 0,
  },
  handlers: {
    loadCollection: vi.fn(),
    playTracksDirectly: vi.fn(),
    handleAddToQueue: vi.fn(),
    queueTracksDirectly: vi.fn(),
    handlePlay: vi.fn(),
    handlePause: vi.fn(),
    handleNext: vi.fn(),
    handlePrevious: vi.fn(),
    playTrack: vi.fn(),
    handleOpenLibrary: vi.fn(),
    handleCloseLibrary: vi.fn(),
    handleBackToLibrary: vi.fn(),
    handleStartRadio: vi.fn(),
    handleRemoveFromQueue: vi.fn(),
    handleReorderQueue: vi.fn(),
    handleHydrate: vi.fn(async () => ({ track: null, skipped: false, totalFailure: false })),
  },
  radio: {
    radioState: { isActive: false, seedDescription: null, isGenerating: false, error: null, lastMatchStats: null },
    isRadioAvailable: true,
    stopRadio: vi.fn(),
    authExpired: null,
    clearAuthExpired: vi.fn(),
    isActive: false,
    radioProgress: null,
    dismissRadioProgress: vi.fn(),
  },
  currentPlaybackProviderRef: { current: null },
  mediaTracksRef: { current: [] },
  expectedTrackIdRef: { current: null },
  setTracks: vi.fn(),
  setOriginalTracks: vi.fn(),
});

const makeNeedsSetupProviderContext = () => ({
  chosenProviderId: null,
  activeDescriptor: null,
  connectedProviderIds: [] as string[],
  enabledProviderIds: [] as string[],
  fallthroughNotification: null,
  dismissFallthroughNotification: vi.fn(),
  reconnectPrompt: null,
  acceptReconnectPrompt: vi.fn(),
  dismissReconnectPrompt: vi.fn(),
  disconnectToast: null,
  dismissDisconnectToast: vi.fn(),
  setActiveProviderId: vi.fn(),
  getDescriptor: vi.fn(),
  registry: { getAll: vi.fn(() => []) },
  toggleProvider: vi.fn(),
  isUnifiedLikedActive: false,
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AudioPlayer — new library route overlay swap (needsSetup path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProviderContext.mockReturnValue(
      makeNeedsSetupProviderContext() as ReturnType<typeof useProviderContext>
    );
  });

  it('renders LibraryPage in the overlay when flag is OFF and showLibrary is true', () => {
    // #given
    mockUsePlayerLogic.mockReturnValue(makeMinimalPlayerLogicReturn(true) as ReturnType<typeof usePlayerLogic>);
    mockUseNewLibraryRoute.mockReturnValue([false, vi.fn()]);

    // #when
    render(<Wrapper><AudioPlayer /></Wrapper>);

    // #then
    expect(screen.getByTestId('library-page')).toBeInTheDocument();
    expect(screen.queryByTestId('library-route')).not.toBeInTheDocument();
  });

  it('renders LibraryRoute in the overlay when flag is ON and showLibrary is true', () => {
    // #given
    mockUsePlayerLogic.mockReturnValue(makeMinimalPlayerLogicReturn(true) as ReturnType<typeof usePlayerLogic>);
    mockUseNewLibraryRoute.mockReturnValue([true, vi.fn()]);

    // #when
    render(<Wrapper><AudioPlayer /></Wrapper>);

    // #then
    expect(screen.getByTestId('library-route')).toBeInTheDocument();
    expect(screen.queryByTestId('library-page')).not.toBeInTheDocument();
  });

  it('renders neither LibraryPage nor LibraryRoute when showLibrary is false (flag ON)', () => {
    // #given — library is closed
    mockUsePlayerLogic.mockReturnValue(makeMinimalPlayerLogicReturn(false) as ReturnType<typeof usePlayerLogic>);
    mockUseNewLibraryRoute.mockReturnValue([true, vi.fn()]);

    // #when
    render(<Wrapper><AudioPlayer /></Wrapper>);

    // #then
    expect(screen.queryByTestId('library-route')).not.toBeInTheDocument();
    expect(screen.queryByTestId('library-page')).not.toBeInTheDocument();
  });

  it('renders neither LibraryPage nor LibraryRoute when showLibrary is false (flag OFF)', () => {
    // #given
    mockUsePlayerLogic.mockReturnValue(makeMinimalPlayerLogicReturn(false) as ReturnType<typeof usePlayerLogic>);
    mockUseNewLibraryRoute.mockReturnValue([false, vi.fn()]);

    // #when
    render(<Wrapper><AudioPlayer /></Wrapper>);

    // #then
    expect(screen.queryByTestId('library-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('library-route')).not.toBeInTheDocument();
  });

  it('renders ProviderSetupScreen alongside the overlay (needsSetup path)', () => {
    // #given — needsSetup = true, showLibrary = true
    mockUsePlayerLogic.mockReturnValue(makeMinimalPlayerLogicReturn(true) as ReturnType<typeof usePlayerLogic>);
    mockUseNewLibraryRoute.mockReturnValue([false, vi.fn()]);

    // #when
    render(<Wrapper><AudioPlayer /></Wrapper>);

    // #then — ProviderSetupScreen is rendered by renderContent() AND library overlay is shown
    expect(screen.getByTestId('provider-setup-screen')).toBeInTheDocument();
    expect(screen.getByTestId('library-page')).toBeInTheDocument();
  });
});
