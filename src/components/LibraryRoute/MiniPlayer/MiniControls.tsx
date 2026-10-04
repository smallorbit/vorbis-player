import React, { useCallback } from 'react';
import { RadioDeviceIcon } from '@/components/icons/ActionIcons';
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon } from '@/components/icons/PlaybackIcons';
import { ControlButton, ControlButtonRow } from './MiniPlayer.styled';

interface MiniControlsProps {
  isPlaying: boolean;
  isRadioAvailable?: boolean | undefined;
  isRadioGenerating?: boolean | undefined;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onStartRadio?: (() => void) | undefined;
}

const MiniControls: React.FC<MiniControlsProps> = ({
  isPlaying,
  isRadioAvailable,
  isRadioGenerating,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onStartRadio,
}) => {
  const stop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handlePlayPause = useCallback(
    (e: React.MouseEvent) => {
      stop(e);
      if (isPlaying) onPause();
      else onPlay();
    },
    [stop, isPlaying, onPlay, onPause],
  );

  const handlePrev = useCallback(
    (e: React.MouseEvent) => {
      stop(e);
      onPrevious();
    },
    [stop, onPrevious],
  );

  const handleNext = useCallback(
    (e: React.MouseEvent) => {
      stop(e);
      onNext();
    },
    [stop, onNext],
  );

  const handleRadio = useCallback(
    (e: React.MouseEvent) => {
      stop(e);
      onStartRadio?.();
    },
    [stop, onStartRadio],
  );

  return (
    <ControlButtonRow onClick={stop}>
      <ControlButton
        type="button"
        data-testid="mini-prev"
        aria-label="Previous track"
        onClick={handlePrev}
      >
        <PreviousIcon />
      </ControlButton>
      <ControlButton
        type="button"
        data-testid="mini-play-pause"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        aria-pressed={isPlaying}
        onClick={handlePlayPause}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </ControlButton>
      <ControlButton
        type="button"
        data-testid="mini-next"
        aria-label="Next track"
        onClick={handleNext}
      >
        <NextIcon />
      </ControlButton>
      {isRadioAvailable && onStartRadio ? (
        <ControlButton
          type="button"
          data-testid="mini-radio"
          aria-label={isRadioGenerating ? 'Generating radio playlist' : 'Start radio from current track'}
          title={isRadioGenerating ? 'Generating radio playlist...' : 'Start radio from current track'}
          disabled={isRadioGenerating}
          onClick={handleRadio}
        >
          <RadioDeviceIcon />
        </ControlButton>
      ) : null}
    </ControlButtonRow>
  );
};

MiniControls.displayName = 'MiniControls';
export default MiniControls;
