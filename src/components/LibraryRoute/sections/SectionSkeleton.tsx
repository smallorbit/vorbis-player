import React from 'react';
import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';

const shimmer = keyframes`
  0% { opacity: 0.4; }
  50% { opacity: 0.7; }
  100% { opacity: 0.4; }
`;

const Wrap = styled.div<{ $variant: 'row' | 'grid' }>`
  display: ${({ $variant }) => ($variant === 'row' ? 'flex' : 'grid')};
  ${({ $variant }) =>
    $variant === 'row'
      ? `flex-direction: row; gap: ${theme.spacing.md}; padding: 0 ${theme.spacing.md};`
      : `grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: ${theme.spacing.md}; padding: 0 ${theme.spacing.md};`}
`;

const Card = styled.div<{ $variant: 'row' | 'grid' }>`
  ${({ $variant }) => ($variant === 'row' ? 'width: 144px; flex: 0 0 auto;' : 'width: 100%;')}
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`;

const Art = styled.div`
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: ${theme.borderRadius.lg};
  background: ${theme.colors.muted.background};
  animation: ${shimmer} 1.6s ease-in-out infinite;
`;

const Line = styled.div`
  height: 0.875rem;
  border-radius: ${theme.borderRadius.sm};
  background: ${theme.colors.muted.background};
  animation: ${shimmer} 1.6s ease-in-out infinite;
`;

interface SectionSkeletonProps {
  count?: number;
  variant: 'row' | 'grid';
}

const SectionSkeleton: React.FC<SectionSkeletonProps> = ({ count = 4, variant }) => (
  <Wrap $variant={variant} data-testid="library-section-skeleton">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} $variant={variant}>
        <Art />
        <Line />
      </Card>
    ))}
  </Wrap>
);

SectionSkeleton.displayName = 'SectionSkeleton';
export default SectionSkeleton;
