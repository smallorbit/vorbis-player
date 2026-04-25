import React, { memo, useCallback, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { Slider } from '@/components/ui/slider';

const TimeLabel = styled.span.withConfig({
  shouldForwardProp: (prop) => !['minWidth'].includes(prop),
})<{ minWidth: number }>`
  color: ${({ theme }) => theme.colors.gray[400]};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-family: monospace;
  min-width: ${({ minWidth }) => minWidth}px;
  text-align: center;
`;

const TimelineRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  margin: 0;
`;

const SliderWrapper = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
`;

interface TimelineSliderProps {
  currentPosition: number;
  duration: number;
  formatTime: (ms: number) => string;
  onSeek: (position: number) => void;
  onScrubStart: () => void;
  onScrubEnd: (position: number) => void;
  children?: React.ReactNode;
}

const areTimelineSliderPropsEqual = (
  prevProps: TimelineSliderProps,
  nextProps: TimelineSliderProps,
): boolean => {
  return (
    prevProps.currentPosition === nextProps.currentPosition &&
    prevProps.duration === nextProps.duration &&
    prevProps.children === nextProps.children
  );
};

const TimelineSlider = memo<TimelineSliderProps>(({
  currentPosition,
  duration,
  formatTime,
  onSeek,
  onScrubStart,
  onScrubEnd,
  children,
}) => {
  const { isMobile, isTablet } = usePlayerSizingContext();
  const isScrubbingRef = useRef(false);

  const dimensions = useMemo(() => {
    if (isMobile) {
      return { sliderHeight: 3, thumbSize: 10, minWidth: 35 };
    }
    if (isTablet) {
      return { sliderHeight: 4, thumbSize: 12, minWidth: 40 };
    }
    return { sliderHeight: 4, thumbSize: 12, minWidth: 40 };
  }, [isMobile, isTablet]);

  const handleValueChange = useCallback(
    (values: number[]) => {
      const next = values[0] ?? 0;
      if (!isScrubbingRef.current) {
        isScrubbingRef.current = true;
        onScrubStart();
      }
      onSeek(next);
    },
    [onSeek, onScrubStart],
  );

  const handleValueCommit = useCallback(
    (values: number[]) => {
      const next = values[0] ?? 0;
      isScrubbingRef.current = false;
      onScrubEnd(next);
    },
    [onScrubEnd],
  );

  const sliderMax = duration > 0 ? duration : 1;
  const sliderValue = Math.min(currentPosition, sliderMax);

  const trackStyle = useMemo<React.CSSProperties>(
    () => ({
      height: dimensions.sliderHeight,
      borderRadius: dimensions.sliderHeight / 2,
      background: 'rgba(115, 115, 115, 0.3)',
    }),
    [dimensions.sliderHeight],
  );

  const rangeStyle = useMemo<React.CSSProperties>(
    () => ({ background: 'var(--accent-color)' }),
    [],
  );

  const thumbStyle = useMemo<React.CSSProperties>(
    () => ({
      width: dimensions.thumbSize,
      height: dimensions.thumbSize,
      background: 'var(--accent-color)',
      borderColor: 'var(--accent-color)',
      boxShadow: 'none',
    }),
    [dimensions.thumbSize],
  );

  return (
    <TimelineRow>
      {children}
      <TimeLabel minWidth={dimensions.minWidth}>{formatTime(currentPosition)}</TimeLabel>
      <SliderWrapper>
        <Slider
          value={[sliderValue]}
          min={0}
          max={sliderMax}
          step={1}
          disabled={duration <= 0}
          onValueChange={handleValueChange}
          onValueCommit={handleValueCommit}
          trackStyle={trackStyle}
          rangeStyle={rangeStyle}
          thumbStyle={thumbStyle}
          aria-label="Seek timeline"
        />
      </SliderWrapper>
      <TimeLabel minWidth={dimensions.minWidth}>{formatTime(duration)}</TimeLabel>
    </TimelineRow>
  );
}, areTimelineSliderPropsEqual);

TimelineSlider.displayName = 'TimelineSlider';

export default TimelineSlider;
