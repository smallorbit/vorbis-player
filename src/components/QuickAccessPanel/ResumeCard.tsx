import React from 'react';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import {
  ResumeCardRoot,
  ResumeArt,
  ResumeText,
  ResumeTrackName,
  ResumeCollectionName,
  ResumeLabel,
} from './styled';

interface ResumeCardProps {
  session: SessionSnapshot;
  onResume: () => void;
}

const ResumeCard: React.FC<ResumeCardProps> = ({ session, onResume }) => (
  <ResumeCardRoot onClick={onResume} aria-label={`Resume: ${session.trackTitle ?? session.collectionName}`}>
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
    <ResumeLabel>Resume</ResumeLabel>
  </ResumeCardRoot>
);

export default ResumeCard;
