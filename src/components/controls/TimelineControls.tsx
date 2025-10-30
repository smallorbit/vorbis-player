import { memo } from 'react';
import { TimelineLeft, TimelineRight, TimelineControlsContainer } from './styled';
import VolumeControl from './VolumeControl';
import LikeButton from '../LikeButton';
import { TimelineSlider } from '../TimelineSlider';

interface TimelineControlsProps {
    // Volume control props
    isMuted: boolean;
    volume: number;
    onVolumeButtonClick: () => void;
    // Timeline slider props
    currentPosition: number;
    duration: number;
    formatTime: (ms: number) => string;
    onSliderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSliderMouseDown: () => void;
    onSliderMouseUp: (e: React.MouseEvent<HTMLInputElement>) => void;
    // Like button props
    trackId?: string;
    isLiked: boolean;
    isLikePending: boolean;
    onLikeToggle: () => void;
    // Accent color for slider/theming
    accentColor: string;
    // Responsive props
    isMobile: boolean;
    isTablet: boolean;
}

// Custom comparison function for memo optimization
const areTimelineControlsPropsEqual = (
    prevProps: TimelineControlsProps,
    nextProps: TimelineControlsProps
): boolean => {
    return (
        // Removed effects/color picker props
        prevProps.isMuted === nextProps.isMuted &&
        prevProps.volume === nextProps.volume &&
        prevProps.currentPosition === nextProps.currentPosition &&
        prevProps.duration === nextProps.duration &&
        prevProps.trackId === nextProps.trackId &&
        prevProps.isLiked === nextProps.isLiked &&
        prevProps.isLikePending === nextProps.isLikePending &&
        prevProps.accentColor === nextProps.accentColor &&
        prevProps.isMobile === nextProps.isMobile &&
        prevProps.isTablet === nextProps.isTablet
        // Callbacks are excluded as they should be memoized by parent
    );
};

export const TimelineControls = memo<TimelineControlsProps>(({ 
    isMuted,
    volume,
    onVolumeButtonClick,
    currentPosition,
    duration,
    formatTime,
    onSliderChange,
    onSliderMouseDown,
    onSliderMouseUp,
    trackId,
    isLiked,
    isLikePending,
    onLikeToggle,
    accentColor,
    isMobile,
    isTablet
}) => {
    return (
        <TimelineControlsContainer>
            <TimelineLeft>
                <VolumeControl
                    isMuted={isMuted}
                    volume={volume}
                    onClick={onVolumeButtonClick}
                    isMobile={isMobile}
                    isTablet={isTablet}
                />
            </TimelineLeft>

            <TimelineSlider
                currentPosition={currentPosition}
                duration={duration}
                accentColor={accentColor}
                formatTime={formatTime}
                onSliderChange={onSliderChange}
                onSliderMouseDown={onSliderMouseDown}
                onSliderMouseUp={onSliderMouseUp}
            />

            <TimelineRight>
                <LikeButton
                    trackId={trackId}
                    isLiked={isLiked}
                    isLoading={isLikePending}
                    accentColor={accentColor}
                    onToggleLike={onLikeToggle}
                    $isMobile={isMobile}
                    $isTablet={isTablet}
                />
            </TimelineRight>
        </TimelineControlsContainer>
    );
}, areTimelineControlsPropsEqual);

TimelineControls.displayName = 'TimelineControls';

export default TimelineControls;
