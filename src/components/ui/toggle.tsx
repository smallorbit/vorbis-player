import React from 'react';
import styled, { css } from 'styled-components';
import { buttonBase } from '../../styles/utils';

interface ToggleProps {
  pressed?: boolean;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  children: React.ReactNode;
  onPressedChange?: (pressed: boolean) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}

const getVariantStyles = (variant: ToggleProps['variant'], pressed: boolean) => {
  if (pressed) {
    return css`
      background-color: ${({ theme }) => theme.colors.accent};
      color: ${({ theme }) => theme.colors.white};
    `;
  }
  
  switch (variant) {
    case 'outline':
      return css`
        background-color: transparent;
        border: 1px solid ${({ theme }) => theme.colors.border};
        color: ${({ theme }) => theme.colors.foreground};
        
        &:hover {
          background-color: ${({ theme }) => theme.colors.muted.background};
        }
      `;
    default:
      return css`
        background-color: transparent;
        color: ${({ theme }) => theme.colors.foreground};
        
        &:hover {
          background-color: ${({ theme }) => theme.colors.muted.background};
        }
      `;
  }
};

const getSizeStyles = (size: ToggleProps['size']) => {
  switch (size) {
    case 'sm':
      return css`
        padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
        font-size: ${({ theme }) => theme.fontSize.xs};
      `;
    case 'lg':
      return css`
        padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
        font-size: ${({ theme }) => theme.fontSize.base};
      `;
    default:
      return css`
        padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
        font-size: ${({ theme }) => theme.fontSize.sm};
      `;
  }
};

const StyledToggle = styled.button.withConfig({
  shouldForwardProp: (prop) => 
    !['pressed', 'variant', 'size', 'onPressedChange'].includes(prop)
})<ToggleProps>`
  ${buttonBase}
  ${({ variant, pressed }) => getVariantStyles(variant, pressed || false)}
  ${({ size }) => getSizeStyles(size)}
`;

export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ pressed = false, onPressedChange, children, ...props }, ref) => {
    const handleClick = () => {
      onPressedChange?.(!pressed);
    };

    return (
      <StyledToggle
        ref={ref}
        pressed={pressed}
        onClick={handleClick}
        aria-pressed={pressed}
        {...props}
      >
        {children}
      </StyledToggle>
    );
  }
);

Toggle.displayName = 'Toggle';
