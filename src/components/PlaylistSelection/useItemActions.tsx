import { useState, useEffect, useCallback } from 'react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import type { AlbumInfo, PlaylistInfo } from '../../services/spotify';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import { LIKED_SONGS_ID, isAlbumId, isSavedPlaylistId, extractPlaylistPath, resolvePlaylistRef } from '@/constants/playlist';
import { librarySyncEngine } from '@/services/cache/librarySyncEngine';
import { toAlbumPlaylistId } from '@/constants/playlist';
import TrackInfoPopover, {
  SpotifyIcon,
  PlayIcon,
  DiscogsIcon,
  AddToLibraryIcon,
  RemoveFromLibraryIcon,
  AddToQueueIcon,
  HeartIcon,
  TrashIcon,
  ICON_MAP,
} from '../controls/TrackInfoPopover';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { LIBRARY_REFRESH_EVENT } from '@/hooks/useLibrarySync';

type AlbumPopoverState = {
  album: AlbumInfo;
  rect: DOMRect;
} | null;

type PlaylistPopoverState = {
  playlist: PlaylistInfo;
  rect: DOMRect;
} | null;

interface UseItemActionsProps {
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (playlistId: string, playlistName?: string, provider?: ProviderId) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: (tracks: MediaTrack[], collectionId: string, collectionName: string, provider?: ProviderId) => Promise<void>;
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
  activeDescriptor: ProviderDescriptor | null;
  getDescriptor: (id: ProviderId) => ProviderDescriptor | undefined;
  removeCollection: (id: string) => void;
}

