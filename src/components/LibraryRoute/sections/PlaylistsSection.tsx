import React from 'react';
import type { ProviderId } from '@/types/domain';
import { usePlaylistsSection } from '../hooks';
import type { ContextMenuRequest, LibraryItemKind } from '../types';
import Section from './Section';
import SectionSkeleton from './SectionSkeleton';
import LibraryCard from '../card/LibraryCard';

const SEE_ALL_THRESHOLD = 8;

export interface PlaylistsSectionProps {
  layout: 'row' | 'grid';
  excludePinned?: boolean;
  showProviderBadges?: boolean;
  onSelect: (kind: LibraryItemKind, id: string, name: string, provider?: ProviderId) => void;
  onSeeAll?: () => void;
  onContextMenuRequest?: (req: ContextMenuRequest) => void;
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
        items.map((p) => (
          <LibraryCard
            key={`${p.provider ?? 'spotify'}-${p.id}`}
            kind="playlist"
            id={p.id}
            provider={p.provider}
            name={p.name}
            imageUrl={p.images?.[0]?.url}
            showProviderBadge={showProviderBadges}
            variant={layout === 'row' ? 'row' : 'grid'}
            onSelect={() => onSelect('playlist', p.id, p.name, p.provider)}
            onContextMenuRequest={onContextMenuRequest}
          />
        ))
      )}
    </Section>
  );
};

PlaylistsSection.displayName = 'PlaylistsSection';
export default PlaylistsSection;
