import React, { useCallback } from 'react';
import { ControlButton, ControlButtonRow } from './MiniPlayer.styled';

export interface MiniControlsProps {
  isPlaying: boolean;
  isRadioAvailable?: boolean;
  isRadioGenerating?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onStartRadio?: () => void;
}

// SVG path data sourced from src/components/controls/PlaybackControls.tsx
// (kept inline so MiniControls renders without coupling to PlaybackControls' ControlButton styling).

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
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </ControlButton>
      <ControlButton
        type="button"
        data-testid="mini-play-pause"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        aria-pressed={isPlaying}
        onClick={handlePlayPause}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </ControlButton>
      <ControlButton
        type="button"
        data-testid="mini-next"
        aria-label="Next track"
        onClick={handleNext}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
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
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3.24 6.15C2.51 6.43 2 7.17 2 8v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8.3l8.26-3.34L15.88 1 3.24 6.15zM7 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-8h-2v-2h-2v2H4V8h16v4z" />
          </svg>
        </ControlButton>
      ) : null}
    </ControlButtonRow>
  );
};

MiniControls.displayName = 'MiniControls';
export default MiniControls;
