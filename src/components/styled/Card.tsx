import styled from 'styled-components';
import { cardBase } from '../../styles/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const StyledCard = styled.div`
  ${cardBase}
`;

const CardHeader = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const CardTitle = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.lg};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.foreground};
`;

const CardDescription = styled.p`
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.muted.foreground};
`;

const CardContent = styled.div`
  /* Add any content-specific styles here */
`;

const CardFooter = styled.div`
  margin-top: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

interface CardComponent extends React.FC<CardProps> {
  Header: typeof CardHeader;
  Title: typeof CardTitle;
  Description: typeof CardDescription;
  Content: typeof CardContent;
  Footer: typeof CardFooter;
}

const CardRoot: React.FC<CardProps> = ({ children, className }) => {
  return <StyledCard className={className}>{children}</StyledCard>;
};

export const Card = CardRoot as CardComponent;

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;

// Export individual components as well for direct import
export { CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
