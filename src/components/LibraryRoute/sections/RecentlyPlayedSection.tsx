import React from 'react';
import type { ProviderId } from '@/types/domain';
import { useRecentlyPlayedSection } from '../hooks';
import type { ContextMenuRequest, LibraryItemKind } from '../types';
import Section from './Section';
import SectionSkeleton from './SectionSkeleton';
import LibraryCard from '../card/LibraryCard';

const SEE_ALL_THRESHOLD = 4;

export interface RecentlyPlayedSectionProps {
  layout: 'row' | 'grid';
  showProviderBadges?: boolean;
  onSelect: (kind: LibraryItemKind, id: string, name: string, provider?: ProviderId) => void;
  onSeeAll?: () => void;
  onContextMenuRequest?: (req: ContextMenuRequest) => void;
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
          let cardKind: LibraryItemKind;
          let cardId: string;
          if (ref.kind === 'liked') {
            cardKind = 'liked';
            cardId = 'liked';
          } else if (ref.kind === 'album') {
            cardKind = 'album';
            cardId = ref.id;
          } else {
            cardKind = 'playlist';
            cardId = ref.id;
          }
          const refOriginalKind: 'playlist' | 'album' | 'liked' =
            ref.kind === 'liked' ? 'liked' : ref.kind === 'album' ? 'album' : 'playlist';
          const wrappedContextMenu = onContextMenuRequest
            ? (req: ContextMenuRequest) => {
                onContextMenuRequest({
                  ...req,
                  kind: 'recently-played',
                  originalKind: refOriginalKind,
                  recentRef: { kind: refOriginalKind, id: cardId, provider: ref.provider },
                });
              }
            : undefined;
          return (
            <LibraryCard
              key={`${ref.provider}-${ref.kind}-${cardId}`}
              kind={cardKind}
              id={cardId}
              provider={ref.provider}
              name={name}
              imageUrl={imageUrl ?? undefined}
              showProviderBadge={showProviderBadges}
              variant={layout === 'row' ? 'row' : 'grid'}
              onSelect={() => onSelect(cardKind, cardId, name, ref.provider)}
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
