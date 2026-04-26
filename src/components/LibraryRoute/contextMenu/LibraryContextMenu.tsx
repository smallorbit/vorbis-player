import React, { useCallback, useMemo } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { usePinnedItems } from '@/hooks/usePinnedItems';
import { useRecentlyPlayedCollections } from '@/hooks/useRecentlyPlayedCollections';
import { useLikedSection } from '../hooks';
import type { ContextMenuRequest } from '../types';
import type { ProviderId, MediaTrack } from '@/types/domain';
import { useLikedTracksForProvider } from './useLikedTracksForProvider';
import {
  buildMenuItems,
  type MenuActions,
  type MenuItem,
} from './menuItemsForKind';
import { MenuItemButton, MenuRoot, VirtualAnchor } from './LibraryContextMenu.styled';

const PROVIDER_LABEL: Record<string, string> = {
  spotify: 'Spotify',
  dropbox: 'Dropbox',
};

function providerLabel(provider: ProviderId): string {
  return PROVIDER_LABEL[provider] ?? provider;
}

export interface LibraryContextMenuProps {
  request: ContextMenuRequest | null;
  onClose: () => void;
  onPlayCollection: (
    kind: 'playlist' | 'album',
    id: string,
    name: string,
    provider?: ProviderId,
  ) => void;
  onAddToQueue?: (id: string, name: string, provider?: ProviderId) => void | Promise<unknown>;
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
  onPlayLikedTracks: (
    tracks: MediaTrack[],
    collectionId: string,
    collectionName: string,
    provider?: ProviderId,
  ) => Promise<void> | void;
}

const LibraryContextMenu: React.FC<LibraryContextMenuProps> = ({
  request,
  onClose,
  onPlayCollection,
  onAddToQueue,
  onPlayNext,
  onStartRadioForCollection,
  onPlayLikedTracks,
}) => {
  const {
    isPlaylistPinned,
    isAlbumPinned,
    togglePinPlaylist,
    togglePinAlbum,
  } = usePinnedItems();
  const { remove: removeRecent } = useRecentlyPlayedCollections();
  const { perProvider } = useLikedSection();
  const { loadLikedTracks } = useLikedTracksForProvider();

  const closeAfter = useCallback(
    (fn: () => void | Promise<unknown>): (() => void) =>
      () => {
        onClose();
        Promise.resolve(fn()).catch(() => {
          /* swallow — toast surfaces user-facing errors */
        });
      },
    [onClose],
  );

  const playNextDisabled = !onPlayNext;
  const startRadioDisabled = !onStartRadioForCollection;

  const items = useMemo<MenuItem[]>(() => {
    if (!request) return [];

    const effectiveKind: 'playlist' | 'album' | 'liked' =
      request.kind === 'recently-played'
        ? request.originalKind ?? 'playlist'
        : (request.kind as 'playlist' | 'album' | 'liked');

    const isPlaylistKind = effectiveKind === 'playlist';
    const isAlbumKind = effectiveKind === 'album';
    const isLikedKind = effectiveKind === 'liked';

    const isPinned = isPlaylistKind
      ? isPlaylistPinned(request.id)
      : isAlbumKind
        ? isAlbumPinned(request.id)
        : false;

    const togglePin = isPlaylistKind
      ? () => togglePinPlaylist(request.id)
      : () => togglePinAlbum(request.id);

    const noopAction = () => {};

    const playLikedFor = async (provider: ProviderId) => {
      const tracks = await loadLikedTracks(provider);
      if (tracks.length === 0) return;
      await onPlayLikedTracks(tracks, `liked-${provider}`, 'Liked Songs', provider);
    };

    const likedProviderActions = isLikedKind
      ? perProvider.map((entry) => ({
          provider: entry.provider,
          label: `Play (${providerLabel(entry.provider)})`,
          onPlay: closeAfter(() => playLikedFor(entry.provider)),
        }))
      : undefined;

    const actions: MenuActions = {
      onPlay: closeAfter(() => {
        if (isLikedKind) {
          // "Play All" routes through the library's own liked-handler via the parent.
          const inferred = perProvider[0]?.provider;
          if (inferred) void playLikedFor(inferred);
          return;
        }
        if (isPlaylistKind || isAlbumKind) {
          onPlayCollection(effectiveKind, request.id, request.name, request.provider);
        }
      }),
      onAddToQueue: closeAfter(() => {
        if (onAddToQueue) onAddToQueue(request.id, request.name, request.provider);
      }),
      onPlayNext: closeAfter(() => {
        if (onPlayNext && (isPlaylistKind || isAlbumKind)) {
          onPlayNext(effectiveKind, request.id, request.name, request.provider);
        }
      }),
      onTogglePin: closeAfter(togglePin),
      onStartRadio: closeAfter(() => {
        if (onStartRadioForCollection && (isPlaylistKind || isAlbumKind)) {
          onStartRadioForCollection(effectiveKind, request.id, request.provider);
        }
      }),
      isPinned,
      startRadioDisabled: startRadioDisabled || isLikedKind,
      playNextDisabled: playNextDisabled || isLikedKind,
      likedProviderActions,
    };

    if (request.kind === 'recently-played' && request.recentRef) {
      const recentRef = request.recentRef;
      actions.onRemoveFromHistory = closeAfter(() => {
        if (recentRef.kind === 'liked') {
          removeRecent({ provider: recentRef.provider as ProviderId, kind: 'liked' });
        } else if (recentRef.kind === 'album') {
          removeRecent({
            provider: recentRef.provider as ProviderId,
            kind: 'album',
            id: recentRef.id,
          });
        } else {
          removeRecent({
            provider: recentRef.provider as ProviderId,
            kind: 'playlist',
            id: recentRef.id,
          });
        }
      });
    }

    // Quiet noopAction lint when not used in some branches.
    void noopAction;

    return buildMenuItems(request, actions);
  }, [
    request,
    isPlaylistPinned,
    isAlbumPinned,
    togglePinPlaylist,
    togglePinAlbum,
    perProvider,
    onPlayCollection,
    onAddToQueue,
    onPlayNext,
    onStartRadioForCollection,
    onPlayLikedTracks,
    loadLikedTracks,
    removeRecent,
    closeAfter,
    playNextDisabled,
    startRadioDisabled,
  ]);

  if (!request) return null;

  const anchorStyle: React.CSSProperties = {
    left: request.anchorRect.left + request.anchorRect.width / 2,
    top: request.anchorRect.bottom,
  };

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverAnchor asChild>
        <VirtualAnchor aria-hidden style={anchorStyle} />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        data-testid="library-context-menu"
      >
        <MenuRoot role="menu" aria-label={`Actions for ${request.name}`}>
          {items.map((item) => (
            <MenuItemButton
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              $variant={item.variant}
              onClick={item.onSelect}
              data-testid={`menu-${item.id}`}
            >
              {item.label}
            </MenuItemButton>
          ))}
        </MenuRoot>
      </PopoverContent>
    </Popover>
  );
};

LibraryContextMenu.displayName = 'LibraryContextMenu';
export default LibraryContextMenu;
