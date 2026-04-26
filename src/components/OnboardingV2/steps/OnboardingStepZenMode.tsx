import React from 'react';
import {
  StepContent,
  StepIllustration,
  StepTitle,
  StepDescription,
  ZenMockScreen,
  ZenMockAlbumArt,
  ZenKbdBadge,
} from '../styled';

export const OnboardingStepZenMode: React.FC = () => (
  <StepContent>
    <StepIllustration aria-hidden="true">
      <ZenMockScreen>
        <ZenMockAlbumArt />
        <ZenKbdBadge>Z</ZenKbdBadge>
      </ZenMockScreen>
    </StepIllustration>
    <StepTitle>Go full-screen with Zen mode</StepTitle>
    <StepDescription>
      Press Z or click the Zen icon to enter a distraction-free view. Perfect
      for ambient listening.
    </StepDescription>
  </StepContent>
);
