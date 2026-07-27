import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import type { AddToQueueResult, CollectionRef, CollectionSelection, MediaTrack } from '@/types/domain';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { LibraryRouteRoot, MobileLayout, DesktopLayout } from './styled';
import HomeView from './views/HomeView';
import SeeAllView from './views/SeeAllView';
import SearchResultsView from './views/SearchResultsView';
import type { ContextMenuRequest, LibraryRouteView } from './types';
import MiniPlayer from './MiniPlayer/MiniPlayer';
import SearchBar from './search/SearchBar';
import { useLibrarySearch } from './search/useLibrarySearch';
import LibraryContextMenu from './contextMenu/LibraryContextMenu';
import { LibraryContextMenuOpenContext } from './contextMenu/LibraryContextMenuOpenContext';

interface LibraryRouteProps {
  onSelectCollection: (selection: CollectionSelection) => void;
  onAddToQueue: (selection: CollectionSelection) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: ((
    tracks: MediaTrack[],
    selection: CollectionSelection,
  ) => Promise<void>) | undefined;
  onQueueLikedTracks?: ((tracks: MediaTrack[], collectionName?: string) => void) | undefined;
  onResume?: (() => void) | undefined;
  lastSession?: SessionSnapshot | null | undefined;
  onPlayNext?: ((selection: CollectionSelection) => void) | undefined;
  onStartRadioForCollection?: ((ref: CollectionRef) => void) | undefined;
  initialSearchQuery?: string | undefined;
  isPlaying: boolean;
  isRadioAvailable?: boolean | undefined;
  isRadioGenerating?: boolean | undefined;
  onMiniPlay: () => void;
  onMiniPause: () => void;
  onMiniNext: () => void;
  onMiniPrevious: () => void;
  onMiniExpand: () => void;
  onMiniStartRadio?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
}

const LibraryRoute: React.FC<LibraryRouteProps> = ({
  onSelectCollection,
  onPlayLikedTracks,
  onQueueLikedTracks,
  onResume,
  lastSession,
  onAddToQueue,
  onPlayNext,
  onStartRadioForCollection,
  initialSearchQuery,
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
  // initialSearchQuery seeds the search input once on mount. Subsequent prop changes
  // are ignored — safe today because AudioPlayer clears pendingLibraryQueryRef before
  // rendering LibraryRoute (ref-clear-on-read), so each library open gets a fresh prop.
  // If LibraryRoute is ever kept mounted across opens, the seed-once behavior will stale.
  const search = useLibrarySearch(initialSearchQuery);
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
    (selection: CollectionSelection) => {
      if (search.isSearching) search.setQuery('');
      onSelectCollection(selection);
    },
    [onSelectCollection, search],
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

  const handleAddToQueueAction = useCallback(
    (selection: CollectionSelection) => {
      void onAddToQueue(selection);
    },
    [onAddToQueue],
  );

  const handlePlayLikedFromMenu = useCallback(
    async (tracks: MediaTrack[], selection: CollectionSelection) => {
      if (!onPlayLikedTracks) return;
      await onPlayLikedTracks(tracks, selection);
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
  } else if (effectiveView === 'home') {
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
        view={effectiveView}
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
        onPlayCollection={handleSelectCollection}
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

    </LibraryRouteRoot>
    </LibraryContextMenuOpenContext.Provider>
  );
};

LibraryRoute.displayName = 'LibraryRoute';
export default LibraryRoute;
