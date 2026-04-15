import React from 'react';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import {
  ResumeCardRoot,
  ResumeArt,
  ResumeText,
  ResumeTrackName,
  ResumeCollectionName,
  ResumePlayButton,
} from './styled';

interface ResumeCardProps {
  session: SessionSnapshot;
  onResume: () => void;
}

const ResumeCard: React.FC<ResumeCardProps> = ({ session, onResume }) => (
  <ResumeCardRoot
    type="button"
    onClick={onResume}
    aria-label={`Resume: ${session.trackTitle ?? session.collectionName}`}
  >
    <ResumeArt>
      {session.trackImage ? (
        <img src={session.trackImage} alt={session.collectionName} loading="lazy" />
      ) : (
        <span style={{ fontSize: '1.2rem' }}>♪</span>
      )}
    </ResumeArt>
    <ResumeText>
      <ResumeTrackName>{session.trackTitle ?? session.collectionName}</ResumeTrackName>
      <ResumeCollectionName>{session.collectionName}</ResumeCollectionName>
    </ResumeText>
    <ResumePlayButton aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
    </ResumePlayButton>
  </ResumeCardRoot>
);

export default ResumeCard;
