import React from 'react';
import styled from 'styled-components';
import { cardBase } from '../../styles/utils';

interface AlertProps {
  variant?: 'default' | 'destructive';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const StyledAlert = styled.div<{ variant?: 'default' | 'destructive' }>`
  ${cardBase}
  position: relative;
  width: 100%;
  padding: ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  
  ${({ variant, theme }) => variant === 'destructive' && `
    border-color: ${theme.colors.error};
    color: ${theme.colors.error};
  `}
`;

const AlertTitle = styled.h5`
  margin: 0 0 ${({ theme }) => theme.spacing.xs};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  line-height: 1;
`;

const AlertDescription = styled.div`
  font-size: ${({ theme }) => theme.fontSize.sm};
  line-height: 1.5;
`;

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'default', children, className, ...props }, ref) => (
    <StyledAlert ref={ref} variant={variant} className={className} role="alert" {...props}>
      {children}
    </StyledAlert>
  )
);

Alert.displayName = 'Alert';

export { Alert, AlertTitle, AlertDescription };
