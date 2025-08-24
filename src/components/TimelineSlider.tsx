import React, { memo } from 'react';
import styled from 'styled-components';

const TimelineSliderInput = styled.input.attrs<{ accentColor: string; value: number; max: number }>(
  ({ accentColor, value, max }: { accentColor: string; value: number; max: number }) => ({
    style: {
      background: `linear-gradient(
        to right,
        ${accentColor} 0%,
        ${accentColor} ${value && max ? (Number(value) / Number(max)) * 100 : 0}%,
        rgba(115, 115, 115, 0.3) ${value && max ? (Number(value) / Number(max)) * 100 : 0}%,
        rgba(115, 115, 115, 0.3) 100%
      )`,
      color: accentColor
    }
  })
) <{ value: number; max: number }>`
  flex: 1;
  height: 4px;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: currentColor !important;
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
    width: 12px;
    height: 12px;
    background: currentColor !important;
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

const TimeLabel = styled.span`
  color: ${({ theme }: any) => theme.colors.gray[400]};
  font-size: ${({ theme }: any) => theme.fontSize.sm};
  font-family: monospace;
  min-width: 40px;
  text-align: center;
`;

export const TimelineRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }: any) => theme.spacing.sm};
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
  return (
    <TimelineRow>
      {children}
      <TimeLabel>{formatTime(currentPosition)}</TimeLabel>
      <TimelineSliderInput
        type="range"
        min="0"
        max={duration}
        value={currentPosition}
        accentColor={accentColor}
        onChange={onSliderChange}
        onMouseDown={onSliderMouseDown}
        onMouseUp={onSliderMouseUp}
      />
      <TimeLabel>{formatTime(duration)}</TimeLabel>
    </TimelineRow>
  );
}, areTimelineSliderPropsEqual);

TimelineSlider.displayName = 'TimelineSlider';

export default TimelineSlider;