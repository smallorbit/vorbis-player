import React from 'react';
import styled from 'styled-components';
import { Toggle } from './toggle';

interface ToggleGroupProps {
  type?: 'single' | 'multiple';
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  children: React.ReactNode;
  className?: string;
}

const StyledToggleGroup = styled.div`
  display: inline-flex;
  align-items: center;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  
  & > * {
    border-radius: 0;
    border-right: 1px solid ${({ theme }) => theme.colors.border};
  }
  
  & > *:first-child {
    border-top-left-radius: ${({ theme }) => theme.borderRadius.md};
    border-bottom-left-radius: ${({ theme }) => theme.borderRadius.md};
  }
  
  & > *:last-child {
    border-top-right-radius: ${({ theme }) => theme.borderRadius.md};
    border-bottom-right-radius: ${({ theme }) => theme.borderRadius.md};
    border-right: none;
  }
`;

export const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  ({ type = 'single', value, onValueChange, children, className, ...props }, ref) => {
    const handleValueChange = (itemValue: string) => {
      if (type === 'single') {
        // For single mode, always set the clicked value (don't allow deselecting)
        onValueChange?.(itemValue);
      } else {
        const currentValue = Array.isArray(value) ? value : [];
        const newValue = currentValue.includes(itemValue)
          ? currentValue.filter(v => v !== itemValue)
          : [...currentValue, itemValue];
        onValueChange?.(newValue);
      }
    };

    const isPressed = (itemValue: string) => {
      if (type === 'single') {
        return value === itemValue;
      }
      return Array.isArray(value) && value.includes(itemValue);
    };

    return (
      <StyledToggleGroup ref={ref} className={className} {...props}>
        {React.Children.map(children, (child) => {
          if (React.isValidElement<ToggleGroupItemProps>(child) && child.props.value) {
            return React.cloneElement(child, {
              pressed: isPressed(child.props.value),
              onPressedChange: () => handleValueChange(child.props.value),
            } as Partial<ToggleGroupItemProps>);
          }
          return child;
        })}
      </StyledToggleGroup>
    );
  }
);

ToggleGroup.displayName = 'ToggleGroup';

interface ToggleGroupItemProps {
  value: string;
  children: React.ReactNode;
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  className?: string;
}

export const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ children, ...props }, ref) => {
    return (
      <Toggle ref={ref} variant="outline" {...props}>
        {children}
      </Toggle>
    );
  }
);

ToggleGroupItem.displayName = 'ToggleGroupItem';
