/**
 * Truth-table tests for BottomBar conservative-hide behavior.
 *
 * `bottomBarActions.hidden = showLibrary && (isMobile || newLibraryRouteEnabled)`
 *
 *  showLibrary | isMobile | newLibraryRouteEnabled | hidden
 *  ----------- | -------- | ---------------------- | ------
 *      true    |  false   |         true           |  true     (mini-player owns bottom)
 *      true    |  true    |         false          |  true     (mobile-legacy)
 *      true    |  false   |         false          |  false    (desktop-legacy — REGRESSION GUARD)
 *      false   |   any    |          any           |  false
 *
 * Captured via a mocked BottomBarActionsProvider that records its `value` prop.
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

const { mockUseSizing, mockUseNewLibraryRoute, mockUseQapEnabled } = vi.hoisted(() => ({
  mockUseSizing: vi.fn(),
  mockUseNewLibraryRoute: vi.fn(),
  mockUseQapEnabled: vi.fn(),
}));

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: () => mockUseSizing(),
}));

vi.mock('@/hooks/useNewLibraryRoute', () => ({
  useNewLibraryRoute: () => mockUseNewLibraryRoute(),
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

// LoadingCard / ZenControls* are styled components from local sibling — pass-through.
vi.mock('../styled', () => ({
  LoadingCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ZenControlsWrapper: React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
    ({ children }, ref) => <div ref={ref}>{children}</div>,
  ),
  ZenControlsInner: React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
    ({ children }, ref) => <div ref={ref}>{children}</div>,
  ),
}));

// -------------------------------------------------------------------------- //

import { PlayerControlsSection } from '../PlayerControlsSection';

function makeTrack(): MediaTrack {
  return {
    id: 't1',
    name: 'Track',
    artists: 'Artist',
    duration_ms: 1000,
    image: 'https://example.com/art.png',
    provider: 'spotify',
    uri: 'spotify:track:t1',
  } as MediaTrack;
}

interface Scenario {
  showLibrary: boolean;
  isMobile: boolean;
  newLibraryRouteEnabled: boolean;
}

function renderWith(scenario: Scenario) {
  mockUseSizing.mockReturnValue({
    isMobile: scenario.isMobile,
    isTablet: false,
    isDesktop: !scenario.isMobile,
    isTouchDevice: false,
    hasPointerInput: true,
    viewport: { width: 1024, height: 768, ratio: 1024 / 768 },
    dimensions: { width: 600, height: 600 },
  });
  mockUseNewLibraryRoute.mockReturnValue([scenario.newLibraryRouteEnabled, vi.fn()]);
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

describe('PlayerControlsSection — BottomBar conservative-hide truth table', () => {
  beforeEach(() => {
    captured.value = null;
    mockUseSizing.mockReset();
    mockUseNewLibraryRoute.mockReset();
    mockUseQapEnabled.mockReset();
  });

  it('hidden=true when showLibrary + newLibraryRouteEnabled (desktop)', () => {
    // #given showLibrary=true, isMobile=false, newLibraryRouteEnabled=true
    // #when
    renderWith({ showLibrary: true, isMobile: false, newLibraryRouteEnabled: true });

    // #then — mini-player owns bottom strip; BottomBar hides
    expect(captured.value?.hidden).toBe(true);
  });

  it('hidden=true when showLibrary + isMobile (legacy mobile behavior preserved)', () => {
    // #given showLibrary=true, isMobile=true, newLibraryRouteEnabled=false
    // #when
    renderWith({ showLibrary: true, isMobile: true, newLibraryRouteEnabled: false });

    // #then
    expect(captured.value?.hidden).toBe(true);
  });

  it('hidden=false when showLibrary on legacy desktop (REGRESSION GUARD)', () => {
    // #given showLibrary=true, isMobile=false, newLibraryRouteEnabled=false
    // #when
    renderWith({ showLibrary: true, isMobile: false, newLibraryRouteEnabled: false });

    // #then — legacy desktop path MUST keep BottomBar visible
    expect(captured.value?.hidden).toBe(false);
  });

  it('hidden=false when showLibrary=false regardless of flag (mobile + NLR on)', () => {
    // #given showLibrary=false, isMobile=true, newLibraryRouteEnabled=true
    // #when
    renderWith({ showLibrary: false, isMobile: true, newLibraryRouteEnabled: true });

    // #then
    expect(captured.value?.hidden).toBe(false);
  });

  it('hidden=false when showLibrary=false on plain desktop', () => {
    // #given showLibrary=false, isMobile=false, newLibraryRouteEnabled=false
    // #when
    renderWith({ showLibrary: false, isMobile: false, newLibraryRouteEnabled: false });

    // #then
    expect(captured.value?.hidden).toBe(false);
  });
});
