import React from 'react';
import {
  StepContent,
  StepIllustration,
  StepTitle,
  StepDescription,
  SwipeCardMock,
} from '../styled';

export const OnboardingStepSwipeQueue: React.FC = () => (
  <StepContent>
    <StepIllustration aria-hidden="true">
      <SwipeCardMock />
    </StepIllustration>
    <StepTitle>Swipe to explore your queue</StepTitle>
    <StepDescription>
      Swipe right on the player to open your play queue. Reorder tracks, jump
      ahead, or clear what's coming up.
    </StepDescription>
  </StepContent>
);
