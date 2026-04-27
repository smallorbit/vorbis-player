/**
 * BottomBar hide behavior — collapsed truth table after #1298 removal of the
 * useNewLibraryRoute flag.
 *
 * `bottomBarActions.hidden = showLibrary`
 *
 *  showLibrary | hidden
 *  ----------- | ------
 *      true    |  true
 *      false   |  false
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import type { MediaTrack } from '@/types/domain';
import type { BottomBarActionsValue } from '@/contexts/BottomBarActionsContext';

// ---- capture spy: mocked BottomBarActionsProvider records its value ------- //

const captured: { value: BottomBarActionsValue | null } = { value: null };

vi.mock('@/contexts/BottomBarActionsContext', () => ({
  BottomBarActionsProvider: ({
    value,
    children,
  }: {
    value: BottomBarActionsValue;
    children: React.ReactNode;
  }) => {
    captured.value = value;
    return <>{children}</>;
  },
  useBottomBarActions: () => captured.value,
}));

// ---- light no-op mocks for every PlayerControlsSection dependency --------- //

const { mockUseSizing, mockUseQapEnabled } = vi.hoisted(() => ({
  mockUseSizing: vi.fn(),
  mockUseQapEnabled: vi.fn(),
}));

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: () => mockUseSizing(),
}));

vi.mock('@/hooks/useQapEnabled', () => ({
  useQapEnabled: () => mockUseQapEnabled(),
}));

vi.mock('@/contexts/ColorContext', () => ({
  useColorContext: () => ({ accentColor: '#fff' }),
}));

vi.mock('@/hooks/useVisualEffectsState', () => ({
  useVisualEffectsState: () => ({
    effectiveGlow: { intensity: 0, rate: 0 },
    restoreGlowSettings: vi.fn(),
  }),
}));

vi.mock('@/contexts/visualEffects', () => ({
  useTranslucence: () => ({ setTranslucenceEnabled: vi.fn() }),
  useVisualEffectsToggle: () => ({
    visualEffectsEnabled: false,
    setVisualEffectsEnabled: vi.fn(),
    showVisualEffects: false,
    setShowVisualEffects: vi.fn(),
  }),
  useVisualizer: () => ({
    backgroundVisualizerStyle: 'fireflies',
    setBackgroundVisualizerStyle: vi.fn(),
  }),
}));

vi.mock('@/contexts/ProfilingContext', () => ({
  useProfilingContext: () => ({ enabled: false, toggle: vi.fn() }),
}));

vi.mock('@/contexts/VisualizerDebugContext', () => ({
  useVisualizerDebug: () => null,
}));

vi.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('@/hooks/useVolume', () => ({
  useVolume: () => ({
    handleMuteToggle: vi.fn(),
    volume: 50,
    setVolumeLevel: vi.fn(),
  }),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useTrackListContext: () => ({ tracks: [], handleShuffleToggle: vi.fn() }),
}));

vi.mock('@/services/cache/libraryCache', () => ({
  clearCacheWithOptions: vi.fn(),
}));

vi.mock('@/services/settings/pinnedItemsStorage', () => ({
  clearAllPins: vi.fn(),
}));

vi.mock('@/hooks/useTransitionWillChange', () => ({
  useTransitionWillChange: vi.fn(),
}));

vi.mock('@/components/BottomBar', () => ({
  default: () => <div data-testid="bottom-bar" />,
}));

vi.mock('@/components/SpotifyPlayerControls', () => ({
  default: () => <div data-testid="spotify-controls" />,
}));

vi.mock('@/components/ProfiledComponent', () => ({
  ProfiledComponent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../styled', () => ({
  LoadingCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ZenControlsWrapper: React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
    ({ children }, ref) => <div ref={ref}>{children}</div>,
  ),
  ZenControlsInner: React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
    ({ children }, ref) => <div ref={ref}>{children}</div>,
  ),
}));

import { PlayerControlsSection } from '../PlayerControlsSection';

function makeTrack(): MediaTrack {
  return {
    id: 't1',
    name: 'Track',
    artists: 'Artist',
    album: 'Album',
    duration_ms: 1000,
    image: 'https://example.com/art.png',
    provider: 'spotify',
    uri: 'spotify:track:t1',
  } as MediaTrack;
}

interface Scenario {
  showLibrary: boolean;
}

function renderWith(scenario: Scenario) {
  mockUseSizing.mockReturnValue({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    hasPointerInput: true,
    viewport: { width: 1024, height: 768, ratio: 1024 / 768 },
    dimensions: { width: 600, height: 600 },
  });
  mockUseQapEnabled.mockReturnValue([false, vi.fn()]);

  const controlsRef = React.createRef<HTMLDivElement>();
  return render(
    <ThemeProvider theme={theme}>
      <PlayerControlsSection
        currentTrack={makeTrack()}
        currentTrackProvider="spotify"
        isPlaying={false}
        zenModeEnabled={false}
        hasPointerInput={true}
        showLibrary={scenario.showLibrary}
        showQueue={false}
        controlsRef={controlsRef}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onArtistBrowse={vi.fn()}
        onAlbumPlay={vi.fn()}
        onShowQueue={vi.fn()}
        onCloseQueue={vi.fn()}
        onOpenLibrary={vi.fn()}
        onCloseLibrary={vi.fn()}
        onZenModeToggle={vi.fn()}
        isLiked={false}
        isLikePending={false}
        onLikeToggle={vi.fn()}
      />
    </ThemeProvider>,
  );
}

describe('PlayerControlsSection — BottomBar hide', () => {
  beforeEach(() => {
    captured.value = null;
    mockUseSizing.mockReset();
    mockUseQapEnabled.mockReset();
  });

  it('hides BottomBar when showLibrary=true', () => {
    // #given
    // #when
    renderWith({ showLibrary: true });

    // #then — LibraryRoute owns the surface, BottomBar hides
    expect(captured.value?.hidden).toBe(true);
  });

  it('shows BottomBar when showLibrary=false', () => {
    // #given
    // #when
    renderWith({ showLibrary: false });

    // #then
    expect(captured.value?.hidden).toBe(false);
  });
});
