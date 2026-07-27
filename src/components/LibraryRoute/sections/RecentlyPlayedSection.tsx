import React from 'react';
import type { CollectionSelection } from '@/types/domain';
import { useRecentlyPlayedSection } from '../hooks';
import type { ContextMenuRequest, LibraryCollectionKind } from '../types';
import Section from './Section';
import SectionSkeleton from './SectionSkeleton';
import LibraryCard from '../card/LibraryCard';

const SEE_ALL_THRESHOLD = 4;

interface RecentlyPlayedSectionProps {
  layout: 'row' | 'grid';
  showProviderBadges?: boolean | undefined;
  onSelect: (selection: CollectionSelection) => void;
  onSeeAll?: (() => void) | undefined;
  onContextMenuRequest?: ((req: ContextMenuRequest) => void) | undefined;
}

const RecentlyPlayedSection: React.FC<RecentlyPlayedSectionProps> = ({
  layout,
  showProviderBadges,
  onSelect,
  onSeeAll,
  onContextMenuRequest,
}) => {
  const { items, isLoading, isEmpty } = useRecentlyPlayedSection();
  if (!isLoading && isEmpty) return null;

  const showSeeAll = layout === 'row' && items.length > SEE_ALL_THRESHOLD;

  return (
    <Section
      title="Recently Played"
      id="recently-played"
      layout={layout}
      onSeeAll={showSeeAll ? onSeeAll : undefined}
    >
      {isLoading && items.length === 0 ? (
        <SectionSkeleton variant={layout} />
      ) : (
        items.map((entry) => {
          const { ref, name, imageUrl } = entry;
          const cardKind: LibraryCollectionKind =
            ref.kind === 'liked' ? 'liked' : ref.kind === 'album' ? 'album' : 'playlist';
          const cardId = ref.kind === 'liked' ? 'liked' : ref.id;
          const selection: CollectionSelection = ref.kind === 'liked'
            ? { type: 'liked', provider: ref.provider, name }
            : { type: 'collection', ref, name };
          const wrappedContextMenu = onContextMenuRequest
            ? (req: ContextMenuRequest) => {
                onContextMenuRequest({
                  ...req,
                  kind: 'recently-played',
                  originalKind: cardKind,
                  recentRef: ref,
                });
              }
            : undefined;
          return (
            <LibraryCard
              key={`${ref.provider}-${ref.kind}-${cardId}`}
              kind={cardKind}
              id={cardId}
              provider={ref.provider}
              selection={selection}
              name={name}
              imageUrl={imageUrl ?? undefined}
              showProviderBadge={showProviderBadges}
              variant={layout === 'row' ? 'row' : 'grid'}
              onSelect={() => onSelect(selection)}
              onContextMenuRequest={wrappedContextMenu}
            />
          );
        })
      )}
    </Section>
  );
};

RecentlyPlayedSection.displayName = 'RecentlyPlayedSection';
export default RecentlyPlayedSection;
