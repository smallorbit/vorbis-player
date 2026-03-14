import { memo } from 'react';
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
            <ControlButton $isMobile={isMobile} $isTablet={isTablet} onClick={onPrevious}>
                <svg viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
            </ControlButton>
            <ControlButton $isMobile={isMobile} $isTablet={isTablet} isActive={isPlaying} onClick={isPlaying ? onPause : onPlay}>
                {isPlaying ? (
                    <svg viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                )}
            </ControlButton>
            <ControlButton $isMobile={isMobile} $isTablet={isTablet} onClick={onNext}>
                <svg viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
            </ControlButton>
        </>
    );
}, arePlaybackControlsPropsEqual);

PlaybackControls.displayName = 'PlaybackControls';

export default PlaybackControls;
