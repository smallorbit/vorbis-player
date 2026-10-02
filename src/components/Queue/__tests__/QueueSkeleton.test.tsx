import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { theme } from '@/styles/theme';
import QueueSkeleton from '../QueueSkeleton';

// QueueSkeleton is a pure presentation component — it only needs ThemeProvider.
// TestWrapper is intentionally avoided here because it pulls in ProviderProvider
// (→ Spotify adapter → spotifyPlayer singleton) and PlayerSizingProvider
// (→ CSS.supports), both of which require heavy mocking and OOM in isolation.
// This matches the pattern used by QueueDrawer.test.tsx.
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

const makeMatchMedia = (reducedMotion: boolean) =>
  vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

describe('QueueSkeleton', () => {
  beforeEach(() => {
    // jsdom does not implement matchMedia; provide a stub so useReducedMotion can run
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: makeMatchMedia(false),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rowCount prop', () => {
    it('renders the default 6 rows when rowCount is omitted', () => {
      // #when
      render(<Wrapper><QueueSkeleton /></Wrapper>);

      // #then
      expect(screen.getAllByTestId('queue-skeleton-row')).toHaveLength(6);
    });

    it('renders the exact number of rows supplied via rowCount', () => {
      // #when
      render(<Wrapper><QueueSkeleton rowCount={4} /></Wrapper>);

      // #then
      expect(screen.getAllByTestId('queue-skeleton-row')).toHaveLength(4);
    });

    it('renders 0 rows when rowCount={0}', () => {
      // #when
      render(<Wrapper><QueueSkeleton rowCount={0} /></Wrapper>);

      // #then
      expect(screen.queryAllByTestId('queue-skeleton-row')).toHaveLength(0);
    });

    it('renders 0 rows when rowCount is negative', () => {
      // #when
      render(<Wrapper><QueueSkeleton rowCount={-3} /></Wrapper>);

      // #then
      expect(screen.queryAllByTestId('queue-skeleton-row')).toHaveLength(0);
    });

    it('floors a fractional rowCount', () => {
      // #given
      const fractional = 3.9;

      // #when
      render(<Wrapper><QueueSkeleton rowCount={fractional} /></Wrapper>);

      // #then
      expect(screen.getAllByTestId('queue-skeleton-row')).toHaveLength(3);
    });
  });

  describe('prefers-reduced-motion', () => {
    // note: jsdom does not apply CSS @media queries, so pseudo-element visibility
    // (::after { display: none }) cannot be verified via getComputedStyle.
    // Instead we (a) check the matchMedia-driven data-animated attribute the
    // component exposes, and (b) confirm the CSS media-query block is injected
    // so real browsers will suppress the shimmer animation.

    it('sets data-animated="true" on every row when no motion preference is set', () => {
      // #given — no reduced-motion preference (default beforeEach)

      // #when
      render(<Wrapper><QueueSkeleton rowCount={3} /></Wrapper>);

      // #then
      screen.getAllByTestId('queue-skeleton-row').forEach((row) => {
        expect(row).toHaveAttribute('data-animated', 'true');
      });
    });

    it('sets data-animated="false" on every row when prefers-reduced-motion: reduce is active', () => {
      // #given
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: makeMatchMedia(true),
      });

      // #when
      render(<Wrapper><QueueSkeleton rowCount={3} /></Wrapper>);

      // #then
      screen.getAllByTestId('queue-skeleton-row').forEach((row) => {
        expect(row).toHaveAttribute('data-animated', 'false');
      });
    });

    it('injects a @media (prefers-reduced-motion: reduce) block into the document styles', () => {
      // #when
      render(<Wrapper><QueueSkeleton rowCount={2} /></Wrapper>);

      // #then — real browsers use this rule to suppress the shimmer ::after
      const injectedCss = Array.from(document.head.querySelectorAll('style'))
        .map((s) => s.textContent ?? '')
        .join('');
      expect(injectedCss).toContain('prefers-reduced-motion');
    });
  });

  describe('accessibility', () => {
    it('marks the root container as aria-busy while loading', () => {
      // #when
      render(<Wrapper><QueueSkeleton rowCount={3} /></Wrapper>);

      // #then
      expect(screen.getByTestId('queue-skeleton')).toHaveAttribute('aria-busy', 'true');
    });

    it('sets aria-live="polite" on the root container', () => {
      // #when
      render(<Wrapper><QueueSkeleton rowCount={3} /></Wrapper>);

      // #then
      expect(screen.getByTestId('queue-skeleton')).toHaveAttribute('aria-live', 'polite');
    });

    it('marks every skeleton row as aria-hidden to exclude it from the a11y tree', () => {
      // #when
      render(<Wrapper><QueueSkeleton rowCount={3} /></Wrapper>);

      // #then
      screen.getAllByTestId('queue-skeleton-row').forEach((row) => {
        expect(row).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('theme tokens', () => {
    it('renders without throwing when mounted with the project ThemeProvider (proves theme.colors.gray[*] is accessible)', () => {
      // #when / #then — a crash here indicates an invalid theme token reference
      expect(() => {
        render(<Wrapper><QueueSkeleton rowCount={4} /></Wrapper>);
      }).not.toThrow();
    });
  });
});
