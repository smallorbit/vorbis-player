import React from 'react';
import type { ProviderId } from '@/types/domain';
import { useProviderContext } from '@/contexts/ProviderContext';
import {
  RecentlyPlayedSection,
  PinnedSection,
  PlaylistsSection,
  AlbumsSection,
} from '../sections';
import { BackToLibraryIcon } from '@/components/icons/QuickActionIcons';
import type { ContextMenuRequest, LibraryItemKind, LibraryRouteView } from '../types';
import { SeeAllRoot, BackBar, BackButton, BackTitle } from './views.styled';

const TITLES: Record<Exclude<LibraryRouteView, 'home' | 'liked' | 'search'>, string> = {
  'recently-played': 'Recently Played',
  pinned: 'Pinned',
  playlists: 'Playlists',
  albums: 'Albums',
};

export interface SeeAllViewProps {
  view: Exclude<LibraryRouteView, 'home' | 'liked' | 'search'>;
  onBack: () => void;
  onSelectCollection: (
    kind: LibraryItemKind,
    id: string,
    name: string,
    provider?: ProviderId,
  ) => void;
  onContextMenuRequest?: (req: ContextMenuRequest) => void;
}

const SeeAllView: React.FC<SeeAllViewProps> = ({
  view,
  onBack,
  onSelectCollection,
  onContextMenuRequest,
}) => {
  const { hasMultipleProviders } = useProviderContext();
  const showProviderBadges = hasMultipleProviders;

  const sectionProps = {
    layout: 'grid' as const,
    showProviderBadges,
    onSelect: onSelectCollection,
    onContextMenuRequest,
  };

  return (
    <SeeAllRoot data-testid={`library-see-all-${view}`}>
      <BackBar>
        <BackButton type="button" onClick={onBack} aria-label="Back to library home" data-testid="library-see-all-back">
          <BackToLibraryIcon />
        </BackButton>
        <BackTitle>{TITLES[view]}</BackTitle>
      </BackBar>
      {view === 'recently-played' && <RecentlyPlayedSection {...sectionProps} />}
      {view === 'pinned' && <PinnedSection {...sectionProps} />}
      {view === 'playlists' && <PlaylistsSection {...sectionProps} excludePinned={false} />}
      {view === 'albums' && <AlbumsSection {...sectionProps} excludePinned={false} />}
    </SeeAllRoot>
  );
};

SeeAllView.displayName = 'SeeAllView';
export default SeeAllView;
