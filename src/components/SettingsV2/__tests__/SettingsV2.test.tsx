import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { theme } from '@/styles/theme';

const mockUseUiV2 = vi.fn<[], boolean>();
const mockUsePlayerSizingContext = vi.fn<[], { isMobile: boolean }>();

vi.mock('@/hooks/useUiV2', () => ({
  useUiV2: () => mockUseUiV2(),
}));

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: () => mockUsePlayerSizingContext(),
}));

import { SettingsV2 } from '../SettingsV2';
import { SETTINGS_V2_SECTIONS } from '../sections';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

/**
 * jsdom does not update `window.location` from `pushState` (the project's
 * `src/test/setup.ts` mocks `location` as a static object). To assert URL
 * mutations from `useSettingsUrl`, stage `window.location.search` manually
 * before the navigate call — same pattern as `useSettingsUrl.test.ts:80-98`.
 */
function setSearch(search: string): void {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
  });
}

describe('SettingsV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUiV2.mockReturnValue(true);
    mockUsePlayerSizingContext.mockReturnValue({ isMobile: false });
    setSearch('');
  });

  afterEach(() => {
    setSearch('');
  });

  describe('feature gate', () => {
    it('renders nothing when useUiV2 is false', () => {
      // #given
      mockUseUiV2.mockReturnValue(false);

      // #when
      const { container } = render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={vi.fn()} />
        </Wrapper>,
      );

      // #then
      expect(container.querySelector('[data-testid="settings-v2-desktop"]')).toBeNull();
      expect(container.querySelector('[data-testid="settings-v2-mobile"]')).toBeNull();
    });

    it('renders nothing when useUiV2 is true but isOpen is false', () => {
      // #given + #when
      const { container } = render(
        <Wrapper>
          <SettingsV2 isOpen={false} onClose={vi.fn()} />
        </Wrapper>,
      );

      // #then
      expect(container.querySelector('[data-testid="settings-v2-desktop"]')).toBeNull();
    });
  });

  describe('desktop layout', () => {
    it('renders the desktop shell when v2 is on, isOpen is true, and viewport is desktop', () => {
      // #given + #when
      render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={vi.fn()} />
        </Wrapper>,
      );

      // #then
      expect(screen.getByTestId('settings-v2-desktop')).toBeInTheDocument();
    });

    it('exposes all four section labels in the sidebar', () => {
      // #given + #when
      render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={vi.fn()} />
        </Wrapper>,
      );

      // #then
      for (const section of SETTINGS_V2_SECTIONS) {
        expect(screen.getAllByText(section.label).length).toBeGreaterThan(0);
      }
    });

    it('writes ?settings=<id> via pushState when a sidebar item is clicked', () => {
      // #given
      const pushStateSpy = vi.spyOn(window.history, 'pushState');
      render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={vi.fn()} />
        </Wrapper>,
      );

      // #when
      const appearanceButton = screen.getAllByRole('button', { name: 'Appearance' })[0];
      fireEvent.click(appearanceButton);

      // #then
      expect(pushStateSpy).toHaveBeenCalled();
      const lastCall = pushStateSpy.mock.calls[pushStateSpy.mock.calls.length - 1];
      expect(String(lastCall[2])).toContain('settings=appearance');
      pushStateSpy.mockRestore();
    });

    it('deep-links into the section named in ?settings=', () => {
      // #given
      setSearch('?settings=advanced');

      // #when
      render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={vi.fn()} />
        </Wrapper>,
      );

      // #then
      const headings = screen.getAllByText('Advanced');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('renders the desktop shell with the default section when ?settings=open', () => {
      // #given — 'open' is not a valid SettingsV2SectionId; it falls through to DEFAULT_SETTINGS_V2_SECTION ('sources')
      setSearch('?settings=open');

      // #when
      render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={vi.fn()} />
        </Wrapper>,
      );

      // #then — shell renders and shows the default 'Sources' section (not a blank/broken state)
      expect(screen.getByTestId('settings-v2-desktop')).toBeInTheDocument();
      expect(screen.getAllByText('Sources').length).toBeGreaterThan(0);
    });

    // Shift+S open→close round-trip is NOT tested here — the toggle is wired upstream via
    // useKeyboardShortcuts.ts (setShowVisualEffects(prev => !prev)) and belongs in a higher-level
    // integration test or e2e spec, not in this component unit test.
    //
    // Container query behavior at max-width:700px cannot be asserted in jsdom.
    // Defer to Playwright visual coverage.
  });

  describe('mobile takeover', () => {
    beforeEach(() => {
      mockUsePlayerSizingContext.mockReturnValue({ isMobile: true });
    });

    it('renders the mobile takeover when isMobile is true', () => {
      // #given + #when
      render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={vi.fn()} />
        </Wrapper>,
      );

      // #then
      expect(screen.getByTestId('settings-v2-mobile')).toBeInTheDocument();
    });

    it('shows the section list before any section is selected', () => {
      // #given + #when
      render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={vi.fn()} />
        </Wrapper>,
      );

      // #then
      expect(screen.getByLabelText('Settings sections')).toBeInTheDocument();
    });

    it('drills into a section when a row is tapped', () => {
      // #given
      const pushStateSpy = vi.spyOn(window.history, 'pushState');
      render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={vi.fn()} />
        </Wrapper>,
      );

      // #when — staged URL update mirrors what the hook would have produced
      act(() => {
        setSearch('?settings=playback');
        fireEvent.click(screen.getByText('Playback'));
      });

      // #then
      expect(pushStateSpy).toHaveBeenCalled();
      expect(screen.getByLabelText('Back to settings list')).toBeInTheDocument();
      pushStateSpy.mockRestore();
    });
  });

  describe('close gestures', () => {
    it('clears URL state and calls onClose when Esc is pressed', () => {
      // #given — open with a real section in the URL so closeShell has something to clear
      const onClose = vi.fn();
      setSearch('?settings=advanced');
      const pushStateSpy = vi.spyOn(window.history, 'pushState');
      render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={onClose} />
        </Wrapper>,
      );

      // #when — fire keydown WITHOUT pre-emptying the URL; closeShell must do the clearing
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      // #then — onClose called, and the most recent pushState produced a URL without settings=
      expect(onClose).toHaveBeenCalledTimes(1);
      const lastPush = pushStateSpy.mock.calls.at(-1)?.[2];
      expect(String(lastPush ?? '')).not.toContain('settings=');
      pushStateSpy.mockRestore();
    });

    it('calls onClose when the close icon is clicked', () => {
      // #given
      const onClose = vi.fn();
      render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={onClose} />
        </Wrapper>,
      );

      // #when
      fireEvent.click(screen.getByLabelText('Close settings'));

      // #then
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose on browser back-button when settings param disappears', () => {
      // #given
      const onClose = vi.fn();
      setSearch('?settings=appearance');
      render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={onClose} />
        </Wrapper>,
      );

      // #when
      act(() => {
        setSearch('');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      // #then
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when the desktop overlay is clicked', () => {
      // #given
      const onClose = vi.fn();
      render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={onClose} />
        </Wrapper>,
      );

      // #when
      const overlay = document.body.querySelector('[aria-hidden="true"]');
      expect(overlay).not.toBeNull();
      if (overlay) fireEvent.click(overlay);

      // #then
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose exactly once when Esc is pressed — isSelfClosingRef prevents popstate echo', () => {
      // #given — open with a section so closeShell will pushState (which triggers isSelfClosingRef guard)
      const onClose = vi.fn();
      setSearch('?settings=appearance');
      render(
        <Wrapper>
          <SettingsV2 isOpen={true} onClose={onClose} />
        </Wrapper>,
      );

      // #when — Esc fires closeShell; the resulting pushState must not echo back through popstate
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
        // Simulate the browser echoing a popstate after pushState (isSelfClosingRef should absorb it)
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      // #then — onClose called exactly once, not twice
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('z-index invariant', () => {
    it('exports SETTINGS_V2_Z_INDEX = 1405 (above BottomBar modal=1400)', async () => {
      // #given + #when
      const mod = await import('../SettingsV2');

      // #then
      expect(mod.SETTINGS_V2_Z_INDEX).toBe(1405);
      expect(mod.SETTINGS_V2_Z_INDEX).toBeGreaterThan(parseInt(theme.zIndex.modal, 10));
    });
  });
});
