import React, { useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { usePinnedItems } from '@/hooks/usePinnedItems';
import { useRecentlyPlayedCollections } from '@/hooks/useRecentlyPlayedCollections';
import { useLikedSection } from '../hooks';
import type { ContextMenuRequest } from '../types';
import type { ProviderId, MediaTrack } from '@/types/domain';
import { useLikedTracksForProvider } from './useLikedTracksForProvider';
import { useAlbumSavedStatus } from './useAlbumSavedStatus';
import { useQueueLikedFromCollection } from './useQueueLikedFromCollection';
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
  onReturnFocusClose: () => void;
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
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
}

const LibraryContextMenu: React.FC<LibraryContextMenuProps> = ({
  request,
  onClose,
  onReturnFocusClose,
  onPlayCollection,
  onAddToQueue,
  onPlayNext,
  onStartRadioForCollection,
  onPlayLikedTracks,
  onQueueLikedTracks,
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
  const { queueLikedFromCollection } = useQueueLikedFromCollection(onQueueLikedTracks);

  const closeReasonRef = useRef<'return' | null>(null);

  const albumIdForSaveStatus =
    request?.kind === 'album'
      ? request.id
      : request?.kind === 'recently-played' && request.originalKind === 'album'
        ? request.id
        : null;
  const { isSaved, toggleSaved, canToggle: canToggleSaved } = useAlbumSavedStatus(
    albumIdForSaveStatus,
    request?.provider,
  );

  const closeAfter = useCallback(
    (fn: () => void | Promise<unknown>): (() => void) =>
      () => {
        onReturnFocusClose();
        Promise.resolve(fn()).catch(() => {
          toast("Couldn't complete that action. Try again.");
        });
      },
    [onReturnFocusClose],
  );

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    );
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    }
  }, []);

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

    if (isAlbumKind && canToggleSaved && isSaved !== null) {
      actions.onToggleSave = closeAfter(toggleSaved);
      actions.isSaved = isSaved;
    }

    if ((isPlaylistKind || isAlbumKind) && onQueueLikedTracks && request.provider) {
      const collectionId = request.id;
      const collectionName = request.name;
      const provider = request.provider;
      actions.onQueueLikedFromCollection = closeAfter(() =>
        queueLikedFromCollection(collectionId, collectionName, provider, effectiveKind),
      );
    }

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
    canToggleSaved,
    isSaved,
    toggleSaved,
    onQueueLikedTracks,
    queueLikedFromCollection,
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
        if (!open) {
          const shouldReturn = closeReasonRef.current === 'return';
          closeReasonRef.current = null;
          if (shouldReturn) onReturnFocusClose();
          else onClose();
        }
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
        onEscapeKeyDown={() => {
          closeReasonRef.current = 'return';
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const container = e.currentTarget as HTMLElement | null;
          const first = container?.querySelector<HTMLButtonElement>(
            '[role="menuitem"]:not(:disabled)',
          );
          first?.focus();
        }}
      >
        <MenuRoot
          role="menu"
          aria-label={`Actions for ${request.name}`}
          onKeyDown={handleMenuKeyDown}
        >
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
