import { useCallback } from 'react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import type { AlbumInfo, PlaylistInfo } from '../../services/spotify';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import { LIKED_SONGS_ID, isAlbumId, toAlbumPlaylistId } from '@/constants/playlist';
import TrackInfoPopover from '../controls/TrackInfoPopover';
import Toast from '../Toast';
import { useItemPopover } from './useItemPopover';
import { useLikedTracksActions } from './useLikedTracksActions';
import { useDeleteCollectionFlow } from './useDeleteCollectionFlow';
import { useAlbumSavedStatus } from './useAlbumSavedStatus';
import {
  buildBaseCollectionOptions,
  buildLikedOptions,
  buildSaveAlbumOption,
  buildExternalLinkOptions,
  buildDeletePlaylistOption,
} from './popoverOptions';

interface UseItemActionsProps {
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (playlistId: string, playlistName?: string, provider?: ProviderId) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: (tracks: MediaTrack[], collectionId: string, collectionName: string, provider?: ProviderId) => Promise<void>;
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
  activeDescriptor: ProviderDescriptor | null;
  getDescriptor: (id: ProviderId) => ProviderDescriptor | undefined;
  removeCollection: (id: string) => void;
}

export function useItemActions({
  onPlaylistSelect,
  onAddToQueue,
  onPlayLikedTracks,
  onQueueLikedTracks,
  activeDescriptor,
  getDescriptor,
  removeCollection,
}: UseItemActionsProps) {
  const { popover, openAlbum, openPlaylist, close: closePopover } = useItemPopover();
  const { albumSaved, saveError, clearSaveError, buildToggleSaveHandler } = useAlbumSavedStatus(popover, activeDescriptor, getDescriptor);
  const { openDelete, confirmDeletePortal } = useDeleteCollectionFlow(getDescriptor, activeDescriptor, removeCollection);

  const albumDescriptor = popover?.kind === 'album'
    ? (popover.album.provider ? getDescriptor(popover.album.provider) : activeDescriptor)
    : null;

  const playlistDescriptor = popover?.kind === 'playlist'
    ? (() => {
        const provider = popover.playlist.provider ?? activeDescriptor?.id;
        return provider ? getDescriptor(provider) : activeDescriptor;
      })()
    : null;

  const { likedLoading, handlePlayLiked, handleQueueLiked } = useLikedTracksActions(
    popover?.kind === 'album' ? albumDescriptor : playlistDescriptor,
    onPlayLikedTracks,
    onQueueLikedTracks,
  );

  const handlePlaylistContextMenu = useCallback((playlist: PlaylistInfo, event: React.MouseEvent) => {
    openPlaylist(playlist, event);
  }, [openPlaylist]);

  const handleAlbumContextMenu = useCallback((album: AlbumInfo, event: React.MouseEvent) => {
    openAlbum(album, event);
  }, [openAlbum]);

  const buildPlaylistPopoverOptions = useCallback(() => {
    if (popover?.kind !== 'playlist') return [];
    const playlist = popover.playlist;
    const provider = playlist.provider ?? activeDescriptor?.id;
    const descriptor = provider ? getDescriptor(provider) : activeDescriptor;

    const options = buildBaseCollectionOptions({
      collectionName: playlist.name,
      onPlay: () => onPlaylistSelect(playlist.id, playlist.name, playlist.provider),
      onQueue: onAddToQueue ? () => onAddToQueue(playlist.id, playlist.name, playlist.provider) : undefined,
    });

    options.push(...buildLikedOptions({
      collectionId: playlist.id,
      collectionName: playlist.name,
      collectionProvider: playlist.provider,
      descriptor,
      likedLoading,
      onPlayLiked: onPlayLikedTracks ? handlePlayLiked : undefined,
      onQueueLiked: onQueueLikedTracks ? handleQueueLiked : undefined,
    }));

    const canDelete = descriptor?.capabilities.hasDeleteCollection &&
      descriptor.catalog.deleteCollection &&
      playlist.id !== LIKED_SONGS_ID &&
      !isAlbumId(playlist.id);

    options.push(...buildDeletePlaylistOption({
      playlistId: playlist.id,
      playlistName: playlist.name,
      provider,
      canDelete: !!canDelete,
      onDelete: openDelete,
    }));

    return options;
  }, [popover, onPlaylistSelect, onAddToQueue, onPlayLikedTracks, onQueueLikedTracks, activeDescriptor, getDescriptor, likedLoading, handlePlayLiked, handleQueueLiked, openDelete]);

  const buildAlbumPopoverOptions = useCallback(() => {
    if (popover?.kind !== 'album') return [];
    const album = popover.album;
    const descriptor = album.provider ? getDescriptor(album.provider) : activeDescriptor;
    const albumCollectionId = toAlbumPlaylistId(album.id);

    const options = buildBaseCollectionOptions({
      collectionName: album.name,
      onPlay: () => onPlaylistSelect(albumCollectionId, album.name, album.provider),
      onQueue: onAddToQueue ? () => onAddToQueue(albumCollectionId, album.name, album.provider) : undefined,
    });

    options.push(...buildLikedOptions({
      collectionId: albumCollectionId,
      collectionName: album.name,
      collectionProvider: album.provider,
      descriptor,
      likedLoading,
      onPlayLiked: onPlayLikedTracks ? handlePlayLiked : undefined,
      onQueueLiked: onQueueLikedTracks ? handleQueueLiked : undefined,
    }));

    options.push(...buildSaveAlbumOption({
      albumId: album.id,
      albumName: album.name,
      albumArtists: album.artists,
      albumImages: album.images ?? [],
      albumReleaseDate: album.release_date,
      albumTotalTracks: album.total_tracks,
      albumUri: album.uri,
      albumProvider: album.provider,
      albumSaved,
      descriptor,
      onToggleSave: buildToggleSaveHandler(album, descriptor) ?? (() => undefined),
    }));

    options.push(...buildExternalLinkOptions({
      albumName: album.name,
      albumArtists: album.artists,
      descriptor,
    }));

    return options;
  }, [popover, albumSaved, getDescriptor, activeDescriptor, onPlaylistSelect, onAddToQueue, onPlayLikedTracks, onQueueLikedTracks, likedLoading, handlePlayLiked, handleQueueLiked, buildToggleSaveHandler]);

  const albumPopoverPortal = popover?.kind === 'album' ? createPortal(
    React.createElement(TrackInfoPopover, {
      type: 'album',
      anchorRect: popover.rect,
      onClose: closePopover,
      options: buildAlbumPopoverOptions(),
    }),
    document.body,
  ) : null;

  const playlistPopoverPortal = popover?.kind === 'playlist' ? createPortal(
    React.createElement(TrackInfoPopover, {
      type: 'playlist',
      anchorRect: popover.rect,
      onClose: closePopover,
      options: buildPlaylistPopoverOptions(),
    }),
    document.body,
  ) : null;

  const saveErrorToast = saveError ? React.createElement(Toast, {
    message: saveError,
    onDismiss: clearSaveError,
  }) : null;

  return {
    handlePlaylistContextMenu,
    handleAlbumContextMenu,
    albumPopoverPortal,
    playlistPopoverPortal,
    confirmDeletePortal,
    saveErrorToast,
  };
}
