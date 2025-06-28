import React from 'react';
import styled from 'styled-components';
import { useVisualizerStore, type VisualizerType } from '../lib/visualizer/state';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

const SelectorContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const SelectorLabel = styled.span`
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
  font-size: ${({ theme }) => theme.fontSize.xs};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  transition: all 0.2s ease;
  
  &[aria-pressed="true"] {
    background-color: ${({ theme }) => theme.colors.accent};
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
    width: 0.875rem;
    height: 0.875rem;
    fill: currentColor;
  }
`;

interface VisualizerSelectorProps {
  className?: string;
}

const visualizerOptions: { value: VisualizerType; label: string; icon: JSX.Element }[] = [
  {
    value: 'sphere',
    label: 'Sphere',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
      </svg>
    ),
  },
  {
    value: 'cube',
    label: 'Cube',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z"/>
      </svg>
    ),
  },
  {
    value: 'grid',
    label: 'Grid',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
      </svg>
    ),
  },
  {
    value: 'placeholder',
    label: 'Basic',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
  },
];

export const VisualizerSelector: React.FC<VisualizerSelectorProps> = ({ className }) => {
  const { visualizerType, setVisualizerType } = useVisualizerStore();

  const handleValueChange = (value: string | string[]) => {
    if (typeof value === 'string' && 
        (value === 'sphere' || value === 'cube' || value === 'grid' || value === 'placeholder')) {
      setVisualizerType(value as VisualizerType);
    }
  };

  return (
    <SelectorContainer className={className}>
      <SelectorLabel>Effect:</SelectorLabel>
      <StyledToggleGroup
        type="single"
        value={visualizerType}
        onValueChange={handleValueChange}
      >
        {visualizerOptions.map((option) => (
          <StyledToggleGroupItem key={option.value} value={option.value}>
            <IconWrapper>
              {option.icon}
              {option.label}
            </IconWrapper>
          </StyledToggleGroupItem>
        ))}
      </StyledToggleGroup>
    </SelectorContainer>
  );
};