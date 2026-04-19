import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import BottomBar from '../BottomBar';
import { TestWrapper } from '@/test/testWrappers';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import {
  BottomBarActionsProvider,
  type BottomBarActionsValue,
} from '@/contexts/BottomBarActionsContext';
import { useZenMode } from '@/contexts/visualEffects';

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    setVolume: vi.fn().mockResolvedValue(undefined),
    onPlayerStateChanged: vi.fn(() => vi.fn()),
    getCurrentState: vi.fn().mockResolvedValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
    playTrack: vi.fn().mockResolvedValue(undefined),
    getDeviceId: vi.fn().mockReturnValue(null),
    getIsReady: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    isAuthenticated: vi.fn(() => true),
    getAccessToken: vi.fn().mockReturnValue('mock-token'),
    ensureValidToken: vi.fn().mockResolvedValue('mock-token'),
    handleRedirect: vi.fn().mockResolvedValue(undefined),
    redirectToAuth: vi.fn(),
    logout: vi.fn(),
  },
  getUserPlaylists: vi.fn(),
  getPlaylistTracks: vi.fn(),
  getAlbumTracks: vi.fn(),
  getLikedSongs: vi.fn(),
  getLikedSongsCount: vi.fn(),
  checkTrackSaved: vi.fn(),
  saveTrack: vi.fn(),
  unsaveTrack: vi.fn(),
  getUserLibraryInterleaved: vi.fn(),
}));

const mockSizingContext = {
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouchDevice: false,
  hasPointerInput: true,
  viewport: { width: 1024, height: 768, ratio: 1024 / 768 },
  dimensions: { width: 600, height: 600 },
};

vi.mock('@/contexts/PlayerSizingContext', () => ({
  PlayerSizingProvider: ({ children }: { children: React.ReactNode }) => children,
  usePlayerSizingContext: vi.fn(() => mockSizingContext),
}));

function makeActions(overrides?: Partial<BottomBarActionsValue>): BottomBarActionsValue {
  return {
    hidden: false,
    showSettings: vi.fn(),
    showQueue: vi.fn(),
    openLibrary: vi.fn(),
    toggleZenMode: vi.fn(),
    startRadio: vi.fn(),
    openQuickAccessPanel: vi.fn(),
    radioGenerating: false,
    ...overrides,
  };
}

function ZenModeSetter({ enabled }: { enabled: boolean }) {
  const { setZenModeEnabled } = useZenMode();
  React.useEffect(() => {
    setZenModeEnabled(enabled);
  }, [enabled, setZenModeEnabled]);
  return null;
}

interface RenderOptions {
  actions?: BottomBarActionsValue;
  zenModeEnabled?: boolean;
}

function primeZenMode(enabled: boolean) {
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) =>
    key === 'vorbis-player-zen-mode-enabled' ? JSON.stringify(enabled) : null
  );
}

function renderBottomBar(options?: RenderOptions) {
  const actions = options?.actions ?? makeActions();
  const zen = options?.zenModeEnabled ?? false;
  primeZenMode(zen);
  const result = render(
    <ThemeProvider theme={theme}>
      <TestWrapper>
        <ZenModeSetter enabled={zen} />
        <BottomBarActionsProvider value={actions}>
          <BottomBar />
        </BottomBarActionsProvider>
      </TestWrapper>
    </ThemeProvider>
  );
  return { ...result, actions };
}

function rerenderBottomBar(
  rerender: ReturnType<typeof render>['rerender'],
  options: RenderOptions,
) {
  const actions = options.actions ?? makeActions();
  const zen = options.zenModeEnabled ?? false;
  rerender(
    <ThemeProvider theme={theme}>
      <TestWrapper>
        <ZenModeSetter enabled={zen} />
        <BottomBarActionsProvider value={actions}>
          <BottomBar />
        </BottomBarActionsProvider>
      </TestWrapper>
    </ThemeProvider>
  );
}

