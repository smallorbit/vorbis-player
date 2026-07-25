import React from 'react';
import type { CollectionSelection } from '@/types/domain';
import { collectionToRef } from '@/types/domain';
import { useAlbumsSection } from '../hooks';
import type { ContextMenuRequest } from '../types';
import Section from './Section';
import SectionSkeleton from './SectionSkeleton';
import LibraryCard from '../card/LibraryCard';

const SEE_ALL_THRESHOLD = 8;

interface AlbumsSectionProps {
  layout: 'row' | 'grid';
  excludePinned?: boolean | undefined;
  showProviderBadges?: boolean | undefined;
  onSelect: (selection: CollectionSelection) => void;
  onSeeAll?: (() => void) | undefined;
  onContextMenuRequest?: ((req: ContextMenuRequest) => void) | undefined;
}

const AlbumsSection: React.FC<AlbumsSectionProps> = ({
  layout,
  excludePinned = true,
  showProviderBadges,
  onSelect,
  onSeeAll,
  onContextMenuRequest,
}) => {
  const { items, isLoading, isEmpty } = useAlbumsSection({ excludePinned });
  if (!isLoading && isEmpty) return null;

  const showSeeAll = layout === 'row' && items.length > SEE_ALL_THRESHOLD;

  return (
    <Section
      title="Albums"
      id="albums"
      layout={layout}
      onSeeAll={showSeeAll ? onSeeAll : undefined}
    >
      {isLoading && items.length === 0 ? (
        <SectionSkeleton variant={layout} />
      ) : (
        items.map((a) => {
          const selection: CollectionSelection = { type: 'collection', ref: collectionToRef(a), name: a.name };
          return (
            <LibraryCard
              key={`${a.provider}-${a.id}`}
              kind="album"
              id={a.id}
              provider={a.provider}
              selection={selection}
              name={a.name}
              subtitle={a.ownerName}
              imageUrl={a.imageUrl}
              showProviderBadge={showProviderBadges}
              variant={layout === 'row' ? 'row' : 'grid'}
              onSelect={() => onSelect(selection)}
              onContextMenuRequest={onContextMenuRequest}
            />
          );
        })
      )}
    </Section>
  );
};

AlbumsSection.displayName = 'AlbumsSection';
export default AlbumsSection;
