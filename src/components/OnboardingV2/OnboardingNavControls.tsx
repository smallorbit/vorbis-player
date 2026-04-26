import React from 'react';
import {
  BackButton,
  NavRow,
  NavSpacer,
  NextButton,
  SkipButton,
} from './styled';

export interface OnboardingNavControlsProps {
  isFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export const OnboardingNavControls: React.FC<OnboardingNavControlsProps> = ({
  isFirst,
  isLast,
  onBack,
  onNext,
  onSkip,
}) => (
  <NavRow>
    {isFirst ? (
      <NavSpacer />
    ) : (
      <BackButton type="button" onClick={onBack}>
        Back
      </BackButton>
    )}
    <SkipButton type="button" onClick={onSkip}>
      Skip
    </SkipButton>
    <NextButton type="button" onClick={onNext}>
      {isLast ? 'Get started' : 'Next'}
    </NextButton>
  </NavRow>
);
