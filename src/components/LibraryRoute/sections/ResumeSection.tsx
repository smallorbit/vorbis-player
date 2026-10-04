import React from 'react';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { useResumeSection } from '../hooks';
import ResumeHero from '@/components/ResumeHero';

interface ResumeSectionProps {
  lastSession: SessionSnapshot | null;
  onResume?: (() => void) | undefined;
}

const ResumeSection: React.FC<ResumeSectionProps> = ({ lastSession, onResume }) => {
  const { session, hasResumable } = useResumeSection({ lastSession });
  if (!hasResumable || !session || !onResume) return null;
  return <ResumeHero session={session} onResume={onResume} variant="library" />;
};

ResumeSection.displayName = 'ResumeSection';
export default ResumeSection;