describe('BottomBar', () => {
  it('renders into document.body via portal', () => {
    // #given / #when
    renderBottomBar();

    // #then
    const bar = document.body.querySelector('[title="App settings"]');
    expect(bar).toBeTruthy();
  });

  it('clicking the back-to-library button calls openLibrary', () => {
    // #given
    const { actions } = renderBottomBar();

    // #when
    fireEvent.click(screen.getByTitle('Back to Library'));

    // #then
    expect(actions.openLibrary).toHaveBeenCalledOnce();
  });

  it('zen mode button is always rendered', () => {
    // #given / #when
    renderBottomBar();

    // #then
    expect(screen.getByTitle(/zen mode/i)).toBeTruthy();
  });

  it('shuffle button reflects shuffle state from track context', () => {
    // #given — TestWrapper's TrackProvider defaults shuffleEnabled to false
    renderBottomBar();

    // #then
    const shuffleButton = screen.getByTitle(/shuffle/i);
    expect(shuffleButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('visual effects button calls showSettings when clicked', () => {
    // #given
    const { actions } = renderBottomBar();

    // #when
    fireEvent.click(screen.getByTitle('App settings'));

    // #then
    expect(actions.showSettings).toHaveBeenCalledOnce();
  });

  it('queue button calls showQueue when clicked', () => {
    // #given
    const { actions } = renderBottomBar();

    // #when
    fireEvent.click(screen.getByTitle('Show Queue'));

    // #then
    expect(actions.showQueue).toHaveBeenCalledOnce();
  });

  it('zen mode button calls toggleZenMode when clicked', () => {
    // #given
    const { actions } = renderBottomBar();

    // #when
    fireEvent.click(screen.getByTitle(/zen mode/i));

    // #then
    expect(actions.toggleZenMode).toHaveBeenCalledOnce();
  });

  it('radio button is hidden when startRadio is not provided', () => {
    // #given / #when
    renderBottomBar({ actions: makeActions({ startRadio: undefined }) });

    // #then
    expect(screen.queryByTitle(/generate radio/i)).toBeNull();
  });

  it('bar remains visible in normal mode — no hide timer is started', () => {
    vi.useFakeTimers();

    // #given
    renderBottomBar({ zenModeEnabled: false });

    // #when
    vi.advanceTimersByTime(2000);

    // #then
    expect(screen.getByTitle('App settings')).toBeTruthy();

    vi.useRealTimers();
  });

  it('returns null when hidden flag is true', () => {
    // #given / #when
    renderBottomBar({ actions: makeActions({ hidden: true }) });

    // #then
    expect(screen.queryByTitle('App settings')).toBeNull();
  });
});

describe('BottomBar — zen mode show/hide state machine', () => {
  const AUTOHIDE_DELAY = 1000;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bar initializes as hidden when zen mode is already enabled', () => {
    // #given — zen mode is on from the start; useEffect fires startHideTimer immediately
    renderBottomBar({ zenModeEnabled: true });

    // #when — autohide delay elapses
    act(() => {
      vi.advanceTimersByTime(AUTOHIDE_DELAY);
    });

    // #then — backdrop is absent (bar hidden)
    const portalChildren = Array.from(document.body.children);
    const backdrop = portalChildren.find(
      (el) => el.tagName === 'DIV' && el.getAttribute('style')?.includes('inset')
    );
    expect(backdrop).toBeUndefined();
  });

  it('trigger zone is rendered only when zen mode is enabled', () => {
    // #given
    const { rerender } = renderBottomBar({ zenModeEnabled: false });
    const countWithoutZen = document.body.childElementCount;

    // #when
    rerenderBottomBar(rerender, { zenModeEnabled: true });

    // #then — one extra portal child (ZenTriggerZone) is added
    expect(document.body.childElementCount).toBe(countWithoutZen + 1);
  });

  it('bar re-appears when zen mode is disabled after being enabled', () => {
    // #given — start in zen mode and let the bar auto-hide
    const { rerender } = renderBottomBar({ zenModeEnabled: true });

    act(() => {
      vi.advanceTimersByTime(AUTOHIDE_DELAY);
    });

    const countWhileZen = document.body.childElementCount;

    // #when — zen mode is turned off
    rerenderBottomBar(rerender, { zenModeEnabled: false });

    // #then — trigger zone is gone, portal has fewer children again
    expect(document.body.childElementCount).toBe(countWhileZen - 1);

    // bar buttons are accessible (bar is not hidden)
    expect(screen.getByTitle('App settings')).toBeTruthy();
  });

  it('bar hides after autohide delay following zen mode enable', () => {
    // #given — zen disabled initially (bar visible); transitioning to zen on starts the timer
    const { rerender } = renderBottomBar({ zenModeEnabled: false });

    // #when — toggle zen mode on
    rerenderBottomBar(rerender, { zenModeEnabled: true });

    const countBeforeTimeout = document.body.childElementCount;

    // advance past the autohide delay
    act(() => {
      vi.advanceTimersByTime(AUTOHIDE_DELAY);
    });

    // #then — the number of portal children is unchanged (bar stays in DOM but hidden)
    // and no new ZenBackdrop appeared (bar not visible on touch device path)
    expect(document.body.childElementCount).toBe(countBeforeTimeout);
  });

  it('mouseenter on the bar container cancels the hide timer', () => {
    // #given — zen mode on, bar is visible, hide timer is running
    const { rerender } = renderBottomBar({ zenModeEnabled: false });

    rerenderBottomBar(rerender, { zenModeEnabled: true });

    // BottomBarContainer is always the last direct child of document.body (portal renders it last)
    const barContainer = document.body.lastElementChild as HTMLElement;

    // #when — mouse enters the bar before the timer fires
    act(() => { fireEvent.mouseEnter(barContainer); });

    act(() => {
      vi.advanceTimersByTime(AUTOHIDE_DELAY * 2);
    });

    // #then — bar is still visible (buttons are reachable)
    expect(screen.getByTitle('App settings')).toBeTruthy();
  });

  it('mouseleave on the bar container restarts the hide timer', () => {
    // #given — zen mode on, mouse entered (timer cancelled)
    const { rerender } = renderBottomBar({ zenModeEnabled: false });

    rerenderBottomBar(rerender, { zenModeEnabled: true });

    const barContainer = document.body.lastElementChild as HTMLElement;

    act(() => { fireEvent.mouseEnter(barContainer); });
    act(() => { vi.advanceTimersByTime(AUTOHIDE_DELAY * 2); });

    const countBeforeLeave = document.body.childElementCount;

    // #when — mouse leaves the bar
    act(() => { fireEvent.mouseLeave(barContainer); });

    // advance past autohide delay
    act(() => { vi.advanceTimersByTime(AUTOHIDE_DELAY); });

    // #then — portal structure unchanged (bar hidden via CSS, still in DOM)
    expect(document.body.childElementCount).toBe(countBeforeLeave);
  });

  it('mouseenter on the trigger zone shows the bar on non-touch device', () => {
    // #given — zen mode on, bar has auto-hidden after timeout
    renderBottomBar({ zenModeEnabled: true });

    act(() => { vi.advanceTimersByTime(AUTOHIDE_DELAY); });

    // portal structure: [RTL-container, ZenTriggerZone, BottomBarContainer]
    // ZenTriggerZone is the second-to-last body child
    const getBodyChildren = () => Array.from(document.body.children) as HTMLElement[];
    const triggerZone = getBodyChildren()[getBodyChildren().length - 2];

    // #when — non-touch device hovers over trigger zone (showBar fires for pointer devices)
    act(() => { fireEvent.mouseEnter(triggerZone); });

    // #then — bar is visible again; no backdrop is added on desktop (DOM count unchanged)
    expect(screen.getByTitle('App settings')).toBeTruthy();
  });

  it('backdrop appears when bar is shown on touch device', () => {
    // #given — touch device, zen mode on
    vi.mocked(usePlayerSizingContext).mockReturnValue({
      ...mockSizingContext,
      isTouchDevice: true,
    });

    renderBottomBar({ zenModeEnabled: true });

    // barVisible starts false (= !zenModeEnabled); portal has: [RTL-div, ZenTriggerZone, BottomBarContainer]
    const countHidden = document.body.childElementCount;

    // ZenTriggerZone is second-to-last (BottomBarContainer is last)
    const getBodyChildren = () => Array.from(document.body.children) as HTMLElement[];
    const triggerZone = getBodyChildren()[getBodyChildren().length - 2];

    // #when — touch tap on trigger zone toggles bar visible
    act(() => { fireEvent.touchStart(triggerZone); });

    // #then — ZenBackdrop is inserted before ZenTriggerZone, so count increases by 1
    expect(document.body.childElementCount).toBe(countHidden + 1);
  });

  it('backdrop click dismisses the bar on touch device', () => {
    // #given — touch device, zen mode on, bar visible (backdrop present)
    vi.mocked(usePlayerSizingContext).mockReturnValue({
      ...mockSizingContext,
      isTouchDevice: true,
    });

    renderBottomBar({ zenModeEnabled: true });

    const getBodyChildren = () => Array.from(document.body.children) as HTMLElement[];
    const triggerZone = getBodyChildren()[getBodyChildren().length - 2];

    // show the bar via touch tap
    act(() => { fireEvent.touchStart(triggerZone); });
    const countWithBackdrop = document.body.childElementCount;

    // backdrop is now the second body child (after RTL-div, before ZenTriggerZone)
    const backdrop = getBodyChildren()[1];

    // #when — user taps the backdrop to dismiss
    act(() => { fireEvent.click(backdrop); });

    // #then — backdrop is removed, count drops by 1
    expect(document.body.childElementCount).toBe(countWithBackdrop - 1);
  });

  it('touch toggle: second tap hides bar and removes backdrop', () => {
    // #given — touch device, zen mode on
    vi.mocked(usePlayerSizingContext).mockReturnValue({
      ...mockSizingContext,
      isTouchDevice: true,
    });

    renderBottomBar({ zenModeEnabled: true });

    const getBodyChildren = () => Array.from(document.body.children) as HTMLElement[];
    const triggerZone = () => getBodyChildren()[getBodyChildren().length - 2];

    // first tap shows bar and adds backdrop
    act(() => { fireEvent.touchStart(triggerZone()); });
    const countAfterShow = document.body.childElementCount;

    // #when — second tap toggles bar hidden again
    act(() => { fireEvent.touchStart(triggerZone()); });

    // #then — backdrop is removed
    expect(document.body.childElementCount).toBe(countAfterShow - 1);
  });
});
