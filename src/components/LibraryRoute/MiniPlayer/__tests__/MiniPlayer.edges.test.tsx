/**
 * Edge-case tests for MiniPlayer beyond the baseline coverage in MiniPlayer.test.tsx.
 *
 * Covers:
 *  - Re-render swap when currentTrack changes mid-mount
 *  - Missing track.image → no <img>, placeholder ArtFrame still mounts
 *  - Missing / empty track.artists → graceful empty subtitle, no crash
 *  - Semantic <button> tap-target + control buttons (keyboard-activatable)
 *  - isRadioGenerating disabled→enabled transition + click after re-enable
 */

import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import type { MediaTrack } from '@/types/domain';

const { mockCurrentTrack } = vi.hoisted(() => ({
  mockCurrentTrack: vi.fn<[], { currentTrack: MediaTrack | null }>(),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useCurrentTrackContext: () => mockCurrentTrack(),
}));

import MiniPlayer, { type MiniPlayerProps } from '../MiniPlayer';

function makeTrack(overrides: Partial<MediaTrack> = {}): MediaTrack {
  return {
    id: 't1',
    name: 'Track A',
    artists: 'Artist A',
    duration_ms: 1000,
    image: 'https://example.com/a.png',
    provider: 'spotify',
    uri: 'spotify:track:t1',
    ...overrides,
  } as MediaTrack;
}

function defaultProps(overrides: Partial<MiniPlayerProps> = {}): MiniPlayerProps {
  return {
    isPlaying: false,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onExpand: vi.fn(),
    ...overrides,
  };
}

function renderMP(propsOverrides: Partial<MiniPlayerProps> = {}) {
  const props = defaultProps(propsOverrides);
  const result = render(
    <ThemeProvider theme={theme}>
      <MiniPlayer {...props} />
    </ThemeProvider>,
  );
  return { ...result, props };
}

