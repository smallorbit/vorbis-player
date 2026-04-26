import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';

// ---------------------------------------------------------------------------
// Mocks — paths are relative to THIS test file (src/components/__tests__/)
// so sibling components use '../' not './'
// ---------------------------------------------------------------------------

let mockIsUiV2 = false;
let mockWelcomeSeen = false;

vi.mock('@/hooks/useUiV2', () => ({
  useUiV2: vi.fn(() => mockIsUiV2),
}));

vi.mock('@/hooks/useWelcomeSeen', () => ({
  useWelcomeSeen: vi.fn(() => [mockWelcomeSeen, vi.fn()]),
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({
    chosenProviderId: null,
    activeDescriptor: null,
    connectedProviderIds: [],   // empty → needsSetup=true in every test
    fallthroughNotification: null,
    dismissFallthroughNotification: vi.fn(),
    reconnectPrompt: null,
    acceptReconnectPrompt: vi.fn(),
    dismissReconnectPrompt: vi.fn(),
    disconnectToast: null,
    dismissDisconnectToast: vi.fn(),
    registry: { getAll: () => [] },
    enabledProviderIds: [],
    setActiveProviderId: vi.fn(),
    toggleProvider: vi.fn(),
  })),
}));

vi.mock('@/hooks/usePlayerLogic', () => ({
  usePlayerLogic: vi.fn(() => ({
    state: { isLoading: false, error: null, isPlaying: false, showLibrary: false, playbackPosition: 0 },
    handlers: {
      handlePlay: vi.fn(), handlePause: vi.fn(), handleNext: vi.fn(),
      handlePrevious: vi.fn(), playTrack: vi.fn(), handleOpenLibrary: vi.fn(),
      handleCloseLibrary: vi.fn(), loadCollection: vi.fn(), handleAddToQueue: vi.fn(),
      handleStartRadio: vi.fn(), handleRemoveFromQueue: vi.fn(), handleReorderQueue: vi.fn(),
      handleHydrate: vi.fn(), playTracksDirectly: vi.fn(), queueTracksDirectly: vi.fn(),
    },
    radio: { radioState: null, isRadioAvailable: false, isActive: false, radioProgress: null, dismissRadioProgress: vi.fn() },
    currentPlaybackProviderRef: { current: undefined },
    mediaTracksRef: { current: [] },
    expectedTrackIdRef: { current: null },
  })),
}));

vi.mock('@/contexts/ColorContext', () => ({
  useColorContext: vi.fn(() => ({ accentColor: '#fff' })),
}));

vi.mock('@/contexts/visualEffects', () => ({
  useVisualizer: vi.fn(() => ({
    backgroundVisualizerEnabled: false,
    backgroundVisualizerStyle: 'bars',
    backgroundVisualizerIntensity: 1,
    backgroundVisualizerSpeed: 1,
  })),
  useAccentColorBackground: vi.fn(() => ({ accentColorBackgroundEnabled: false })),
  useVisualEffectsToggle: vi.fn(() => ({ showVisualEffects: false, setShowVisualEffects: vi.fn() })),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useTrackListContext: vi.fn(() => ({
    tracks: [],
    selectedPlaylistId: null,
    setTracks: vi.fn(),
    setOriginalTracks: vi.fn(),
    setSelectedPlaylistId: vi.fn(),
  })),
  useCurrentTrackContext: vi.fn(() => ({
    currentTrack: null,
    currentTrackIndex: 0,
    setCurrentTrackIndex: vi.fn(),
    showQueue: false,
    setShowQueue: vi.fn(),
  })),
}));

vi.mock('@/hooks/useSessionPersistence', () => ({
  useSessionPersistence: vi.fn(() => ({ lastSession: null, resetLastSession: vi.fn() })),
}));

vi.mock('@/contexts/PlayerSizingContext', () => ({
  PlayerSizingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/ProfilingContext', () => ({
  ProfilingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ProfilingOverlay', () => ({
  ProfilingOverlay: () => null,
}));

vi.mock('@/components/ProfiledComponent', () => ({
  ProfiledComponent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Component stubs — relative to THIS file, resolving into src/components/
vi.mock('../DebugOverlay', () => ({
  default: () => null,
  useDebugActivator: vi.fn(() => ({ debugActive: false, handleActivatorTap: vi.fn() })),
}));

vi.mock('../OnboardingV2', () => ({
  default: () => <div data-testid="onboarding-flow-v2" />,
}));

vi.mock('../ProviderSetupScreen', () => ({
  default: () => <div data-testid="provider-setup-screen" />,
}));

vi.mock('../PlayerStateRenderer', () => ({
  default: () => <div data-testid="player-state-renderer" />,
}));

vi.mock('../PlayerContent', () => ({
  default: () => <div data-testid="player-content" />,
}));

vi.mock('../BackgroundVisualizer', () => ({
  default: () => null,
}));

vi.mock('../AccentColorBackground', () => ({
  default: () => null,
}));

vi.mock('../SettingsGearButton', () => ({
  default: () => null,
}));

vi.mock('../QuickAccessPanel', () => ({
  default: () => null,
}));

import AudioPlayer from '../AudioPlayer';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

function renderPlayer() {
  return render(
    <Wrapper>
      <AudioPlayer />
    </Wrapper>,
  );
}

describe('AudioPlayer — renderContent() gate', () => {
  beforeEach(() => {
    mockIsUiV2 = false;
    mockWelcomeSeen = false;
    vi.clearAllMocks();
  });

  it('renders OnboardingFlowV2 (not ProviderSetupScreen) when isUiV2=true, welcomeSeen=false, needsSetup=true', () => {
    // #given — v2 UI enabled, onboarding not yet completed, no provider connected
    mockIsUiV2 = true;
    mockWelcomeSeen = false;

    // #when
    renderPlayer();

    // #then — onboarding gate fires first; setup screen is suppressed
    expect(screen.getByTestId('onboarding-flow-v2')).toBeInTheDocument();
    expect(screen.queryByTestId('provider-setup-screen')).not.toBeInTheDocument();
  });

  it('renders ProviderSetupScreen when isUiV2=true, welcomeSeen=true, needsSetup=true', () => {
    // #given — v2 UI enabled but onboarding already completed; gate falls through
    mockIsUiV2 = true;
    mockWelcomeSeen = true;

    // #when
    renderPlayer();

    // #then — onboarding gate skipped, setup screen shown
    expect(screen.getByTestId('provider-setup-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-flow-v2')).not.toBeInTheDocument();
  });

  it('renders ProviderSetupScreen when isUiV2=false, needsSetup=true (v1 path unchanged)', () => {
    // #given — v1 UI, no provider connected
    mockIsUiV2 = false;

    // #when
    renderPlayer();

    // #then — v1 path goes straight to setup screen
    expect(screen.getByTestId('provider-setup-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-flow-v2')).not.toBeInTheDocument();
  });
});
