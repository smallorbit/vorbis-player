import { memo } from 'react';
import { TimelineRight, TimelineControlsContainer } from './styled';
import LikeButton from '../LikeButton';
import TimelineSlider from '../TimelineSlider';

interface TimelineControlsProps {
    currentPosition: number;
    duration: number;
    formatTime: (ms: number) => string;
    onSeek: (position: number) => void;
    onScrubStart: () => void;
    onScrubEnd: (position: number) => void;
    trackId?: string;
    isLiked: boolean;
    isLikePending: boolean;
    onLikeToggle: () => void;
    isMobile: boolean;
    isTablet: boolean;
}

const areTimelineControlsPropsEqual = (
    prevProps: TimelineControlsProps,
    nextProps: TimelineControlsProps
): boolean => {
    return (
        prevProps.currentPosition === nextProps.currentPosition &&
        prevProps.duration === nextProps.duration &&
        prevProps.trackId === nextProps.trackId &&
        prevProps.isLiked === nextProps.isLiked &&
        prevProps.isLikePending === nextProps.isLikePending &&
        prevProps.isMobile === nextProps.isMobile &&
        prevProps.isTablet === nextProps.isTablet
    );
};

const TimelineControls = memo<TimelineControlsProps>(({
    currentPosition,
    duration,
    formatTime,
    onSeek,
    onScrubStart,
    onScrubEnd,
    trackId,
    isLiked,
    isLikePending,
    onLikeToggle,
    isMobile,
    isTablet
}) => {
    return (
        <TimelineControlsContainer $isMobile={isMobile}>
            <TimelineSlider
                currentPosition={currentPosition}
                duration={duration}
                formatTime={formatTime}
                onSeek={onSeek}
                onScrubStart={onScrubStart}
                onScrubEnd={onScrubEnd}
            />

            <TimelineRight>
                <LikeButton
                    trackId={trackId}
                    isLiked={isLiked}
                    isLoading={isLikePending}
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
