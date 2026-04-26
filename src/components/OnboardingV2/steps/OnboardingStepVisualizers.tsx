import React from 'react';
import {
  StepContent,
  StepIllustration,
  StepTitle,
  StepDescription,
  BarGroup,
  Bar,
} from '../styled';

export const OnboardingStepVisualizers: React.FC = () => (
  <StepContent>
    <StepIllustration aria-hidden="true">
      <BarGroup>
        <Bar $delay={0} style={{ height: '32px' }} />
        <Bar $delay={80} style={{ height: '40px' }} />
        <Bar $delay={160} style={{ height: '24px' }} />
      </BarGroup>
      <BarGroup style={{ marginLeft: '12px' }}>
        <Bar $delay={40} style={{ height: '44px' }} />
        <Bar $delay={120} style={{ height: '28px' }} />
        <Bar $delay={200} style={{ height: '36px' }} />
      </BarGroup>
      <BarGroup style={{ marginLeft: '12px' }}>
        <Bar $delay={20} style={{ height: '38px' }} />
        <Bar $delay={100} style={{ height: '48px' }} />
        <Bar $delay={180} style={{ height: '20px' }} />
      </BarGroup>
    </StepIllustration>
    <StepTitle>Set the mood with visualizers</StepTitle>
    <StepDescription>
      Choose a background visual effect from the menu. Waveforms, particles,
      and gradients respond to your music in real time.
    </StepDescription>
  </StepContent>
);
