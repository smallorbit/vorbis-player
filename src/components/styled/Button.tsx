import styled, { css } from 'styled-components';
import { buttonPrimary, buttonSecondary, buttonOutline, buttonGhost, buttonBase } from '../../styles/utils';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'default' | 'destructive' | 'link';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const getVariantStyles = (variant: ButtonProps['variant']) => {
  switch (variant) {
    case 'secondary':
      return buttonSecondary;
    case 'outline':
      return buttonOutline;
    case 'ghost':
      return buttonGhost;
    case 'destructive':
      return css`
        ${buttonBase}
        background-color: ${({ theme }) => theme.colors.error};
        color: ${({ theme }) => theme.colors.white};
        
        &:hover:not(:disabled) {
          background-color: ${({ theme }) => theme.colors.error};
          opacity: 0.9;
        }
      `;
    case 'link':
      return css`
        ${buttonBase}
        background-color: transparent;
        color: ${({ theme }) => theme.colors.primary};
        text-decoration: underline;
        padding: 0;
        
        &:hover:not(:disabled) {
          color: ${({ theme }) => theme.colors.primaryHover};
        }
      `;
    case 'default':
    case 'primary':
    default:
      return buttonPrimary;
  }
};

const getSizeStyles = (size: ButtonProps['size']) => {
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

const StyledButton = styled.button.withConfig({
  shouldForwardProp: (prop) => !['active'].includes(prop),
}) <Omit<ButtonProps, 'variant'> & { $variant?: ButtonProps['variant'] }>`
  ${({ $variant }) => getVariantStyles($variant)}
  ${({ size }) => getSizeStyles(size)}
`;

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  ...props
}) => {
  return (
    <StyledButton $variant={variant} size={size} {...props}>
      {children}
    </StyledButton>
  );
};
