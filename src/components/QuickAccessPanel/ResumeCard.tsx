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

const ResumeCard: React.FC<ResumeCardProps> = ({ session, onResume }) => {
  const currentTrack = session.tracks[session.currentTrackIndex] ?? session.tracks[0];

  if (!currentTrack) return null;

  return (
    <ResumeCardRoot onClick={onResume} aria-label={`Resume: ${currentTrack.name}`}>
      <ResumeArt>
        {currentTrack.image ? (
          <img src={currentTrack.image} alt={currentTrack.album} loading="lazy" />
        ) : (
          <span style={{ fontSize: '1.2rem' }}>♪</span>
        )}
      </ResumeArt>
      <ResumeText>
        <ResumeTrackName>{currentTrack.name}</ResumeTrackName>
        <ResumeCollectionName>{session.collectionName}</ResumeCollectionName>
      </ResumeText>
      <ResumeLabel>Resume</ResumeLabel>
    </ResumeCardRoot>
  );
};

export default ResumeCard;
