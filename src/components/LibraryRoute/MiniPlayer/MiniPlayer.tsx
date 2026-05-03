import React, { memo } from 'react';
import { useCurrentTrackContext } from '@/contexts/TrackContext';
import MiniArt from './MiniArt';
import MiniControls from './MiniControls';
import {
  Artist,
  MiniPlayerRoot,
  TapTarget,
  TextStack,
  Title,
} from './MiniPlayer.styled';

export interface MiniPlayerProps {
  isPlaying: boolean;
  isRadioAvailable?: boolean;
  isRadioGenerating?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onExpand: () => void;
  onStartRadio?: () => void;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({
  isPlaying,
  isRadioAvailable,
  isRadioGenerating,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onExpand,
  onStartRadio,
}) => {
  const { currentTrack } = useCurrentTrackContext();

  if (!currentTrack) return null;

  const trackName = currentTrack.name ?? '';
  const artistName = currentTrack.artists ?? '';
  const artUrl = currentTrack.image || undefined;

  return (
    <MiniPlayerRoot data-testid="library-mini-player">
      <TapTarget
        type="button"
        aria-label={`Expand player — ${trackName}`}
        data-testid="mini-expand"
        onClick={onExpand}
      >
        <MiniArt imageUrl={artUrl} alt={trackName || 'Now playing'} isPlaying={isPlaying} />
        <TextStack>
          <Title>{trackName}</Title>
          <Artist>{artistName}</Artist>
        </TextStack>
      </TapTarget>
      <MiniControls
        isPlaying={isPlaying}
        isRadioAvailable={isRadioAvailable}
        isRadioGenerating={isRadioGenerating}
        onPlay={onPlay}
        onPause={onPause}
        onNext={onNext}
        onPrevious={onPrevious}
        onStartRadio={onStartRadio}
      />
    </MiniPlayerRoot>
  );
};

MiniPlayer.displayName = 'MiniPlayer';
export default memo(MiniPlayer);
