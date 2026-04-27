import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import type { ProviderId, AddToQueueResult, MediaTrack } from '@/types/domain';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { toAlbumPlaylistId, LIKED_SONGS_ID } from '@/constants/playlist';
import { LibraryRouteRoot, MobileLayout, DesktopLayout } from './styled';
import HomeView from './views/HomeView';
import SeeAllView from './views/SeeAllView';
import SearchResultsView from './views/SearchResultsView';
import type { ContextMenuRequest, LibraryItemKind, LibraryRouteView } from './types';
import MiniPlayer from './MiniPlayer/MiniPlayer';
import SearchBar from './search/SearchBar';
import CommandPalette from './search/CommandPalette';
import { useLibrarySearch } from './search/useLibrarySearch';
import { useCommandPaletteShortcut } from './search/useCommandPaletteShortcut';
import LibraryContextMenu from './contextMenu/LibraryContextMenu';
import { LibraryContextMenuOpenContext } from './contextMenu/LibraryContextMenuOpenContext';

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
  onPlayNext?: (
    kind: 'playlist' | 'album',
    id: string,
    name: string,
    provider?: ProviderId,
  ) => void;
  onStartRadioForCollection?: (
    kind: 'playlist' | 'album',
    id: string,
    provider?: ProviderId,
  ) => void;
  isPlaying: boolean;
  isRadioAvailable?: boolean;
  isRadioGenerating?: boolean;
  onMiniPlay: () => void;
  onMiniPause: () => void;
  onMiniNext: () => void;
  onMiniPrevious: () => void;
  onMiniExpand: () => void;
  onMiniStartRadio?: () => void;
  onClose?: () => void;
}

const LibraryRoute: React.FC<LibraryRouteProps> = ({
  onPlaylistSelect,
  onPlayLikedTracks,
  onQueueLikedTracks,
  onResume,
  lastSession,
  onAddToQueue,
  onPlayNext,
  onStartRadioForCollection,
  isPlaying,
  isRadioAvailable,
  isRadioGenerating,
  onMiniPlay,
  onMiniPause,
  onMiniNext,
  onMiniPrevious,
  onMiniExpand,
  onMiniStartRadio,
  onClose,
}) => {
  const { isMobile } = usePlayerSizingContext();
  const [view, setView] = useState<LibraryRouteView>('home');
  const search = useLibrarySearch();
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteShortcut(() => setPaletteOpen(true), !isMobile);

  useEffect(() => {
    if (!onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = (e.composedPath?.()[0] ?? e.target) as HTMLElement | null;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelectCollection = useCallback(
    (kind: LibraryItemKind, id: string, name: string, provider?: ProviderId) => {
      if (search.isSearching) search.setQuery('');
      if (kind === 'liked') {
        onPlaylistSelect(LIKED_SONGS_ID, name, provider);
        return;
      }
      if (kind === 'album') {
        onPlaylistSelect(toAlbumPlaylistId(id), name, provider);
        return;
      }
      onPlaylistSelect(id, name, provider);
    },
    [onPlaylistSelect, search],
  );

  const [contextRequest, setContextRequest] = useState<ContextMenuRequest | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const handleContextMenuRequest = useCallback((req: ContextMenuRequest) => {
    triggerRef.current = req.triggerElement ?? null;
    setContextRequest(req);
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextRequest(null);
  }, []);

  const handleReturnFocusClose = useCallback(() => {
    setContextRequest(null);
    triggerRef.current?.focus();
  }, []);

  const handlePlayCollection = useCallback(
    (kind: 'playlist' | 'album', id: string, name: string, provider?: ProviderId) => {
      handleSelectCollection(kind, id, name, provider);
    },
    [handleSelectCollection],
  );

  const handleAddToQueueAction = useCallback(
    (id: string, name: string, provider?: ProviderId) => {
      void onAddToQueue?.(id, name, provider);
    },
    [onAddToQueue],
  );

  const handlePlayLikedFromMenu = useCallback(
    async (
      tracks: MediaTrack[],
      collectionId: string,
      collectionName: string,
      provider?: ProviderId,
    ) => {
      if (!onPlayLikedTracks) return;
      await onPlayLikedTracks(tracks, collectionId, collectionName, provider);
    },
    [onPlayLikedTracks],
  );

  const layout: 'row' | 'grid' = isMobile ? 'row' : 'grid';
  const Layout = isMobile ? MobileLayout : DesktopLayout;
  const layoutTestId = isMobile ? 'library-route-mobile' : 'library-route-desktop';

  const effectiveView: LibraryRouteView = search.isSearching ? 'search' : view;

  let body: React.ReactNode;
  if (effectiveView === 'search') {
    body = (
      <SearchResultsView
        search={search}
        onSelectCollection={handleSelectCollection}
        onContextMenuRequest={handleContextMenuRequest}
      />
    );
  } else if (effectiveView === 'home' || effectiveView === 'liked') {
    body = (
      <HomeView
        layout={layout}
        lastSession={lastSession ?? null}
        onResume={onResume}
        onSelectCollection={handleSelectCollection}
        onNavigate={setView}
        onContextMenuRequest={handleContextMenuRequest}
      />
    );
  } else {
    body = (
      <SeeAllView
        view={effectiveView as Exclude<LibraryRouteView, 'home' | 'liked' | 'search'>}
        onBack={() => setView('home')}
        onSelectCollection={handleSelectCollection}
        onContextMenuRequest={handleContextMenuRequest}
      />
    );
  }

  const contextMenuOpenKey = contextRequest
    ? `${contextRequest.kind}:${contextRequest.provider ?? '-'}:${contextRequest.id}`
    : null;

  return (
    <LibraryContextMenuOpenContext.Provider value={contextMenuOpenKey}>
    <LibraryRouteRoot>
      <Layout data-testid={layoutTestId}>
        {!isMobile && <SearchBar variant="desktop" search={search} />}
        {body}
      </Layout>
      {isMobile && <SearchBar variant="mobile" search={search} />}
      <LibraryContextMenu
        request={contextRequest}
        onClose={handleCloseContextMenu}
        onReturnFocusClose={handleReturnFocusClose}
        onPlayCollection={handlePlayCollection}
        onAddToQueue={handleAddToQueueAction}
        onPlayNext={onPlayNext}
        onStartRadioForCollection={onStartRadioForCollection}
        onPlayLikedTracks={handlePlayLikedFromMenu}
        onQueueLikedTracks={onQueueLikedTracks}
      />
      <MiniPlayer
        isPlaying={isPlaying}
        isRadioAvailable={isRadioAvailable}
        isRadioGenerating={isRadioGenerating}
        onPlay={onMiniPlay}
        onPause={onMiniPause}
        onNext={onMiniNext}
        onPrevious={onMiniPrevious}
        onExpand={onMiniExpand}
        onStartRadio={onMiniStartRadio}
      />
      {!isMobile && (
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSelectCollection={handleSelectCollection}
        />
      )}
    </LibraryRouteRoot>
    </LibraryContextMenuOpenContext.Provider>
  );
};

LibraryRoute.displayName = 'LibraryRoute';
export default LibraryRoute;
