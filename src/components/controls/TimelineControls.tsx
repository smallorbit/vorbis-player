import { memo } from 'react';
import { TimelineRight, TimelineControlsContainer } from './styled';
import LikeButton from '../LikeButton';
import TimelineSlider from '../TimelineSlider';

interface TimelineControlsProps {
    currentPosition: number;
    duration: number;
    formatTime: (ms: number) => string;
    onSliderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSliderMouseDown: () => void;
    onSliderMouseUp: (e: React.MouseEvent<HTMLInputElement>) => void;
    trackId?: string;
    isLiked: boolean;
    isLikePending: boolean;
    onLikeToggle: () => void;
    accentColor: string;
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
        prevProps.accentColor === nextProps.accentColor &&
        prevProps.isMobile === nextProps.isMobile &&
        prevProps.isTablet === nextProps.isTablet
    );
};

const TimelineControls = memo<TimelineControlsProps>(({ 
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
        <TimelineControlsContainer $isMobile={isMobile}>
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
