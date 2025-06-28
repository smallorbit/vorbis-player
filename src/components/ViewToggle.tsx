import React from 'react';
import styled from 'styled-components';
import { useVisualizerStore } from '../lib/visualizer/state';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import type { ViewMode } from '../lib/visualizer/types';

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const ToggleLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  color: ${({ theme }) => theme.colors.foreground};
`;

const StyledToggleGroup = styled(ToggleGroup)`
  background-color: rgba(38, 38, 38, 0.5);
  border: 1px solid rgba(115, 115, 115, 0.3);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 2px;
`;

const StyledToggleGroupItem = styled(ToggleGroupItem)`
  background-color: transparent;
  color: ${({ theme }) => theme.colors.gray[400]};
  border: none;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  font-size: ${({ theme }) => theme.fontSize.sm};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  transition: all 0.2s ease;
  
  &[aria-pressed="true"] {
    background-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.white};
    box-shadow: 0 2px 8px rgba(100, 108, 255, 0.3);
  }
  
  &:hover:not([aria-pressed="true"]) {
    background-color: rgba(115, 115, 115, 0.2);
    color: ${({ theme }) => theme.colors.white};
  }
  
  &:first-child {
    border-top-left-radius: ${({ theme }) => theme.borderRadius.sm};
    border-bottom-left-radius: ${({ theme }) => theme.borderRadius.sm};
  }
  
  &:last-child {
    border-top-right-radius: ${({ theme }) => theme.borderRadius.sm};
    border-bottom-right-radius: ${({ theme }) => theme.borderRadius.sm};
  }
`;

const IconWrapper = styled.span`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  
  svg {
    width: 1rem;
    height: 1rem;
    fill: currentColor;
  }
`;

interface ViewToggleProps {
  className?: string;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ className }) => {
  const { viewMode, setViewMode } = useVisualizerStore();

  const handleValueChange = (value: string | string[]) => {
    if (typeof value === 'string' && (value === 'playlist' || value === 'visualizer')) {
      setViewMode(value as ViewMode);
    }
  };

  return (
    <ToggleContainer className={className}>
      <ToggleLabel>View:</ToggleLabel>
      <StyledToggleGroup
        type="single"
        value={viewMode}
        onValueChange={handleValueChange}
      >
        <StyledToggleGroupItem value="playlist">
          <IconWrapper>
            <svg viewBox="0 0 24 24">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
            </svg>
            Playlist
          </IconWrapper>
        </StyledToggleGroupItem>
        <StyledToggleGroupItem value="visualizer">
          <IconWrapper>
            <svg viewBox="0 0 24 24">
              <path d="M7 14l5-5 5 5z"/>
              <path d="M12 6l-1.41 1.41L16.17 13H3v2h13.17l-5.58 5.59L12 22l8-8-8-8z"/>
            </svg>
            Visualizer
          </IconWrapper>
        </StyledToggleGroupItem>
      </StyledToggleGroup>
    </ToggleContainer>
  );
};