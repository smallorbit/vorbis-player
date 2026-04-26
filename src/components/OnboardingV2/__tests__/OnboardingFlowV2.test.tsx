import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';

// --- module mocks (hoisted) ---

const mockNext = vi.fn();
const mockBack = vi.fn();
const mockComplete = vi.fn();
const mockSkipAll = vi.fn();

let mockStep = 0;
let mockIsFirst = true;
let mockIsLast = false;
let mockIsDesktop = true;

vi.mock('@/hooks/useOnboardingV2', () => ({
  useOnboardingV2: vi.fn(() => ({
    step: mockStep,
    isFirst: mockIsFirst,
    isLast: mockIsLast,
    next: mockNext,
    back: mockBack,
    complete: mockComplete,
    skipAll: mockSkipAll,
  })),
}));

vi.mock('@/hooks/useIsDesktop', () => ({
  useIsDesktop: vi.fn(() => mockIsDesktop),
}));

// Stub step content panels to keep tests focused on flow logic
vi.mock('@/components/OnboardingV2/steps/OnboardingStepSwipeQueue', () => ({
  OnboardingStepSwipeQueue: () => <div data-testid="step-swipe-queue" />,
}));
vi.mock('@/components/OnboardingV2/steps/OnboardingStepVisualizers', () => ({
  OnboardingStepVisualizers: () => <div data-testid="step-visualizers" />,
}));
vi.mock('@/components/OnboardingV2/steps/OnboardingStepZenMode', () => ({
  OnboardingStepZenMode: () => <div data-testid="step-zen-mode" />,
}));

import { OnboardingFlowV2 } from '../OnboardingFlowV2';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

function renderFlow() {
  return render(
    <Wrapper>
      <OnboardingFlowV2 onConnectProvider={vi.fn()} onBrowseLibrary={vi.fn()} />
    </Wrapper>,
  );
}

describe('OnboardingFlowV2', () => {
  beforeEach(() => {
    mockStep = 0;
    mockIsFirst = true;
    mockIsLast = false;
    mockIsDesktop = true;
    vi.clearAllMocks();
  });

  describe('ARIA root', () => {
    it('has role="region" with aria-label "Get started with Vorbis Player"', () => {
      // #given / #when
      renderFlow();

      // #then
      expect(
        screen.getByRole('region', { name: 'Get started with Vorbis Player' }),
      ).toBeInTheDocument();
    });
  });

  describe('desktop layout (useIsDesktop → true)', () => {
    it('renders 2 progress dots', () => {
      // #given
      mockIsDesktop = true;
      mockStep = 0;

      // #when
      renderFlow();

      // #then
      expect(screen.getAllByRole('tab')).toHaveLength(2);
    });

    it('shows Visualizers step on step 0', () => {
      // #given
      mockIsDesktop = true;
      mockStep = 0;

      // #when
      renderFlow();

      // #then
      expect(screen.getByTestId('step-visualizers')).toBeInTheDocument();
    });

    it('shows ZenMode step on step 1 (desktop only)', () => {
      // #given
      mockIsDesktop = true;
      mockStep = 1;
      mockIsFirst = false;
      mockIsLast = true;

      // #when
      renderFlow();

      // #then
      expect(screen.getByTestId('step-zen-mode')).toBeInTheDocument();
    });

    it('does NOT render SwipeQueue step on desktop', () => {
      // #given — desktop flow is [Visualizers, ZenMode]; SwipeQueue is mobile-only
      mockIsDesktop = true;
      mockStep = 0;

      // #when
      renderFlow();

      // #then
      expect(screen.queryByTestId('step-swipe-queue')).not.toBeInTheDocument();
    });
  });

  describe('mobile layout (useIsDesktop → false)', () => {
    beforeEach(() => { mockIsDesktop = false; });

    it('renders 2 progress dots', () => {
      // #given
      mockStep = 0;

      // #when
      renderFlow();

      // #then
      expect(screen.getAllByRole('tab')).toHaveLength(2);
    });

    it('shows SwipeQueue step on step 0', () => {
      // #given
      mockStep = 0;

      // #when
      renderFlow();

      // #then
      expect(screen.getByTestId('step-swipe-queue')).toBeInTheDocument();
    });

    it('does NOT render ZenMode step on mobile (step 1 is the last mobile step)', () => {
      // #given — step 1 is the last step in the 2-step mobile flow
      mockStep = 1;
      mockIsFirst = false;
      mockIsLast = true;

      // #when
      renderFlow();

      // #then — Visualizers shown, ZenMode absent
      expect(screen.getByTestId('step-visualizers')).toBeInTheDocument();
      expect(screen.queryByTestId('step-zen-mode')).not.toBeInTheDocument();
    });
  });

  describe('next button label', () => {
    it('shows "Next" on non-last steps', () => {
      // #given
      mockIsLast = false;

      // #when
      renderFlow();

      // #then
      expect(screen.queryByRole('button', { name: /get started/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('shows "Get started" on the last step', () => {
      // #given
      mockIsLast = true;

      // #when
      renderFlow();

      // #then
      expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
    });
  });

  describe('back button visibility', () => {
    it('back button is hidden when isFirst=true (step 0)', () => {
      // #given
      mockIsFirst = true;

      // #when
      renderFlow();

      // #then
      expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
    });

    it('back button is visible when isFirst=false (steps 1+)', () => {
      // #given
      mockStep = 1;
      mockIsFirst = false;

      // #when
      renderFlow();

      // #then
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });
  });

  describe('callbacks', () => {
    it('clicking Next on the last step calls complete()', () => {
      // #given
      mockIsLast = true;

      // #when
      renderFlow();
      fireEvent.click(screen.getByRole('button', { name: /get started/i }));

      // #then
      expect(mockComplete).toHaveBeenCalledTimes(1);
    });

    it('clicking Next on a non-last step calls next() — not complete()', () => {
      // #given
      mockIsLast = false;

      // #when
      renderFlow();
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // #then
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockComplete).not.toHaveBeenCalled();
    });

    it('clicking Skip calls skipAll()', () => {
      // #given / #when
      renderFlow();
      fireEvent.click(screen.getByRole('button', { name: /skip/i }));

      // #then
      expect(mockSkipAll).toHaveBeenCalledTimes(1);
    });

    it('clicking Back calls back()', () => {
      // #given
      mockStep = 1;
      mockIsFirst = false;

      // #when
      renderFlow();
      fireEvent.click(screen.getByRole('button', { name: /back/i }));

      // #then
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });
});
