import React from 'react';
import type { ProviderId } from '@/types/domain';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { useProviderContext } from '@/contexts/ProviderContext';
import {
  ResumeSection,
  RecentlyPlayedSection,
  PinnedSection,
  LikedSection,
  PlaylistsSection,
  AlbumsSection,
} from '../sections';
import type { ContextMenuRequest, LibraryItemKind, LibraryRouteView } from '../types';
import { HomeStack } from './views.styled';

export interface HomeViewProps {
  layout: 'row' | 'grid';
  lastSession: SessionSnapshot | null;
  onResume?: () => void;
  onSelectCollection: (
    kind: LibraryItemKind,
    id: string,
    name: string,
    provider?: ProviderId,
  ) => void;
  onSelectLiked: (provider?: ProviderId) => void;
  onNavigate: (view: LibraryRouteView) => void;
  onContextMenuRequest?: (req: ContextMenuRequest) => void;
}

const HomeView: React.FC<HomeViewProps> = ({
  layout,
  lastSession,
  onResume,
  onSelectCollection,
  onSelectLiked,
  onNavigate,
  onContextMenuRequest,
}) => {
  const { hasMultipleProviders } = useProviderContext();
  const showProviderBadges = hasMultipleProviders;

  return (
    <HomeStack data-testid="library-home">
      <ResumeSection lastSession={lastSession} onResume={onResume} />
      <RecentlyPlayedSection
        layout={layout}
        showProviderBadges={showProviderBadges}
        onSelect={onSelectCollection}
        onSeeAll={() => onNavigate('recently-played')}
        onContextMenuRequest={onContextMenuRequest}
      />
      <PinnedSection
        layout={layout}
        showProviderBadges={showProviderBadges}
        onSelect={onSelectCollection}
        onSeeAll={() => onNavigate('pinned')}
        onContextMenuRequest={onContextMenuRequest}
      />
      <LikedSection
        layout={layout}
        showProviderBadges={showProviderBadges}
        onSelectLiked={onSelectLiked}
        onContextMenuRequest={onContextMenuRequest}
      />
      <PlaylistsSection
        layout={layout}
        showProviderBadges={showProviderBadges}
        onSelect={onSelectCollection}
        onSeeAll={() => onNavigate('playlists')}
        onContextMenuRequest={onContextMenuRequest}
      />
      <AlbumsSection
        layout={layout}
        showProviderBadges={showProviderBadges}
        onSelect={onSelectCollection}
        onSeeAll={() => onNavigate('albums')}
        onContextMenuRequest={onContextMenuRequest}
      />
    </HomeStack>
  );
};

HomeView.displayName = 'HomeView';
export default HomeView;
