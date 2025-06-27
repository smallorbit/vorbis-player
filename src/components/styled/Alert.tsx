import styled from 'styled-components';

interface AlertProps {
  variant?: 'default' | 'destructive';
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const StyledAlert = styled.div<{ variant?: string }>`
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.muted.background};
  
  ${({ variant, theme }) => variant === 'destructive' && `
    border-color: ${theme.colors.error};
    background-color: rgba(239, 68, 68, 0.1);
  `}
`;

const AlertDescription = styled.div`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.foreground};
`;

interface AlertComponent extends React.FC<AlertProps> {
  Description: typeof AlertDescription;
}

const AlertRoot: React.FC<AlertProps> = ({ variant = 'default', children, style }) => {
  return (
    <StyledAlert variant={variant} style={style}>
      {children}
    </StyledAlert>
  );
};

export const Alert = AlertRoot as AlertComponent;
Alert.Description = AlertDescription;
export { AlertDescription };