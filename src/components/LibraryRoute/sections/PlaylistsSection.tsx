import React from 'react';
import type { CollectionSelection } from '@/types/domain';
import { collectionToRef } from '@/types/domain';
import { usePlaylistsSection } from '../hooks';
import type { ContextMenuRequest } from '../types';
import Section from './Section';
import SectionSkeleton from './SectionSkeleton';
import LibraryCard from '../card/LibraryCard';

const SEE_ALL_THRESHOLD = 8;

interface PlaylistsSectionProps {
  layout: 'row' | 'grid';
  excludePinned?: boolean | undefined;
  showProviderBadges?: boolean | undefined;
  onSelect: (selection: CollectionSelection) => void;
  onSeeAll?: (() => void) | undefined;
  onContextMenuRequest?: ((req: ContextMenuRequest) => void) | undefined;
}

const PlaylistsSection: React.FC<PlaylistsSectionProps> = ({
  layout,
  excludePinned = true,
  showProviderBadges,
  onSelect,
  onSeeAll,
  onContextMenuRequest,
}) => {
  const { items, isLoading, isEmpty } = usePlaylistsSection({ excludePinned });
  if (!isLoading && isEmpty) return null;

  const showSeeAll = layout === 'row' && items.length > SEE_ALL_THRESHOLD;

  return (
    <Section
      title="Playlists"
      id="playlists"
      layout={layout}
      onSeeAll={showSeeAll ? onSeeAll : undefined}
    >
      {isLoading && items.length === 0 ? (
        <SectionSkeleton variant={layout} />
      ) : (
        items.map((p) => {
          const selection: CollectionSelection = { type: 'collection', ref: collectionToRef(p), name: p.name };
          return (
            <LibraryCard
              key={`${p.provider}-${p.id}`}
              kind="playlist"
              id={p.id}
              provider={p.provider}
              selection={selection}
              name={p.name}
              imageUrl={p.imageUrl}
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

PlaylistsSection.displayName = 'PlaylistsSection';
export default PlaylistsSection;
