import React from 'react';
import type { ProviderId } from '@/types/domain';
import { useAlbumsSection } from '../hooks';
import type { ContextMenuRequest, LibraryItemKind } from '../types';
import Section from './Section';
import SectionSkeleton from './SectionSkeleton';
import LibraryCard from '../card/LibraryCard';

const SEE_ALL_THRESHOLD = 8;

export interface AlbumsSectionProps {
  layout: 'row' | 'grid';
  excludePinned?: boolean;
  showProviderBadges?: boolean;
  onSelect: (kind: LibraryItemKind, id: string, name: string, provider?: ProviderId) => void;
  onSeeAll?: () => void;
  onContextMenuRequest?: (req: ContextMenuRequest) => void;
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
        items.map((a) => (
          <LibraryCard
            key={`${a.provider ?? 'spotify'}-${a.id}`}
            kind="album"
            id={a.id}
            provider={a.provider}
            name={a.name}
            subtitle={a.artists}
            imageUrl={a.images?.[0]?.url}
            showProviderBadge={showProviderBadges}
            variant={layout === 'row' ? 'row' : 'grid'}
            onSelect={() => onSelect('album', a.id, a.name, a.provider)}
            onContextMenuRequest={onContextMenuRequest}
          />
        ))
      )}
    </Section>
  );
};

AlbumsSection.displayName = 'AlbumsSection';
export default AlbumsSection;
