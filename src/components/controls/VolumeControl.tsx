import { memo, useCallback } from 'react';
import { VolumeButton, VolumeControlWrapper, VolumeSliderInput } from './styled';

interface VolumeControlProps {
    isMuted: boolean;
    volume: number;
    accentColor: string;
    onClick: () => void;
    onVolumeChange: (volume: number) => void;
    isMobile: boolean;
    isTablet: boolean;
}

const areVolumeControlPropsEqual = (
    prevProps: VolumeControlProps,
    nextProps: VolumeControlProps
): boolean => {
    return (
        prevProps.isMuted === nextProps.isMuted &&
        prevProps.volume === nextProps.volume &&
        prevProps.accentColor === nextProps.accentColor &&
        prevProps.isMobile === nextProps.isMobile &&
        prevProps.isTablet === nextProps.isTablet
    );
};

const VolumeControl = memo<VolumeControlProps>(({
    isMuted,
    volume,
    accentColor,
    onClick,
    onVolumeChange,
    isMobile,
    isTablet
}) => {
    const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onVolumeChange(Number(e.target.value));
    }, [onVolumeChange]);

    const sliderWidth = isMobile ? 60 : isTablet ? 72 : 80;

    const getVolumeIcon = () => {
        if (isMuted || volume === 0) {
            return (
                <svg viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L22.46 25L23.87 23.59L2.41 2.13Z" />
                </svg>
            );
        }

        if (volume > 50) {
            return (
                <svg viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
            );
        }

        return (
            <svg viewBox="0 0 24 24">
                <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
            </svg>
        );
    };

    return (
        <VolumeControlWrapper $isMobile={isMobile}>
            <VolumeButton
                $isMobile={isMobile}
                $isTablet={isTablet}
                onClick={onClick}
                title={isMuted ? 'Unmute' : 'Mute'}
            >
                {getVolumeIcon()}
            </VolumeButton>
            <VolumeSliderInput
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                $accentColor={accentColor}
                $sliderWidth={sliderWidth}
                onChange={handleSliderChange}
                aria-label="Volume"
            />
        </VolumeControlWrapper>
    );
}, areVolumeControlPropsEqual);

VolumeControl.displayName = 'VolumeControl';

export default VolumeControl;
