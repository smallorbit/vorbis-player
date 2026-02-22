import { memo, useCallback, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { ControlButton } from './styled';
import { theme } from '@/styles/theme';

const PopoverContainer = styled.div`
  position: fixed;
  z-index: ${theme.zIndex.popover};
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  gap: 8px;
  background: ${theme.colors.popover.background};
  border: 1px solid ${theme.colors.popover.border};
  border-radius: ${theme.borderRadius.xl};
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
`;

const SliderTrack = styled.div<{ $accentColor: string; $fillPercent: number }>`
  position: relative;
  width: 4px;
  height: 120px;
  background: rgba(115, 115, 115, 0.3);
  border-radius: 2px;
  cursor: pointer;
  touch-action: none;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: ${({ $fillPercent }) => $fillPercent}%;
    background: ${({ $accentColor }) => $accentColor};
    border-radius: 2px;
    pointer-events: none;
  }
`;

const SliderThumb = styled.div<{ $accentColor: string; $percent: number }>`
  position: absolute;
  left: 50%;
  bottom: ${({ $percent }) => $percent}%;
  transform: translate(-50%, 50%);
  width: 14px;
  height: 14px;
  background: ${({ $accentColor }) => $accentColor};
  border-radius: 50%;
  pointer-events: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
`;

const MuteButton = styled.button<{ $isMuted: boolean; $accentColor: string }>`
  border: none;
  background: ${({ $isMuted, $accentColor }) => $isMuted ? `${$accentColor}33` : 'transparent'};
  color: ${({ $isMuted }) => $isMuted ? theme.colors.gray[300] : theme.colors.gray[400]};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 4px;
  border-radius: ${theme.borderRadius.md};
  transition: all 0.15s ease;

  &:hover {
    background: ${theme.colors.control.background};
    color: ${theme.colors.white};
  }

  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
`;

const VolumeLabel = styled.span`
  font-size: 10px;
  font-family: monospace;
  color: ${theme.colors.gray[400]};
  user-select: none;
  min-width: 22px;
  text-align: center;
`;

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

const VolumeIcon = ({ isMuted, volume }: { isMuted: boolean; volume: number }) => {
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

const MuteIcon = () => (
    <svg viewBox="0 0 24 24">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L22.46 25L23.87 23.59L2.41 2.13Z" />
    </svg>
);

const UnmuteIcon = () => (
    <svg viewBox="0 0 24 24">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
);

const VolumeControl = memo<VolumeControlProps>(({
    isMuted,
    volume,
    accentColor,
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
        const handleClick = (e: MouseEvent) => {
            if (
                popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
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
                accentColor={accentColor}
                isActive={isOpen}
                onClick={togglePopover}
                title="Volume"
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
                        $accentColor={accentColor}
                        $fillPercent={displayVolume}
                        onMouseDown={handleTrackMouseDown}
                        onTouchStart={handleTrackTouchStart}
                    >
                        <SliderThumb $accentColor={accentColor} $percent={displayVolume} />
                    </SliderTrack>

                    <MuteButton
                        $isMuted={isMuted}
                        $accentColor={accentColor}
                        onClick={onClick}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <UnmuteIcon /> : <MuteIcon />}
                    </MuteButton>
                </PopoverContainer>,
                document.body
            )}
        </>
    );
}, areVolumeControlPropsEqual);

VolumeControl.displayName = 'VolumeControl';

export default VolumeControl;
