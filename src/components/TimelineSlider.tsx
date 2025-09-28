import React, { memo, useMemo } from 'react';
import styled from 'styled-components';
import { usePlayerSizing } from '../hooks/usePlayerSizing';

const TimelineSliderInput = styled.input.withConfig({
  shouldForwardProp: (prop) => !['accentColor', 'sliderHeight', 'thumbSize'].includes(prop),
}).attrs<{ accentColor: string; value: number; max: number; sliderHeight: number; thumbSize: number }>(
  ({ accentColor, value, max }: { accentColor: string; value: number; max: number }) => ({
    style: {
      background: `linear-gradient(
        to right,
        ${accentColor} 0%,
        ${accentColor} ${value && max ? (Number(value) / Number(max)) * 100 : 0}%,
        rgba(115, 115, 115, 0.3) ${value && max ? (Number(value) / Number(max)) * 100 : 0}%,
        rgba(115, 115, 115, 0.3) 100%
      )`
    }
  })
) <{ accentColor: string; value: number; max: number; sliderHeight: number; thumbSize: number }>`
  flex: 1;
  height: ${({ sliderHeight }) => sliderHeight}px;
  border-radius: ${({ sliderHeight }) => sliderHeight / 2}px;
  outline: none;
  cursor: pointer;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: ${({ thumbSize }) => thumbSize}px;
    height: ${({ thumbSize }) => thumbSize}px;
    background: ${props => props.accentColor} !important;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: none;
    transition: all 0.2s ease;
    
    &:hover {
      transform: scale(1.2);
    }
  }
  
  &::-moz-range-thumb {
    width: ${({ thumbSize }) => thumbSize}px;
    height: ${({ thumbSize }) => thumbSize}px;
    background: ${props => props.accentColor} !important;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: none;
    transition: all 0.2s ease;
    
    &:hover {
      transform: scale(1.2);
    }
  }
`;

const TimeLabel = styled.span.withConfig({
  shouldForwardProp: (prop) => !['minWidth'].includes(prop),
}) <{ minWidth: number }>`
  color: ${({ theme }) => theme.colors.gray[400]};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-family: monospace;
  min-width: ${({ minWidth }) => minWidth}px;
  text-align: center;
`;

export const TimelineRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  margin: 0;
`;

interface TimelineSliderProps {
  currentPosition: number;
  duration: number;
  accentColor: string;
  formatTime: (ms: number) => string;
  onSliderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSliderMouseDown: () => void;
  onSliderMouseUp: (e: React.MouseEvent<HTMLInputElement>) => void;
  children?: React.ReactNode; // For left and right controls
}

// Custom comparison function for memo optimization
const areTimelineSliderPropsEqual = (
  prevProps: TimelineSliderProps,
  nextProps: TimelineSliderProps
): boolean => {
  return (
    prevProps.currentPosition === nextProps.currentPosition &&
    prevProps.duration === nextProps.duration &&
    prevProps.accentColor === nextProps.accentColor &&
    prevProps.children === nextProps.children
    // formatTime, onSliderChange, onSliderMouseDown, onSliderMouseUp should be memoized by parent
  );
};

export const TimelineSlider = memo<TimelineSliderProps>(({
  currentPosition,
  duration,
  accentColor,
  formatTime,
  onSliderChange,
  onSliderMouseDown,
  onSliderMouseUp,
  children
}) => {
  // Get responsive sizing information
  const { isMobile, isTablet } = usePlayerSizing();

  // Calculate responsive dimensions
  const dimensions = useMemo(() => {
    if (isMobile) {
      return {
        sliderHeight: 3,
        thumbSize: 10,
        minWidth: 35
      };
    }
    if (isTablet) {
      return {
        sliderHeight: 4,
        thumbSize: 12,
        minWidth: 40
      };
    }
    return {
      sliderHeight: 4,
      thumbSize: 12,
      minWidth: 40
    };
  }, [isMobile, isTablet]);
  return (
    <TimelineRow>
      {children}
      <TimeLabel minWidth={dimensions.minWidth}>{formatTime(currentPosition)}</TimeLabel>
      <TimelineSliderInput
        type="range"
        min="0"
        max={duration}
        value={currentPosition}
        accentColor={accentColor}
        sliderHeight={dimensions.sliderHeight}
        thumbSize={dimensions.thumbSize}
        onChange={onSliderChange}
        onMouseDown={onSliderMouseDown}
        onMouseUp={onSliderMouseUp}
      />
      <TimeLabel minWidth={dimensions.minWidth}>{formatTime(duration)}</TimeLabel>
    </TimelineRow>
  );
}, areTimelineSliderPropsEqual);

TimelineSlider.displayName = 'TimelineSlider';

export default TimelineSlider;