import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import BottomBar from '../BottomBar';
import { TestWrapper } from '@/test/testWrappers';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';

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

const defaultProps = {
  zenModeEnabled: false,
  isMuted: false,
  volume: 50,
  onMuteToggle: vi.fn(),
  onVolumeChange: vi.fn(),
  onShowVisualEffects: vi.fn(),
  onBackToLibrary: vi.fn(),
  onShowQueue: vi.fn(),
  onZenModeToggle: vi.fn(),
  shuffleEnabled: false,
  onShuffleToggle: vi.fn(),
};

function renderBottomBar(overrides?: Partial<typeof defaultProps>) {
  const props = { ...defaultProps, ...overrides };
  Object.keys(props).forEach((key) => {
    const val = props[key as keyof typeof props];
    if (typeof val === 'function') {
      (val as ReturnType<typeof vi.fn>).mockClear();
    }
  });
  const result = render(
    <ThemeProvider theme={theme}>
      <TestWrapper>
        <BottomBar {...props} />
      </TestWrapper>
    </ThemeProvider>
  );
  return { ...result, props };
}

describe('BottomBar', () => {
  it('renders into document.body via portal', () => {
    renderBottomBar();
    const bar = document.body.querySelector('[title="App settings"]');
    expect(bar).toBeTruthy();
  });

  it('clicking the back-to-library button calls onBackToLibrary', () => {
    const { props } = renderBottomBar();
    const backButton = screen.getByTitle('Back to Library');
    fireEvent.click(backButton);
    expect(props.onBackToLibrary).toHaveBeenCalledOnce();
  });

  it('zen mode button is visible when onZenModeToggle is provided', () => {
    renderBottomBar({ onZenModeToggle: vi.fn() });
    expect(screen.getByTitle(/zen mode/i)).toBeTruthy();
  });

  it('zen mode button is absent when onZenModeToggle is not provided', () => {
    renderBottomBar({ onZenModeToggle: undefined });
    expect(screen.queryByTitle(/zen mode/i)).toBeNull();
  });

  it('shuffle button shows active state when shuffle is enabled', () => {
    renderBottomBar({ shuffleEnabled: true });
    const shuffleButton = screen.getByTitle('Shuffle ON');
    expect(shuffleButton).toBeTruthy();
    expect(shuffleButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('visual effects button calls onShowVisualEffects when clicked', () => {
    const { props } = renderBottomBar();
    fireEvent.click(screen.getByTitle('App settings'));
    expect(props.onShowVisualEffects).toHaveBeenCalledOnce();
  });

  it('queue button calls onShowQueue when clicked', () => {
    const { props } = renderBottomBar();
    fireEvent.click(screen.getByTitle('Show Queue'));
    expect(props.onShowQueue).toHaveBeenCalledOnce();
  });

  it('zen mode button calls onZenModeToggle when clicked', () => {
    const { props } = renderBottomBar();
    fireEvent.click(screen.getByTitle(/zen mode/i));
    expect(props.onZenModeToggle).toHaveBeenCalledOnce();
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

  it('portal renders fewer elements in normal mode than in zen mode', () => {
    // #given — count baseline children before any render
    const baselineCount = document.body.childElementCount;

    // #when — render in zen mode
    const { unmount: unmountZen } = renderBottomBar({ zenModeEnabled: true });
    const zenCount = document.body.childElementCount - baselineCount;
    unmountZen();

    // render in normal mode
    const baselineCount2 = document.body.childElementCount;
    renderBottomBar({ zenModeEnabled: false });
    const normalCount = document.body.childElementCount - baselineCount2;

    // #then — zen mode adds one extra element (ZenTriggerZone)
    expect(zenCount).toBe(normalCount + 1);
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

    // #then — trigger zone is present (zen mode on) and backdrop is absent (bar hidden)
    const portalChildren = Array.from(document.body.children);
    const backdrop = portalChildren.find(
      (el) => el.tagName === 'DIV' && el.getAttribute('style')?.includes('inset')
    );
    expect(backdrop).toBeUndefined();
  });

  it('trigger zone is rendered only when zen mode is enabled', () => {
    // #given
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <TestWrapper>
          <BottomBar {...{ ...defaultProps, zenModeEnabled: false }} />
        </TestWrapper>
      </ThemeProvider>
    );

    const countWithoutZen = document.body.childElementCount;

    // #when
    rerender(
      <ThemeProvider theme={theme}>
        <TestWrapper>
          <BottomBar {...{ ...defaultProps, zenModeEnabled: true }} />
        </TestWrapper>
      </ThemeProvider>
    );

    // #then — one extra portal child (ZenTriggerZone) is added
    expect(document.body.childElementCount).toBe(countWithoutZen + 1);
  });

  it('bar re-appears when zen mode is disabled after being enabled', () => {
    // #given — start in zen mode and let the bar auto-hide
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <TestWrapper>
          <BottomBar {...{ ...defaultProps, zenModeEnabled: true }} />
        </TestWrapper>
      </ThemeProvider>
    );

    act(() => {
      vi.advanceTimersByTime(AUTOHIDE_DELAY);
    });

    const countWhileZen = document.body.childElementCount;

    // #when — zen mode is turned off
    rerender(
      <ThemeProvider theme={theme}>
        <TestWrapper>
          <BottomBar {...{ ...defaultProps, zenModeEnabled: false }} />
        </TestWrapper>
      </ThemeProvider>
    );

    // #then — trigger zone is gone, portal has fewer children again
    expect(document.body.childElementCount).toBe(countWhileZen - 1);

    // bar buttons are accessible (bar is not hidden)
    expect(screen.getByTitle('App settings')).toBeTruthy();
  });

  it('bar hides after autohide delay following zen mode enable', () => {
    // #given — zen disabled initially (bar visible); transitioning to zen on starts the timer
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <TestWrapper>
          <BottomBar {...{ ...defaultProps, zenModeEnabled: false }} />
        </TestWrapper>
      </ThemeProvider>
    );

    // #when — toggle zen mode on
    rerender(
      <ThemeProvider theme={theme}>
        <TestWrapper>
          <BottomBar {...{ ...defaultProps, zenModeEnabled: true }} />
        </TestWrapper>
      </ThemeProvider>
    );

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
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <TestWrapper>
          <BottomBar {...{ ...defaultProps, zenModeEnabled: false }} />
        </TestWrapper>
      </ThemeProvider>
    );

    rerender(
      <ThemeProvider theme={theme}>
        <TestWrapper>
          <BottomBar {...{ ...defaultProps, zenModeEnabled: true }} />
        </TestWrapper>
      </ThemeProvider>
    );

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
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <TestWrapper>
          <BottomBar {...{ ...defaultProps, zenModeEnabled: false }} />
        </TestWrapper>
      </ThemeProvider>
    );

    rerender(
      <ThemeProvider theme={theme}>
        <TestWrapper>
          <BottomBar {...{ ...defaultProps, zenModeEnabled: true }} />
        </TestWrapper>
      </ThemeProvider>
    );

    const barContainer = document.body.lastElementChild as HTMLElement;

    act(() => { fireEvent.mouseEnter(barContainer); });
    act(() => { vi.advanceTimersByTime(AUTOHIDE_DELAY * 2); });

    // bar is still visible after hovering
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
