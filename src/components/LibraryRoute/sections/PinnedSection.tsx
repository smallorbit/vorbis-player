import React from 'react';
import type { CollectionSelection } from '@/types/domain';
import { usePinnedSection } from '../hooks';
import type { ContextMenuRequest } from '../types';
import Section from './Section';
import SectionSkeleton from './SectionSkeleton';
import LibraryCard from '../card/LibraryCard';

const SEE_ALL_THRESHOLD = 6;

interface PinnedSectionProps {
  layout: 'row' | 'grid';
  showProviderBadges?: boolean | undefined;
  onSelect: (selection: CollectionSelection) => void;
  onSeeAll?: (() => void) | undefined;
  onContextMenuRequest?: ((req: ContextMenuRequest) => void) | undefined;
}

const PinnedSection: React.FC<PinnedSectionProps> = ({
  layout,
  showProviderBadges,
  onSelect,
  onSeeAll,
  onContextMenuRequest,
}) => {
  const { combined, isLoading, isEmpty } = usePinnedSection();
  if (!isLoading && isEmpty) return null;

  const showSeeAll = layout === 'row' && combined.length > SEE_ALL_THRESHOLD;

  return (
    <Section
      title="Pinned"
      id="pinned"
      layout={layout}
      onSeeAll={showSeeAll ? onSeeAll : undefined}
    >
      {isLoading && combined.length === 0 ? (
        <SectionSkeleton variant={layout} />
      ) : (
        combined.map((item) => (
          <LibraryCard
            key={`${item.kind}-${item.provider ?? 'default'}-${item.id}`}
            kind={item.kind}
            id={item.id}
            provider={item.provider}
            selection={item.selection}
            name={item.name}
            subtitle={item.subtitle}
            imageUrl={item.imageUrl}
            showProviderBadge={showProviderBadges}
            variant={layout === 'row' ? 'row' : 'grid'}
            onSelect={() => onSelect(item.selection)}
            onContextMenuRequest={onContextMenuRequest}
          />
        ))
      )}
    </Section>
  );
};

PinnedSection.displayName = 'PinnedSection';
export default PinnedSection;
