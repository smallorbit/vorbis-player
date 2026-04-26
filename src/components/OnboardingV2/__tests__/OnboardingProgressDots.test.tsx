import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { OnboardingProgressDots } from '../OnboardingProgressDots';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('OnboardingProgressDots', () => {
  it('renders the correct number of dots', () => {
    // #given / #when
    render(
      <Wrapper>
        <OnboardingProgressDots total={3} current={0} />
      </Wrapper>,
    );

    // #then
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('marks the current dot with aria-selected=true', () => {
    // #given / #when
    render(
      <Wrapper>
        <OnboardingProgressDots total={3} current={1} />
      </Wrapper>,
    );

    // #then
    const dots = screen.getAllByRole('tab');
    expect(dots[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('marks all other dots with aria-selected=false', () => {
    // #given / #when
    render(
      <Wrapper>
        <OnboardingProgressDots total={3} current={1} />
      </Wrapper>,
    );

    // #then
    const dots = screen.getAllByRole('tab');
    expect(dots[0]).toHaveAttribute('aria-selected', 'false');
    expect(dots[2]).toHaveAttribute('aria-selected', 'false');
  });

  it('renders role="tablist" on the container', () => {
    // #given / #when
    render(
      <Wrapper>
        <OnboardingProgressDots total={3} current={0} />
      </Wrapper>,
    );

    // #then
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('renders role="tab" on every dot', () => {
    // #given / #when
    render(
      <Wrapper>
        <OnboardingProgressDots total={4} current={2} />
      </Wrapper>,
    );

    // #then
    const dots = screen.getAllByRole('tab');
    expect(dots).toHaveLength(4);
    dots.forEach((dot) => expect(dot).toHaveAttribute('role', 'tab'));
  });

  it('marks dot 0 as selected when current=0', () => {
    // #given / #when
    render(
      <Wrapper>
        <OnboardingProgressDots total={2} current={0} />
      </Wrapper>,
    );

    // #then
    const dots = screen.getAllByRole('tab');
    expect(dots[0]).toHaveAttribute('aria-selected', 'true');
    expect(dots[1]).toHaveAttribute('aria-selected', 'false');
  });
});