describe('MiniPlayer edges', () => {
  beforeEach(() => {
    mockCurrentTrack.mockReset();
  });

  describe('currentTrack re-render', () => {
    it('swaps title / artist / image when currentTrack changes', () => {
      // #given — track A mounted
      const trackA = makeTrack({
        id: 'a',
        name: 'Track A',
        artists: 'Artist A',
        image: 'https://example.com/a.png',
      });
      const trackB = makeTrack({
        id: 'b',
        name: 'Track B',
        artists: 'Artist B',
        image: 'https://example.com/b.png',
      });

      // Drive re-render via a parent with a counter, so memoized MiniPlayer still
      // re-evaluates the mocked context call (mock isn't a real React context).
      function Harness() {
        const [, force] = useState(0);
        // expose force via window for the test
        (Harness as unknown as { rerender?: () => void }).rerender = () =>
          force((n) => n + 1);
        return <MiniPlayer {...defaultProps()} />;
      }

      mockCurrentTrack.mockReturnValue({ currentTrack: trackA });
      render(
        <ThemeProvider theme={theme}>
          <Harness />
        </ThemeProvider>,
      );

      // #then — track A visible
      expect(screen.getByText('Track A')).toBeInTheDocument();
      expect(screen.getByText('Artist A')).toBeInTheDocument();
      expect(screen.getByRole('img')).toHaveAttribute(
        'src',
        'https://example.com/a.png',
      );

      // #when — context now returns track B; force re-render
      mockCurrentTrack.mockReturnValue({ currentTrack: trackB });
      act(() => {
        (Harness as unknown as { rerender: () => void }).rerender();
      });

      // #then — track B replaces track A in same mount
      expect(screen.getByText('Track B')).toBeInTheDocument();
      expect(screen.getByText('Artist B')).toBeInTheDocument();
      expect(screen.queryByText('Track A')).toBeNull();
      expect(screen.getByRole('img')).toHaveAttribute(
        'src',
        'https://example.com/b.png',
      );
    });
  });

  describe('missing fields', () => {
    it('renders no <img> when track.image is missing', () => {
      // #given — track with no image
      mockCurrentTrack.mockReturnValue({
        currentTrack: makeTrack({ image: undefined as unknown as string }),
      });

      // #when
      renderMP();

      // #then — root + pulse dot present, but no <img> tag rendered
      expect(screen.getByTestId('library-mini-player')).toBeInTheDocument();
      expect(screen.getByTestId('mini-pulse-dot')).toBeInTheDocument();
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('renders no <img> when track.image is empty string', () => {
      // #given
      mockCurrentTrack.mockReturnValue({
        currentTrack: makeTrack({ image: '' }),
      });

      // #when
      renderMP();

      // #then — falsy image short-circuits to undefined → MiniArt skips <img>
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('renders empty Artist subtitle when track.artists is missing', () => {
      // #given
      mockCurrentTrack.mockReturnValue({
        currentTrack: makeTrack({
          name: 'Solo Track',
          artists: undefined as unknown as string,
        }),
      });

      // #when
      renderMP();

      // #then — title renders, no crash; artists fallback to ''
      expect(screen.getByText('Solo Track')).toBeInTheDocument();
      const root = screen.getByTestId('library-mini-player');
      expect(root.textContent).toContain('Solo Track');
      // Artist node should be empty (no artist text leaks through)
      expect(screen.queryByText('Artist A')).toBeNull();
    });

    it('renders empty Title when track.name is missing', () => {
      // #given — name missing, artist present
      mockCurrentTrack.mockReturnValue({
        currentTrack: makeTrack({
          name: undefined as unknown as string,
          artists: 'Lone Artist',
        }),
      });

      // #when
      renderMP();

      // #then — no crash; artist renders; aria-label falls back to 'Now playing' image alt
      expect(screen.getByText('Lone Artist')).toBeInTheDocument();
      const expandBtn = screen.getByTestId('mini-expand');
      expect(expandBtn.getAttribute('aria-label')).toBe('Expand player — ');
    });
  });

  describe('semantic markup (keyboard a11y baseline)', () => {
    it('tap-target is a real <button>', () => {
      // #given
      mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });

      // #when
      renderMP();

      // #then — semantic <button> means browsers natively activate on Enter / Space
      // (jsdom does not synthesize this, so we lock the structural guarantee.)
      const expandBtn = screen.getByTestId('mini-expand');
      expect(expandBtn.tagName).toBe('BUTTON');
      expect(expandBtn.getAttribute('type')).toBe('button');
    });

    it('all control buttons are real <button> elements', () => {
      // #given
      mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });

      // #when
      renderMP({
        isRadioAvailable: true,
        onStartRadio: vi.fn(),
      });

      // #then — every control is a <button> (so Tab / Enter / Space work natively)
      for (const tid of ['mini-prev', 'mini-play-pause', 'mini-next', 'mini-radio']) {
        const el = screen.getByTestId(tid);
        expect(el.tagName).toBe('BUTTON');
        expect(el.getAttribute('type')).toBe('button');
      }
    });

    it('clicking the tap-target button fires onExpand (keyboard activation simulated by click)', () => {
      // #given — when a button is focused and Enter is pressed, browsers synthesize a
      // click event. jsdom doesn't, so we assert via fireEvent.click which IS what
      // the browser dispatches in response to Enter / Space on a focused <button>.
      mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });
      const onExpand = vi.fn();

      // #when
      renderMP({ onExpand });
      const btn = screen.getByTestId('mini-expand');
      btn.focus();
      fireEvent.click(btn);

      // #then
      expect(onExpand).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(btn);
    });
  });

  describe('isRadioGenerating transition', () => {
    it('disables radio button while generating, then re-enables and fires on click', () => {
      // #given — radio available, currently generating
      mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });
      const onStartRadio = vi.fn();

      const baseProps: MiniPlayerProps = defaultProps({
        isRadioAvailable: true,
        isRadioGenerating: true,
        onStartRadio,
      });

      const { rerender } = render(
        <ThemeProvider theme={theme}>
          <MiniPlayer {...baseProps} />
        </ThemeProvider>,
      );

      const btn = screen.getByTestId('mini-radio') as HTMLButtonElement;

      // #then — disabled while generating
      expect(btn.disabled).toBe(true);

      // #when — click while disabled has no effect (browser blocks; jsdom blocks too)
      fireEvent.click(btn);
      expect(onStartRadio).not.toHaveBeenCalled();

      // #when — generating flips to false
      rerender(
        <ThemeProvider theme={theme}>
          <MiniPlayer {...baseProps} isRadioGenerating={false} />
        </ThemeProvider>,
      );

      // #then — button re-enabled
      const reEnabled = screen.getByTestId('mini-radio') as HTMLButtonElement;
      expect(reEnabled.disabled).toBe(false);

      // #when — click after re-enable
      fireEvent.click(reEnabled);

      // #then — handler fires exactly once for the post-enable click
      expect(onStartRadio).toHaveBeenCalledTimes(1);
    });

    it('updates aria-label as isRadioGenerating flips', () => {
      // #given
      mockCurrentTrack.mockReturnValue({ currentTrack: makeTrack() });
      const baseProps: MiniPlayerProps = defaultProps({
        isRadioAvailable: true,
        isRadioGenerating: true,
        onStartRadio: vi.fn(),
      });

      const { rerender } = render(
        <ThemeProvider theme={theme}>
          <MiniPlayer {...baseProps} />
        </ThemeProvider>,
      );

      // #then — generating label
      expect(
        screen.getByLabelText('Generating radio playlist'),
      ).toBeInTheDocument();

      // #when — flip to not generating
      rerender(
        <ThemeProvider theme={theme}>
          <MiniPlayer {...baseProps} isRadioGenerating={false} />
        </ThemeProvider>,
      );

      // #then — idle label
      expect(
        screen.getByLabelText('Start radio from current track'),
      ).toBeInTheDocument();
    });
  });
});
