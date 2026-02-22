import { memo } from 'react';
import { ControlButton } from './styled';

interface PlaybackControlsProps {
    onPrevious: () => void;
    onPlay: () => void;
    onPause: () => void;
    onNext: () => void;
    isPlaying: boolean;
    accentColor: string;
    isMobile: boolean;
    isTablet: boolean;
    shuffleEnabled?: boolean;
    onShuffleToggle?: () => void;
}

// Custom comparison function for memo optimization
const arePlaybackControlsPropsEqual = (
    prevProps: PlaybackControlsProps,
    nextProps: PlaybackControlsProps
): boolean => {
    return (
        prevProps.isPlaying === nextProps.isPlaying &&
        prevProps.accentColor === nextProps.accentColor &&
        prevProps.isMobile === nextProps.isMobile &&
        prevProps.isTablet === nextProps.isTablet &&
        prevProps.shuffleEnabled === nextProps.shuffleEnabled
        // Callbacks are excluded as they should be memoized by parent
    );
};

const PlaybackControls = memo<PlaybackControlsProps>(({
    onPrevious,
    onPlay,
    onPause,
    onNext,
    isPlaying,
    accentColor,
    isMobile,
    isTablet,
    shuffleEnabled = false,
    onShuffleToggle,
}) => {
    return (
        <>
            <ControlButton
                $isMobile={isMobile}
                $isTablet={isTablet}
                accentColor={accentColor}
                isActive={shuffleEnabled}
                onClick={onShuffleToggle}
                aria-label={shuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'}
                title={shuffleEnabled ? 'Shuffle: on' : 'Shuffle: off'}
            >
                <svg viewBox="0 0 24 24">
                    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                </svg>
            </ControlButton>
            <ControlButton $isMobile={isMobile} $isTablet={isTablet} accentColor={accentColor} onClick={onPrevious} aria-label="Previous track">
                <svg viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
            </ControlButton>
            <ControlButton $isMobile={isMobile} $isTablet={isTablet} accentColor={accentColor} isActive={isPlaying} onClick={isPlaying ? onPause : onPlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
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
            <ControlButton $isMobile={isMobile} $isTablet={isTablet} accentColor={accentColor} onClick={onNext} aria-label="Next track">
                <svg viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
            </ControlButton>
        </>
    );
}, arePlaybackControlsPropsEqual);

PlaybackControls.displayName = 'PlaybackControls';

export default PlaybackControls;
