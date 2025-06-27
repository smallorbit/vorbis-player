import React from 'react';
import styled, { css } from 'styled-components';

interface BadgeProps {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  children: React.ReactNode;
  className?: string;
}

const getVariantStyles = (variant: BadgeProps['variant']) => {
  switch (variant) {
    case 'secondary':
      return css`
        background-color: ${({ theme }) => theme.colors.gray[200]};
        color: ${({ theme }) => theme.colors.gray[800]};
      `;
    case 'destructive':
      return css`
        background-color: ${({ theme }) => theme.colors.error};
        color: ${({ theme }) => theme.colors.white};
      `;
    case 'outline':
      return css`
        background-color: transparent;
        color: ${({ theme }) => theme.colors.foreground};
        border: 1px solid ${({ theme }) => theme.colors.border};
      `;
    default:
      return css`
        background-color: ${({ theme }) => theme.colors.primary};
        color: ${({ theme }) => theme.colors.white};
      `;
  }
};

const StyledBadge = styled.span<BadgeProps>`
  display: inline-flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  transition: ${({ theme }) => theme.transitions.normal};
  ${({ variant }) => getVariantStyles(variant)}
`;

export const Badge: React.FC<BadgeProps> = ({ 
  variant = 'default', 
  children, 
  className 
}) => {
  return (
    <StyledBadge variant={variant} className={className}>
      {children}
    </StyledBadge>
  );
};
