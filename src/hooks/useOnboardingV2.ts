import { useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useWelcomeSeen } from '@/hooks/useWelcomeSeen';

export const ONBOARDING_V2_STEP_KEY = 'vorbis-player-onboarding-v2-step';

export interface UseOnboardingV2Result {
  step: number;
  isFirst: boolean;
  isLast: boolean;
  next: () => void;
  back: () => void;
  complete: () => void;
  skipAll: () => void;
}

export function useOnboardingV2(totalSteps: number): UseOnboardingV2Result {
  const [persistedStep, setPersistedStep] = useLocalStorage<number>(ONBOARDING_V2_STEP_KEY, 0);
  const [, setWelcomeSeen] = useWelcomeSeen();

  const maxIndex = Math.max(totalSteps - 1, 0);
  const step = Math.min(Math.max(persistedStep, 0), maxIndex);

  const next = useCallback(() => {
    setPersistedStep((s) => Math.min(s + 1, maxIndex));
  }, [setPersistedStep, maxIndex]);

  const back = useCallback(() => {
    setPersistedStep((s) => Math.max(s - 1, 0));
  }, [setPersistedStep]);

  const complete = useCallback(() => {
    setWelcomeSeen(true);
    setPersistedStep(0);
  }, [setWelcomeSeen, setPersistedStep]);

  const skipAll = useCallback(() => {
    setWelcomeSeen(true);
    setPersistedStep(0);
  }, [setWelcomeSeen, setPersistedStep]);

  return {
    step,
    isFirst: step === 0,
    isLast: step === maxIndex,
    next,
    back,
    complete,
    skipAll,
  };
}
