import React from 'react';
import type { ProviderId } from '@/types/domain';
import { usePinnedSection } from '../hooks';
import type { ContextMenuRequest, LibraryItemKind } from '../types';
import Section from './Section';
import SectionSkeleton from './SectionSkeleton';
import LibraryCard from '../card/LibraryCard';

const SEE_ALL_THRESHOLD = 6;

export interface PinnedSectionProps {
  layout: 'row' | 'grid';
  showProviderBadges?: boolean;
  onSelect: (kind: LibraryItemKind, id: string, name: string, provider?: ProviderId) => void;
  onSeeAll?: () => void;
  onContextMenuRequest?: (req: ContextMenuRequest) => void;
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
            name={item.name}
            subtitle={item.subtitle}
            imageUrl={item.imageUrl}
            showProviderBadge={showProviderBadges}
            variant={layout === 'row' ? 'row' : 'grid'}
            onSelect={() => onSelect(item.kind, item.id, item.name, item.provider)}
            onContextMenuRequest={onContextMenuRequest}
          />
        ))
      )}
    </Section>
  );
};

PinnedSection.displayName = 'PinnedSection';
export default PinnedSection;
