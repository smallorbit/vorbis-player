import React from 'react';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { Root, Art, TextStack, TrackName, ArtistName, CollectionName, ResumeButton } from './ResumeHero.styled';

export interface ResumeHeroProps {
  session: SessionSnapshot;
  onResume: () => void;
}

const ResumeHero: React.FC<ResumeHeroProps> = ({ session, onResume }) => {
  const title = session.trackTitle ?? session.collectionName;
  return (
    <Root data-testid="library-section-resume" aria-label={`Resume ${title}`}>
      <Art>
        {session.trackImage ? (
          <img src={session.trackImage} alt="" loading="lazy" />
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>♪</span>
        )}
      </Art>
      <TextStack>
        <TrackName>{title}</TrackName>
        {session.trackArtist && <ArtistName>{session.trackArtist}</ArtistName>}
        <CollectionName>{session.collectionName}</CollectionName>
      </TextStack>
      <ResumeButton type="button" onClick={onResume} data-testid="library-resume-button">
        Resume
      </ResumeButton>
    </Root>
  );
};

ResumeHero.displayName = 'ResumeHero';
export default ResumeHero;
