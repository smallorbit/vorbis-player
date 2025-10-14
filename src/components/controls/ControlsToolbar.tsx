import { memo } from 'react';
import { TrackInfoRow, TrackInfoLeft, TrackInfoCenter, TrackInfoRight, ControlButton } from './styled';
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
    // Playlist button props
    onShowPlaylist: () => void;
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
    isTablet,
    onShowPlaylist
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
                <ControlButton $isMobile={isMobile} $isTablet={isTablet} accentColor={accentColor} onClick={onShowPlaylist} title="Show Playlist">
                    <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                        <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
                    </svg>
                </ControlButton>
            </TrackInfoRight>
        </TrackInfoRow>
    );
}, areControlsToolbarPropsEqual);

ControlsToolbar.displayName = 'ControlsToolbar';

export default ControlsToolbar;
