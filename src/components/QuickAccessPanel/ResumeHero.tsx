import React from 'react';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import {
  ResumeHeroSection,
  ResumeHeroArt,
  ResumeHeroText,
  ResumeHeroEyebrow,
  ResumeHeroTitle,
  ResumeHeroSubtitle,
  ResumeHeroButton,
} from './styled';

interface ResumeHeroProps {
  session: SessionSnapshot;
  onResume: () => void;
}

const ResumeHero: React.FC<ResumeHeroProps> = ({ session, onResume }) => {
  const title = session.trackTitle ?? session.collectionName;
  const subtitleParts = [session.trackArtist, session.collectionName].filter(Boolean);
  const subtitle = subtitleParts.join(' • ') || session.collectionName;

  return (
    <ResumeHeroSection aria-labelledby="qap-resume-hero-title">
      <ResumeHeroArt>
        {session.trackImage ? (
          <img src={session.trackImage} alt="" loading="lazy" />
        ) : (
          <span aria-hidden="true">♪</span>
        )}
      </ResumeHeroArt>
      <ResumeHeroText>
        <ResumeHeroEyebrow>Pick up where you left off</ResumeHeroEyebrow>
        <ResumeHeroTitle id="qap-resume-hero-title">{title}</ResumeHeroTitle>
        <ResumeHeroSubtitle>{subtitle}</ResumeHeroSubtitle>
      </ResumeHeroText>
      <ResumeHeroButton
        type="button"
        onClick={onResume}
        aria-label={`Resume ${title}`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
        Resume
      </ResumeHeroButton>
    </ResumeHeroSection>
  );
};

export default ResumeHero;
