import { memo } from 'react';
import { TrackInfoRow, TrackInfoLeft, TrackInfoCenter, TrackInfoRight } from './styled';
import PlaybackControls from './PlaybackControls';

interface ControlsToolbarProps {
    // Playback controls props
    onPrevious: () => void;
    onPlay: () => void;
    onPause: () => void;
    onNext: () => void;
    isPlaying: boolean;
    accentColor: string;
    isMobile: boolean;
    isTablet: boolean;
}

// Custom comparison function for memo optimization
const areControlsToolbarPropsEqual = (
    prevProps: ControlsToolbarProps,
    nextProps: ControlsToolbarProps
): boolean => {
    return (
        prevProps.isPlaying === nextProps.isPlaying &&
        prevProps.accentColor === nextProps.accentColor &&
        prevProps.isMobile === nextProps.isMobile &&
        prevProps.isTablet === nextProps.isTablet
        // Callbacks are excluded as they should be memoized by parent
    );
};

export const ControlsToolbar = memo<ControlsToolbarProps>(({
    onPrevious,
    onPlay,
    onPause,
    onNext,
    isPlaying,
    accentColor,
    isMobile,
    isTablet
}) => {
    return (
        <TrackInfoRow style={{ position: 'relative' }}>
            <TrackInfoLeft>
                {/* Left side is now empty - could be used for other controls if needed */}
            </TrackInfoLeft>
            <TrackInfoCenter>
                <PlaybackControls
                    onPrevious={onPrevious}
                    onPlay={onPlay}
                    onPause={onPause}
                    onNext={onNext}
                    isPlaying={isPlaying}
                    accentColor={accentColor}
                    isMobile={isMobile}
                    isTablet={isTablet}
                />
            </TrackInfoCenter>
            <TrackInfoRight>
                {/* Quick actions moved to right-side panel */}
            </TrackInfoRight>
        </TrackInfoRow>
    );
}, areControlsToolbarPropsEqual);

ControlsToolbar.displayName = 'ControlsToolbar';

export default ControlsToolbar;
