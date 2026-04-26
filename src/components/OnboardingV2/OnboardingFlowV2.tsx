import React, { useCallback } from 'react';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useOnboardingV2 } from '@/hooks/useOnboardingV2';
import { OnboardingNavControls } from './OnboardingNavControls';
import { OnboardingProgressDots } from './OnboardingProgressDots';
import { OnboardingStepSwipeQueue } from './steps/OnboardingStepSwipeQueue';
import { OnboardingStepVisualizers } from './steps/OnboardingStepVisualizers';
import { OnboardingStepZenMode } from './steps/OnboardingStepZenMode';
import {
  OnboardingContent,
  OnboardingRoot,
  StepContent,
} from './styled';

export interface OnboardingFlowV2Props {
  onConnectProvider: () => void;
  onBrowseLibrary: () => void;
}

const OnboardingFlowV2Component: React.FC<OnboardingFlowV2Props> = () => {
  const isDesktop = useIsDesktop();
  const steps = isDesktop
    ? [<OnboardingStepVisualizers />, <OnboardingStepZenMode />]
    : [<OnboardingStepSwipeQueue />, <OnboardingStepVisualizers />];
  const totalSteps = steps.length;
  const { step, isFirst, isLast, next, back, complete, skipAll } =
    useOnboardingV2(totalSteps);

  const handleNext = useCallback(() => {
    if (isLast) {
      complete();
    } else {
      next();
    }
  }, [isLast, complete, next]);

  const stepContent = steps[step] ?? null;

  return (
    <OnboardingRoot role="region" aria-label="Get started with Vorbis Player">
      <OnboardingContent>
        <OnboardingProgressDots total={totalSteps} current={step} />
        <StepContent key={step}>{stepContent}</StepContent>
        <OnboardingNavControls
          isFirst={isFirst}
          isLast={isLast}
          onBack={back}
          onNext={handleNext}
          onSkip={skipAll}
        />
      </OnboardingContent>
    </OnboardingRoot>
  );
};

export const OnboardingFlowV2 = React.memo(OnboardingFlowV2Component);
