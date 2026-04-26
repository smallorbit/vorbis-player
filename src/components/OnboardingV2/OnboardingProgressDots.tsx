import React from 'react';
import { Dot, DotsRow } from './styled';

export interface OnboardingProgressDotsProps {
  total: number;
  current: number;
}

export const OnboardingProgressDots: React.FC<OnboardingProgressDotsProps> = ({
  total,
  current,
}) => (
  <DotsRow role="tablist" aria-label="Onboarding progress">
    {Array.from({ length: total }).map((_, i) => (
      <Dot
        key={i}
        $active={i === current}
        role="tab"
        aria-selected={i === current}
        aria-label={`Step ${i + 1} of ${total}`}
      />
    ))}
  </DotsRow>
);
