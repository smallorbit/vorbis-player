import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { OnboardingNavControls } from '../OnboardingNavControls';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

function renderControls(props: Partial<{
  isFirst: boolean;
  isLast: boolean;
  onSkip: () => void;
  onBack: () => void;
  onNext: () => void;
}> = {}) {
  const onSkip = props.onSkip ?? vi.fn();
  const onBack = props.onBack ?? vi.fn();
  const onNext = props.onNext ?? vi.fn();

  render(
    <Wrapper>
      <OnboardingNavControls
        isFirst={props.isFirst ?? false}
        isLast={props.isLast ?? false}
        onSkip={onSkip}
        onBack={onBack}
        onNext={onNext}
      />
    </Wrapper>,
  );

  return { onSkip, onBack, onNext };
}

describe('OnboardingNavControls', () => {
  describe('back affordance', () => {
    it('renders a spacer (no back button) when isFirst=true', () => {
      // #given / #when
      renderControls({ isFirst: true });

      // #then
      expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
    });

    it('renders the Back button when isFirst=false', () => {
      // #given / #when
      renderControls({ isFirst: false });

      // #then
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });
  });

  describe('next button label', () => {
    it('shows "Get started" when isLast=true', () => {
      // #given / #when
      renderControls({ isLast: true });

      // #then
      expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
    });

    it('shows "Next" when isLast=false', () => {
      // #given / #when
      renderControls({ isLast: false });

      // #then — no "get started", a "next" button is present
      expect(screen.queryByRole('button', { name: /get started/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });
  });

  describe('callbacks', () => {
    it('calls onSkip when the Skip button is clicked', () => {
      // #given
      const { onSkip } = renderControls({});

      // #when
      fireEvent.click(screen.getByRole('button', { name: /skip/i }));

      // #then
      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onBack when the Back button is clicked', () => {
      // #given
      const { onBack } = renderControls({ isFirst: false });

      // #when
      fireEvent.click(screen.getByRole('button', { name: /back/i }));

      // #then
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('calls onNext when the Next button is clicked', () => {
      // #given
      const { onNext } = renderControls({ isLast: false });

      // #when
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // #then
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('calls onNext when "Get started" is clicked (last step)', () => {
      // #given
      const { onNext } = renderControls({ isLast: true });

      // #when
      fireEvent.click(screen.getByRole('button', { name: /get started/i }));

      // #then
      expect(onNext).toHaveBeenCalledTimes(1);
    });
  });
});
