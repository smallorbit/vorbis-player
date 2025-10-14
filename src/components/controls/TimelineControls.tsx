import { memo, Suspense } from 'react';
import { TimelineLeft, TimelineRight, TimelineControlsContainer } from './styled';
import EffectsControls from './EffectsControls';
import VolumeControl from './VolumeControl';
import LikeButton from '../LikeButton';
import { TimelineSlider } from '../TimelineSlider';
import ColorPickerPopover from '../ColorPickerPopover';
import type { Track } from '../../services/spotify';

interface TimelineControlsProps {
    // Effects controls props
    glowEnabled?: boolean;
    onGlowToggle?: () => void;
    showVisualEffects?: boolean;
    onShowVisualEffects?: () => void;
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
    // Color picker props
    accentColor: string;
    currentTrack: Track | null;
    onAccentColorChange?: (color: string) => void;
    customAccentColorOverrides: Record<string, string>;
    onCustomAccentColor: (color: string) => void;
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
        prevProps.glowEnabled === nextProps.glowEnabled &&
        prevProps.showVisualEffects === nextProps.showVisualEffects &&
        prevProps.isMuted === nextProps.isMuted &&
        prevProps.volume === nextProps.volume &&
        prevProps.currentPosition === nextProps.currentPosition &&
        prevProps.duration === nextProps.duration &&
        prevProps.trackId === nextProps.trackId &&
        prevProps.isLiked === nextProps.isLiked &&
        prevProps.isLikePending === nextProps.isLikePending &&
        prevProps.accentColor === nextProps.accentColor &&
        prevProps.currentTrack?.id === nextProps.currentTrack?.id &&
        prevProps.isMobile === nextProps.isMobile &&
        prevProps.isTablet === nextProps.isTablet
        // Callbacks are excluded as they should be memoized by parent
    );
};

export const TimelineControls = memo<TimelineControlsProps>(({
    glowEnabled,
    onGlowToggle,
    showVisualEffects,
    onShowVisualEffects,
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
    currentTrack,
    onAccentColorChange,
    customAccentColorOverrides,
    onCustomAccentColor,
    isMobile,
    isTablet
}) => {
    return (
        <TimelineControlsContainer>
            <TimelineLeft>
                <EffectsControls
                    glowEnabled={glowEnabled}
                    onGlowToggle={onGlowToggle}
                    showVisualEffects={showVisualEffects}
                    onShowVisualEffects={onShowVisualEffects}
                    accentColor={accentColor}
                    isMobile={isMobile}
                    isTablet={isTablet}
                />

                <Suspense fallback={<div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚡</div>}>
                    <ColorPickerPopover
                        accentColor={accentColor}
                        currentTrack={currentTrack}
                        onAccentColorChange={onAccentColorChange}
                        customAccentColorOverrides={customAccentColorOverrides}
                        onCustomAccentColor={onCustomAccentColor}
                        $isMobile={isMobile}
                        $isTablet={isTablet}
                    />
                </Suspense>

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