async function fetchLikedTracksForCollection(
  collectionId: string,
  descriptor: ProviderDescriptor,
): Promise<MediaTrack[]> {
  const providerId = descriptor.id;
  const { id, kind } = resolvePlaylistRef(collectionId, providerId);
  const collectionRef = { provider: providerId, kind, id } as const;
  const allTracks = await descriptor.catalog.listTracks(collectionRef);

  if (!descriptor.catalog.isTrackSaved) return [];

  const savedResults = await Promise.all(
    allTracks.map((track) => descriptor.catalog.isTrackSaved!(track.id).catch(() => false))
  );

  return allTracks.filter((_, i) => savedResults[i]);
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
  const [albumPopover, setAlbumPopover] = useState<AlbumPopoverState>(null);
  const [playlistPopover, setPlaylistPopover] = useState<PlaylistPopoverState>(null);
  const [albumSaved, setAlbumSaved] = useState<boolean | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; provider?: ProviderId } | null>(null);
  const [likedLoading, setLikedLoading] = useState(false);

  useEffect(() => {
    if (!albumPopover) {
      setAlbumSaved(null);
      return;
    }
    const descriptor = albumPopover.album.provider
      ? getDescriptor(albumPopover.album.provider)
      : activeDescriptor;
    if (!descriptor?.capabilities.hasSaveAlbum || !descriptor.catalog.isAlbumSaved) {
      setAlbumSaved(null);
      return;
    }
    let cancelled = false;
    descriptor.catalog.isAlbumSaved(albumPopover.album.id).then((saved) => {
      if (!cancelled) setAlbumSaved(saved);
    }).catch(() => {
      if (!cancelled) setAlbumSaved(null);
    });
    return () => {
      cancelled = true;
    };
  }, [albumPopover, activeDescriptor, getDescriptor]);

  function handlePlaylistContextMenu(playlist: PlaylistInfo, event: React.MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    setPlaylistPopover({
      playlist,
      rect: new DOMRect(event.clientX, event.clientY, 0, 0),
    });
  }

  function handleAlbumContextMenu(album: AlbumInfo, event: React.MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    setAlbumPopover({
      album,
      rect: new DOMRect(event.clientX, event.clientY, 0, 0),
    });
  }

  const closePlaylistPopover = useCallback(() => {
    setPlaylistPopover(null);
  }, []);

  const buildPlaylistPopoverOptions = useCallback(() => {
    if (!playlistPopover) return [];
    const playlist = playlistPopover.playlist;
    const provider = playlist.provider ?? activeDescriptor?.id;
    const descriptor = provider ? getDescriptor(provider) : activeDescriptor;
    const canSaveTrack = descriptor?.capabilities.hasSaveTrack && !!descriptor.catalog.isTrackSaved;

    const options: Array<{ label: string; icon: React.ReactNode; onClick: () => void }> = [
      {
        label: `Play ${playlist.name}`,
        icon: React.createElement(PlayIcon),
        onClick: () => onPlaylistSelect(playlist.id, playlist.name, playlist.provider),
      },
    ];

    if (onAddToQueue) {
      options.push({
        label: 'Add to Queue',
        icon: React.createElement(AddToQueueIcon),
        onClick: () => onAddToQueue(playlist.id, playlist.name, playlist.provider),
      });
    }

    if (canSaveTrack && onPlayLikedTracks && descriptor) {
      options.push({
        label: likedLoading ? 'Loading…' : 'Play Liked',
        icon: React.createElement(HeartIcon),
        onClick: () => {
          if (likedLoading) return;
          setLikedLoading(true);
          fetchLikedTracksForCollection(playlist.id, descriptor)
            .then((likedTracks) => {
              if (likedTracks.length > 0) {
                return onPlayLikedTracks(likedTracks, playlist.id, playlist.name, playlist.provider);
              }
            })
            .catch((err) => { console.error('[PlayLiked] Failed:', err); })
            .finally(() => { setLikedLoading(false); });
        },
      });
    }

    if (canSaveTrack && onQueueLikedTracks && descriptor) {
      options.push({
        label: likedLoading ? 'Loading…' : 'Queue Liked',
        icon: React.createElement(HeartIcon),
        onClick: () => {
          if (likedLoading) return;
          setLikedLoading(true);
          fetchLikedTracksForCollection(playlist.id, descriptor)
            .then((likedTracks) => {
              if (likedTracks.length > 0) {
                onQueueLikedTracks(likedTracks, playlist.name);
              }
            })
            .catch((err) => { console.error('[QueueLiked] Failed:', err); })
            .finally(() => { setLikedLoading(false); });
        },
      });
    }

    const canDelete = descriptor?.capabilities.hasDeleteCollection &&
      descriptor.catalog.deleteCollection &&
      playlist.id !== LIKED_SONGS_ID &&
      !isAlbumId(playlist.id);

    if (canDelete) {
      options.push({
        label: 'Delete Playlist',
        icon: React.createElement(TrashIcon),
        onClick: () => setDeleteTarget({ id: playlist.id, name: playlist.name, provider }),
      });
    }

    return options;
  }, [playlistPopover, onPlaylistSelect, onAddToQueue, onPlayLikedTracks, onQueueLikedTracks, activeDescriptor, getDescriptor, likedLoading]);

  const closeAlbumPopover = useCallback(() => {
    setAlbumPopover(null);
  }, []);

  const buildAlbumPopoverOptions = useCallback(() => {
    if (!albumPopover) return [];
    const album = albumPopover.album;
    const descriptor = album.provider ? getDescriptor(album.provider) : activeDescriptor;
    const capabilities = descriptor?.capabilities;
    const catalog = descriptor?.catalog;
    const ExternalIcon = descriptor?.getExternalUrl ? DiscogsIcon : SpotifyIcon;
    const canSaveTrack = capabilities?.hasSaveTrack && !!catalog?.isTrackSaved;

    const options: Array<{ label: string; icon: React.ReactNode; onClick: () => void }> = [
      {
        label: `Play ${album.name}`,
        icon: React.createElement(PlayIcon),
        onClick: () => onPlaylistSelect(toAlbumPlaylistId(album.id), album.name, album.provider),
      },
    ];

    if (onAddToQueue) {
      options.push({
        label: 'Add to Queue',
        icon: React.createElement(AddToQueueIcon),
        onClick: () => onAddToQueue(toAlbumPlaylistId(album.id), album.name, album.provider),
      });
    }

    if (canSaveTrack && onPlayLikedTracks && descriptor) {
      const albumCollectionId = toAlbumPlaylistId(album.id);
      options.push({
        label: likedLoading ? 'Loading…' : 'Play Liked',
        icon: React.createElement(HeartIcon),
        onClick: () => {
          if (likedLoading) return;
          setLikedLoading(true);
          fetchLikedTracksForCollection(albumCollectionId, descriptor)
            .then((likedTracks) => {
              if (likedTracks.length > 0) {
                return onPlayLikedTracks(likedTracks, albumCollectionId, album.name, album.provider);
              }
            })
            .catch((err) => { console.error('[PlayLiked] Failed:', err); })
            .finally(() => { setLikedLoading(false); });
        },
      });
    }

    if (canSaveTrack && onQueueLikedTracks && descriptor) {
      const albumCollectionId = toAlbumPlaylistId(album.id);
      options.push({
        label: likedLoading ? 'Loading…' : 'Queue Liked',
        icon: React.createElement(HeartIcon),
        onClick: () => {
          if (likedLoading) return;
          setLikedLoading(true);
          fetchLikedTracksForCollection(albumCollectionId, descriptor)
            .then((likedTracks) => {
              if (likedTracks.length > 0) {
                onQueueLikedTracks(likedTracks, album.name);
              }
            })
            .catch((err) => { console.error('[QueueLiked] Failed:', err); })
            .finally(() => { setLikedLoading(false); });
        },
      });
    }

    if (capabilities?.hasSaveAlbum && catalog?.setAlbumSaved && albumSaved !== null) {
      const saved = albumSaved;
      options.push({
        label: saved ? 'Remove from Library' : 'Add to Library',
        icon: saved ? React.createElement(RemoveFromLibraryIcon) : React.createElement(AddToLibraryIcon),
        onClick: () => {
          catalog.setAlbumSaved!(album.id, !saved).then(() => {
            if (saved) {
              librarySyncEngine.optimisticRemoveAlbum(album.id).catch(() => {});
            } else {
              librarySyncEngine.optimisticAddAlbum({
                id: album.id,
                name: album.name,
                artists: album.artists,
                images: album.images ?? [],
                release_date: album.release_date ?? '',
                total_tracks: album.total_tracks ?? 0,
                uri: album.uri ?? `spotify:album:${album.id}`,
                added_at: new Date().toISOString(),
                provider: album.provider,
              }).catch(() => {});
            }
          }).catch(() => {});
        },
      });
    }

    if (capabilities?.hasExternalLink ?? true) {
      const externalUrls = descriptor?.getExternalUrls?.({
        type: 'album',
        name: album.name,
        artistName: album.artists,
      });
      if (externalUrls) {
        for (const entry of externalUrls) {
          const IconComponent = ICON_MAP[entry.icon] ?? DiscogsIcon;
          options.push({
            label: `Search ${entry.label}`,
            icon: React.createElement(IconComponent),
            onClick: () => void window.open(entry.url, '_blank', 'noopener,noreferrer'),
          });
        }
      } else {
        const providerName = capabilities?.externalLinkLabel?.replace('Open in ', '') ?? descriptor?.name ?? 'External';
        const albumUrl = descriptor?.getExternalUrl
          ? descriptor.getExternalUrl({ type: 'album', name: album.name, artistName: album.artists })
          : undefined;
        if (albumUrl) {
          options.push({
            label: `View album on ${providerName}`,
            icon: React.createElement(ExternalIcon),
            onClick: () => void window.open(albumUrl, '_blank', 'noopener,noreferrer'),
          });
        }
      }
    }

    return options;
  }, [albumPopover, albumSaved, getDescriptor, activeDescriptor, onPlaylistSelect, onAddToQueue, onPlayLikedTracks, onQueueLikedTracks, likedLoading]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const provider = deleteTarget.provider ?? activeDescriptor?.id;
    const descriptor = provider ? getDescriptor(provider) : activeDescriptor;
    if (!descriptor?.catalog.deleteCollection) return;

    const collectionId = isSavedPlaylistId(deleteTarget.id)
      ? extractPlaylistPath(deleteTarget.id)
      : deleteTarget.id;

    await descriptor.catalog.deleteCollection(collectionId, 'playlist');
    removeCollection(deleteTarget.id);
    setDeleteTarget(null);
    window.dispatchEvent(new CustomEvent(LIBRARY_REFRESH_EVENT, { detail: { providerId: provider } }));
  }, [deleteTarget, activeDescriptor, getDescriptor, removeCollection]);

  const handleDeleteClose = useCallback(() => setDeleteTarget(null), []);

  const albumPopoverPortal = albumPopover ? createPortal(
    React.createElement(TrackInfoPopover, {
      type: 'album',
      anchorRect: albumPopover.rect,
      onClose: closeAlbumPopover,
      options: buildAlbumPopoverOptions(),
    }),
    document.body,
  ) : null;

  const playlistPopoverPortal = playlistPopover ? createPortal(
    React.createElement(TrackInfoPopover, {
      type: 'playlist',
      anchorRect: playlistPopover.rect,
      onClose: closePlaylistPopover,
      options: buildPlaylistPopoverOptions(),
    }),
    document.body,
  ) : null;

  const confirmDeletePortal = deleteTarget ? React.createElement(ConfirmDeleteDialog, {
    name: deleteTarget.name,
    onConfirm: handleDeleteConfirm,
    onClose: handleDeleteClose,
  }) : null;

  return {
    albumPopover,
    setAlbumPopover,
    playlistPopover,
    setPlaylistPopover,
    albumSaved,
    deleteTarget,
    setDeleteTarget,
    handlePlaylistContextMenu,
    handleAlbumContextMenu,
    closePlaylistPopover,
    buildPlaylistPopoverOptions,
    closeAlbumPopover,
    buildAlbumPopoverOptions,
    handleDeleteConfirm,
    handleDeleteClose,
    albumPopoverPortal,
    playlistPopoverPortal,
    confirmDeletePortal,
  };
}
