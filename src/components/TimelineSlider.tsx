import React from 'react';
import styled from 'styled-components';

const TimelineSliderInput = styled.input<{ accentColor: string }>`
  flex: 1;
  height: 4px;
  background: rgba(115, 115, 115, 0.3);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
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
    width: 12px;
    height: 12px;
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
  
  /* Progress fill effect */
  background: linear-gradient(
    to right,
    ${props => props.accentColor} 0%,
    ${props => props.accentColor} ${(props) => props.value && props.max ? (Number(props.value) / Number(props.max)) * 100 : 0}%,
    rgba(115, 115, 115, 0.3) ${(props) => props.value && props.max ? (Number(props.value) / Number(props.max)) * 100 : 0}%,
    rgba(115, 115, 115, 0.3) 100%
  );
`;

const TimeLabel = styled.span`
  color: ${({ theme }: any) => theme.colors.gray[400]};
  font-size: ${({ theme }: any) => theme.fontSize.sm};
  font-family: monospace;
  min-width: 40px;
  text-align: center;
`;

const TimelineRow = styled.div`
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

export const TimelineSlider: React.FC<TimelineSliderProps> = ({
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
};

export default TimelineSlider;