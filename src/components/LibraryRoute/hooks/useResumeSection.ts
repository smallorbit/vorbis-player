import { isSessionStale, type SessionSnapshot } from '@/services/sessionPersistence';

interface UseResumeSectionParams {
  lastSession: SessionSnapshot | null;
}

interface ResumeSectionState {
  session: SessionSnapshot | null;
  hasResumable: boolean;
}

export function useResumeSection({ lastSession }: UseResumeSectionParams): ResumeSectionState {
  const hasResumable = !!lastSession && !isSessionStale(lastSession);
  return {
    session: hasResumable ? lastSession : null,
    hasResumable,
  };
}
