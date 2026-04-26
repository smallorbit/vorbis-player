import React, { useCallback, useState } from 'react';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import type { ProviderId, AddToQueueResult, MediaTrack } from '@/types/domain';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { toAlbumPlaylistId } from '@/constants/playlist';
import { LibraryRouteRoot, MobileLayout, DesktopLayout } from './styled';
import HomeView from './views/HomeView';
import SeeAllView from './views/SeeAllView';
import { fetchLikedForProvider } from './hooks';
import type { ContextMenuRequest, LibraryItemKind, LibraryRouteView } from './types';

// LibraryRoute assumes upstream guards have already filtered out cold-start cases:
// - AudioPlayer.tsx routes to ProviderSetupScreen when needsSetup === true
// - PlayerStateRenderer.tsx routes to WelcomeScreen when !welcomeSeen
// If this component renders, at least one provider is connected AND welcome has been dismissed.

export interface LibraryRouteProps {
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (id: string, name?: string, provider?: ProviderId) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: (
    tracks: MediaTrack[],
    collectionId: string,
    collectionName: string,
    provider?: ProviderId,
  ) => Promise<void>;
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
  onOpenSettings: () => void;
  onResume?: () => void;
  lastSession?: SessionSnapshot | null;
}

const LibraryRoute: React.FC<LibraryRouteProps> = ({
  onPlaylistSelect,
  onPlayLikedTracks,
  onResume,
  lastSession,
}) => {
  const { isMobile } = usePlayerSizingContext();
  const [view, setView] = useState<LibraryRouteView>('home');
  const { unifiedTracks, isUnifiedLikedActive } = useUnifiedLikedTracks();

  const handleSelectCollection = useCallback(
    (kind: LibraryItemKind, id: string, name: string, provider?: ProviderId) => {
      if (kind === 'album') {
        onPlaylistSelect(toAlbumPlaylistId(id), name, provider);
        return;
      }
      // playlist or recently-played-as-playlist: pass id through
      onPlaylistSelect(id, name, provider);
    },
    [onPlaylistSelect],
  );

  const handleSelectLiked = useCallback(
    async (provider?: ProviderId) => {
      if (!onPlayLikedTracks) return;
      // Why: when unified-liked is active and no provider was specified, the in-memory
      // unifiedTracks list is the source. For a per-provider liked tile the unified list
      // may not be authoritative for that single provider, so fetch it directly.
      let tracks: MediaTrack[];
      let collectionId: string;
      let providerArg: ProviderId | undefined;
      if (provider) {
        tracks = await fetchLikedForProvider(provider);
        collectionId = `liked-${provider}`;
        providerArg = provider;
      } else if (isUnifiedLikedActive) {
        tracks = unifiedTracks;
        collectionId = 'liked-unified';
        providerArg = undefined;
      } else {
        // single-provider, non-unified path — fall back to the active provider's liked
        const inferred: ProviderId = unifiedTracks[0]?.provider ?? 'spotify';
        tracks = await fetchLikedForProvider(inferred);
        collectionId = `liked-${inferred}`;
        providerArg = inferred;
      }
      if (tracks.length === 0) return;
      await onPlayLikedTracks(tracks, collectionId, 'Liked Songs', providerArg);
    },
    [onPlayLikedTracks, isUnifiedLikedActive, unifiedTracks],
  );

  const handleContextMenuRequest = useCallback((req: ContextMenuRequest) => {
    // #1297 will mount the context menu portal. For #1294 the request is logged in dev
    // so click affordances are visible during integration without forcing menu shape now.
    if (import.meta.env.DEV) {
      console.debug('[LibraryRoute] context menu requested', req);
    }
  }, []);

  const layout: 'row' | 'grid' = isMobile ? 'row' : 'grid';
  const Layout = isMobile ? MobileLayout : DesktopLayout;
  const layoutTestId = isMobile ? 'library-route-mobile' : 'library-route-desktop';

  return (
    <LibraryRouteRoot>
      <Layout data-testid={layoutTestId}>
        {view === 'home' ? (
          <HomeView
            layout={layout}
            lastSession={lastSession ?? null}
            onResume={onResume}
            onSelectCollection={handleSelectCollection}
            onSelectLiked={handleSelectLiked}
            onNavigate={setView}
            onContextMenuRequest={handleContextMenuRequest}
          />
        ) : view === 'liked' ? (
          // Liked has no SeeAll page — fall back to home defensively if navigated here.
          <HomeView
            layout={layout}
            lastSession={lastSession ?? null}
            onResume={onResume}
            onSelectCollection={handleSelectCollection}
            onSelectLiked={handleSelectLiked}
            onNavigate={setView}
            onContextMenuRequest={handleContextMenuRequest}
          />
        ) : (
          <SeeAllView
            view={view}
            onBack={() => setView('home')}
            onSelectCollection={handleSelectCollection}
            onContextMenuRequest={handleContextMenuRequest}
          />
        )}
      </Layout>
    </LibraryRouteRoot>
  );
};

LibraryRoute.displayName = 'LibraryRoute';
export default LibraryRoute;
