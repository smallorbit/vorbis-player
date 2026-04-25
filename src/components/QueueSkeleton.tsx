import { memo } from 'react';
import styled, { keyframes, css } from 'styled-components';
import {
  QueueListRoot,
  QueueListCard,
  QueueListCardHeader,
  QueueListCardHeaderRow,
  QueueListMeta,
  QueueListContent,
  QueueListScroll,
  QueueListItems,
} from './QueueTrackList.styled';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const DEFAULT_ROW_COUNT = 6;

const shimmerSlide = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`;

const shimmerSurface = css`
  position: relative;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.gray[800]};
  border-radius: ${({ theme }) => theme.borderRadius.md};

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      ${({ theme }) => theme.colors.gray[700]} 50%,
      transparent 100%
    );
    transform: translateX(-100%);
    will-change: transform;
    animation: ${shimmerSlide} 1.6s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      display: none;
    }
  }
`;

const SkeletonRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid transparent;
`;

const SkeletonAlbumArt = styled.div`
  ${shimmerSurface}
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
`;

const SkeletonTextColumn = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const SkeletonTitleLine = styled.div`
  ${shimmerSurface}
  height: 1rem;
  width: 70%;
`;

const SkeletonArtistLine = styled.div`
  ${shimmerSurface}
  height: 0.875rem;
  width: 45%;
`;

const SkeletonDuration = styled.div`
  ${shimmerSurface}
  width: 2.25rem;
  height: 0.875rem;
  flex-shrink: 0;
`;

interface QueueSkeletonProps {
  rowCount?: number;
}

const QueueSkeleton = memo<QueueSkeletonProps>(({ rowCount = DEFAULT_ROW_COUNT }) => {
  const safeRowCount = Math.max(0, Math.floor(rowCount));
  const reducedMotion = useReducedMotion();
  const animatedAttr = reducedMotion ? 'false' : 'true';

  return (
    <QueueListRoot aria-busy="true" aria-live="polite" data-testid="queue-skeleton">
      <QueueListCard>
        <QueueListCardHeader>
          <QueueListCardHeaderRow>
            <QueueListMeta>Loading queue…</QueueListMeta>
          </QueueListCardHeaderRow>
        </QueueListCardHeader>
        <QueueListContent>
          <QueueListScroll>
            <QueueListItems>
              {Array.from({ length: safeRowCount }).map((_, idx) => (
                <SkeletonRow
                  key={idx}
                  aria-hidden="true"
                  data-testid="queue-skeleton-row"
                  data-animated={animatedAttr}
                >
                  <SkeletonAlbumArt />
                  <SkeletonTextColumn>
                    <SkeletonTitleLine />
                    <SkeletonArtistLine />
                  </SkeletonTextColumn>
                  <SkeletonDuration />
                </SkeletonRow>
              ))}
            </QueueListItems>
          </QueueListScroll>
        </QueueListContent>
      </QueueListCard>
    </QueueListRoot>
  );
});

QueueSkeleton.displayName = 'QueueSkeleton';

export default QueueSkeleton;
