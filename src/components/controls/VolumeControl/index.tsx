import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import { Slider } from '@/components/ui/slider';
import { VolumeIcon, UnmuteIcon } from '@/components/icons/VolumeIcons';

import { ControlButton } from '../styled';
import { MuteButton, PopoverContainer, VolumeLabel } from './styled';

interface VolumeControlProps {
    isMuted: boolean;
    volume: number;
    onClick: () => void;
    onVolumeChange: (volume: number) => void;
    isMobile: boolean;
    isTablet: boolean;
}

/**
 * `flexGrow: 0` overrides Radix Track's base `flex-grow:1`. Without this the
 * Track expands to fill remaining flex space in the column-oriented Root and
 * the explicit 120px height is ignored. Inline style beats the Tailwind class.
 */
const TRACK_STYLE: CSSProperties = {
    width: '4px',
    height: '120px',
    flexGrow: 0,
    borderRadius: '2px',
    background: 'rgba(115, 115, 115, 0.3)',
};

const RANGE_STYLE: CSSProperties = {
    background: 'var(--accent-color)',
};

const THUMB_STYLE: CSSProperties = {
    width: '14px',
    height: '14px',
    background: 'var(--accent-color)',
    border: 'none',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
};

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
    const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(null);

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

    /**
     * `displayVolume` (not `volume`) drives the slider so the thumb sits at 0
     * while muted. `onVolumeChange` still updates the underlying volume on
     * drag so unmuting restores the dragged level rather than the pre-mute one.
     */
    const displayVolume = isMuted ? 0 : volume;

    const sliderValue = useMemo(() => [displayVolume], [displayVolume]);

    const handleSliderChange = useCallback(([next]: number[]) => {
        onVolumeChange(next);
    }, [onVolumeChange]);

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

                    {/*
                     * `w-[4px]` and `flex-col` override the base
                     * `w-full`/row layout via tailwind-merge inside `cn()`.
                     * `touch-none` from the base class supplies
                     * `touch-action: none` for mobile drag.
                     */}
                    <Slider
                        orientation="vertical"
                        value={sliderValue}
                        onValueChange={handleSliderChange}
                        min={0}
                        max={100}
                        step={1}
                        aria-label="Volume"
                        className="flex-col justify-center w-[4px]"
                        trackStyle={TRACK_STYLE}
                        rangeStyle={RANGE_STYLE}
                        thumbStyle={THUMB_STYLE}
                    />

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
