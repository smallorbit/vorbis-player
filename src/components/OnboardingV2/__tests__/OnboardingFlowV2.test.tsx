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
      <OnboardingFlowV2 />
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
    it('has aria-label "Get started with Vorbis Player" on the root element', () => {
      // #given / #when
      renderFlow();

      // #then
      const root = document.querySelector('[aria-label="Get started with Vorbis Player"]');
      expect(root).not.toBeNull();
    });
  });

  describe('desktop layout (useIsDesktop → true)', () => {
    it('renders 3 progress dots', () => {
      // #given
      mockIsDesktop = true;

      // #when
      renderFlow();

      // #then
      expect(screen.getAllByRole('tab')).toHaveLength(3);
    });

    it('renders all 3 step panels including ZenMode', () => {
      // #given
      mockIsDesktop = true;

      // #when
      renderFlow();

      // #then
      expect(screen.getByTestId('step-swipe-queue')).toBeInTheDocument();
      expect(screen.getByTestId('step-visualizers')).toBeInTheDocument();
      expect(screen.getByTestId('step-zen-mode')).toBeInTheDocument();
    });
  });

  describe('mobile layout (useIsDesktop → false)', () => {
    beforeEach(() => { mockIsDesktop = false; });

    it('renders 2 progress dots', () => {
      // #given / #when
      renderFlow();

      // #then
      expect(screen.getAllByRole('tab')).toHaveLength(2);
    });

    it('renders 2 step panels (SwipeQueue + Visualizers)', () => {
      // #given / #when
      renderFlow();

      // #then
      expect(screen.getByTestId('step-swipe-queue')).toBeInTheDocument();
      expect(screen.getByTestId('step-visualizers')).toBeInTheDocument();
    });

    it('does NOT render the ZenMode step', () => {
      // #given / #when
      renderFlow();

      // #then
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
    it('back button is hidden on step 0 (isFirst=true)', () => {
      // #given
      mockIsFirst = true;

      // #when
      renderFlow();

      // #then
      expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
    });

    it('back button is visible on steps after the first (isFirst=false)', () => {
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
