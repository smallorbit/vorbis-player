import { useMemo } from 'react';
import { usePinnedItems } from '@/hooks/usePinnedItems';
import { useRecentlyPlayedCollections } from '@/hooks/useRecentlyPlayedCollections';
import { useLikedSection } from '../hooks';
import type { ContextMenuRequest } from '../types';
import type { ProviderId, MediaTrack } from '@/types/domain';
import { useLikedTracksForProvider } from './useLikedTracksForProvider';
import { useAlbumSavedStatus } from './useAlbumSavedStatus';
import { useQueueLikedFromCollection } from './useQueueLikedFromCollection';
import { toAlbumPlaylistId } from '@/constants/playlist';
import { buildMenuItems, type MenuActions, type MenuItem } from './menuItemsForKind';

const PROVIDER_LABEL: Record<string, string> = {
  spotify: 'Spotify',
  dropbox: 'Dropbox',
};

function providerLabel(provider: ProviderId): string {
  return PROVIDER_LABEL[provider] ?? provider;
}

export interface UseMenuItemsCallbacks {
  closeAfter: (label: string, fn: () => void | Promise<unknown>) => () => void;
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

export function useMenuItems(
  request: ContextMenuRequest | null,
  callbacks: UseMenuItemsCallbacks,
): MenuItem[] {
  const {
    closeAfter,
    onPlayCollection,
    onAddToQueue,
    onPlayNext,
    onStartRadioForCollection,
    onPlayLikedTracks,
    onQueueLikedTracks,
  } = callbacks;

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

  const playNextDisabled = !onPlayNext;
  const startRadioDisabled = !onStartRadioForCollection;

  return useMemo<MenuItem[]>(() => {
    if (!request) return [];

    const effectiveKind: 'playlist' | 'album' | 'liked' =
      request.kind === 'recently-played' ? request.originalKind : request.kind;

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
      ? perProvider.map((entry) => {
          const entryLabel = `Play (${providerLabel(entry.provider)})`;
          return {
            provider: entry.provider,
            label: entryLabel,
            onPlay: closeAfter(entryLabel, () => playLikedFor(entry.provider)),
          };
        })
      : undefined;

    const actions: MenuActions = {
      onPlay: closeAfter('Play', () => {
        if (isLikedKind) {
          const inferred = perProvider[0]?.provider;
          if (inferred) void playLikedFor(inferred);
          return;
        }
        if (isPlaylistKind || isAlbumKind) {
          onPlayCollection(effectiveKind, request.id, request.name, request.provider);
        }
      }),
      onAddToQueue: closeAfter('Add to Queue', () => {
        if (onAddToQueue) {
          const id = isAlbumKind ? toAlbumPlaylistId(request.id) : request.id;
          onAddToQueue(id, request.name, request.provider);
        }
      }),
      onPlayNext: closeAfter('Play Next', () => {
        if (onPlayNext && (isPlaylistKind || isAlbumKind)) {
          const id = isAlbumKind ? toAlbumPlaylistId(request.id) : request.id;
          onPlayNext(effectiveKind, id, request.name, request.provider);
        }
      }),
      onTogglePin: closeAfter(isPinned ? 'Unpin' : 'Pin', togglePin),
      onStartRadio: closeAfter('Start Radio', () => {
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
      actions.onToggleSave = closeAfter(isSaved ? 'Unlike' : 'Like', toggleSaved);
    }

    if ((isPlaylistKind || isAlbumKind) && onQueueLikedTracks && request.provider) {
      const collectionId = request.id;
      const collectionName = request.name;
      const provider = request.provider;
      actions.onQueueLikedFromCollection = closeAfter('Queue Liked Songs', () =>
        queueLikedFromCollection(collectionId, collectionName, provider, effectiveKind),
      );
    }

    if (request.kind === 'recently-played' && request.recentRef) {
      const recentRef = request.recentRef;
      actions.onRemoveFromHistory = closeAfter('Remove from history', () => removeRecent(recentRef));
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
}
