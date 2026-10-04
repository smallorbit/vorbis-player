import { memo } from 'react';
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon } from '@/components/icons/PlaybackIcons';
import { ControlButton } from './styled';

interface PlaybackControlsProps {
    onPrevious: () => void;
    onPlay: () => void;
    onPause: () => void;
    onNext: () => void;
    isPlaying: boolean;
    isMobile: boolean;
    isTablet: boolean;
}

const arePlaybackControlsPropsEqual = (
    prevProps: PlaybackControlsProps,
    nextProps: PlaybackControlsProps
): boolean => {
    return (
        prevProps.isPlaying === nextProps.isPlaying &&
        prevProps.isMobile === nextProps.isMobile &&
        prevProps.isTablet === nextProps.isTablet
    );
};

const PlaybackControls = memo<PlaybackControlsProps>(({
    onPrevious,
    onPlay,
    onPause,
    onNext,
    isPlaying,
    isMobile,
    isTablet
}) => {
    return (
        <>
            <ControlButton $isMobile={isMobile} $isTablet={isTablet} onClick={onPrevious} aria-label="Previous track">
                <PreviousIcon />
            </ControlButton>
            <ControlButton $isMobile={isMobile} $isTablet={isTablet} isActive={isPlaying} onClick={isPlaying ? onPause : onPlay} aria-label={isPlaying ? 'Pause' : 'Play'} aria-pressed={isPlaying}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </ControlButton>
            <ControlButton $isMobile={isMobile} $isTablet={isTablet} onClick={onNext} aria-label="Next track">
                <NextIcon />
            </ControlButton>
        </>
    );
}, arePlaybackControlsPropsEqual);

PlaybackControls.displayName = 'PlaybackControls';

export default PlaybackControls;
