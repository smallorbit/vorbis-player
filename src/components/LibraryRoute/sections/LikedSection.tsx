import React from 'react';
import type { ProviderId } from '@/types/domain';
import { useLikedSection } from '../hooks';
import type { ContextMenuRequest } from '../types';
import Section from './Section';
import SectionSkeleton from './SectionSkeleton';
import LibraryCard from '../card/LibraryCard';

export interface LikedSectionProps {
  layout: 'row' | 'grid';
  showProviderBadges?: boolean;
  onSelectLiked: (provider?: ProviderId) => void;
  onContextMenuRequest?: (req: ContextMenuRequest) => void;
}

const formatCount = (n: number): string => `${n} song${n === 1 ? '' : 's'}`;

const LikedSection: React.FC<LikedSectionProps> = ({
  layout,
  showProviderBadges,
  onSelectLiked,
  onContextMenuRequest,
}) => {
  const { totalCount, perProvider, isUnified, isLoading } = useLikedSection();
  const isEmpty = totalCount === 0;
  if (!isLoading && isEmpty) return null;

  const showPerProvider = !isUnified && showProviderBadges && perProvider.length > 1;

  return (
    <Section title="Liked Songs" id="liked" layout={layout}>
      {isLoading && isEmpty ? (
        <SectionSkeleton variant={layout} count={1} />
      ) : showPerProvider ? (
        perProvider.map(({ provider, count }) => (
          <LibraryCard
            key={`liked-${provider}`}
            kind="liked"
            id={`liked-${provider}`}
            provider={provider}
            name="Liked Songs"
            subtitle={formatCount(count)}
            showProviderBadge
            variant={layout === 'row' ? 'row' : 'grid'}
            onSelect={() => onSelectLiked(provider)}
            onContextMenuRequest={onContextMenuRequest}
          />
        ))
      ) : (
        <LibraryCard
          kind="liked"
          id="liked"
          name="Liked Songs"
          subtitle={formatCount(totalCount)}
          variant={layout === 'row' ? 'row' : 'grid'}
          onSelect={() => onSelectLiked()}
          onContextMenuRequest={onContextMenuRequest}
        />
      )}
    </Section>
  );
};

LikedSection.displayName = 'LikedSection';
export default LikedSection;
