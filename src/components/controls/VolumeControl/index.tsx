import { memo, useCallback, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ControlButton } from '../styled';
import { VolumeIcon, UnmuteIcon } from '@/components/icons/VolumeIcons';
import {
    PopoverContainer,
    SliderTrack,
    SliderThumb,
    MuteButton,
    VolumeLabel,
} from './styled';

interface VolumeControlProps {
    isMuted: boolean;
    volume: number;
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
        prevProps.isMobile === nextProps.isMobile &&
        prevProps.isTablet === nextProps.isTablet
    );
};

const VolumeControl = memo<VolumeControlProps>(({
    isMuted,
    volume,
    onClick,
    onVolumeChange,
    isMobile,
    isTablet
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(null);
    const draggingRef = useRef(false);

    const togglePopover = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    useLayoutEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPopoverPos({
                left: rect.left + rect.width / 2,
                top: rect.top - 12,
            });
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const isOutside = (target: EventTarget | null) =>
            popoverRef.current && !popoverRef.current.contains(target as Node) &&
            buttonRef.current && !buttonRef.current.contains(target as Node);
        const handlePointer = (e: MouseEvent | TouchEvent) => {
            const target = 'touches' in e ? (e as TouchEvent).target : (e as MouseEvent).target;
            if (isOutside(target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handlePointer);
        document.addEventListener('touchstart', handlePointer, { passive: true });
        return () => {
            document.removeEventListener('mousedown', handlePointer);
            document.removeEventListener('touchstart', handlePointer);
        };
    }, [isOpen]);

    const volumeFromY = useCallback((clientY: number) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const pct = 1 - (clientY - rect.top) / rect.height;
        onVolumeChange(Math.round(Math.max(0, Math.min(100, pct * 100))));
    }, [onVolumeChange]);

    const handleTrackMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        draggingRef.current = true;
        volumeFromY(e.clientY);

        const handleMove = (ev: MouseEvent) => {
            if (draggingRef.current) volumeFromY(ev.clientY);
        };
        const handleUp = () => {
            draggingRef.current = false;
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    }, [volumeFromY]);

    const handleTrackTouchStart = useCallback((e: React.TouchEvent) => {
        draggingRef.current = true;
        volumeFromY(e.touches[0].clientY);

        const handleMove = (ev: TouchEvent) => {
            ev.preventDefault();
            if (draggingRef.current) volumeFromY(ev.touches[0].clientY);
        };
        const handleEnd = () => {
            draggingRef.current = false;
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('touchend', handleEnd);
        };
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd);
    }, [volumeFromY]);

    const displayVolume = isMuted ? 0 : volume;

    return (
        <>
            <ControlButton
                ref={buttonRef}
                $isMobile={isMobile}
                $isTablet={isTablet}
                $compact
                isActive={isOpen}
                onClick={togglePopover}
                title="Volume"
                aria-label="Volume"
                aria-pressed={isOpen}
            >
                <VolumeIcon isMuted={isMuted} volume={volume} />
            </ControlButton>

            {isOpen && popoverPos && createPortal(
                <PopoverContainer
                    ref={popoverRef}
                    style={{
                        left: popoverPos.left,
                        top: popoverPos.top,
                        transform: 'translate(-50%, -100%)',
                    }}
                >
                    <VolumeLabel>{displayVolume}</VolumeLabel>

                    <SliderTrack
                        ref={trackRef}
                        $fillPercent={displayVolume}
                        onMouseDown={handleTrackMouseDown}
                        onTouchStart={handleTrackTouchStart}
                    >
                        <SliderThumb $percent={displayVolume} />
                    </SliderTrack>

                    <MuteButton
                        $isMuted={isMuted}
                        onClick={onClick}
                        title={isMuted ? 'Unmute' : 'Mute'}
                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                        aria-pressed={isMuted}
                    >
                        {isMuted ? <UnmuteIcon /> : <VolumeIcon isMuted />}
                    </MuteButton>
                </PopoverContainer>,
                document.body
            )}
        </>
    );
}, areVolumeControlPropsEqual);

VolumeControl.displayName = 'VolumeControl';

export default VolumeControl;
