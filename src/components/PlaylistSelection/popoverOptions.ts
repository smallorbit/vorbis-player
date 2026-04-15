import * as React from 'react';
import type { ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import {
  PlayIcon,
  AddToQueueIcon,
  HeartIcon,
  ICON_MAP,
  DiscogsIcon,
  SpotifyIcon,
  RemoveFromLibraryIcon,
  AddToLibraryIcon,
  TrashIcon,
} from '../controls/TrackInfoPopover';

export type PopoverOption = { label: string; icon: React.ReactNode; onClick: () => void };

export function buildBaseCollectionOptions(params: {
  collectionName: string;
  onPlay: () => void;
  onQueue: (() => void) | undefined;
}): PopoverOption[] {
  const { collectionName, onPlay, onQueue } = params;
  const options: PopoverOption[] = [
    {
      label: `Play ${collectionName}`,
      icon: React.createElement(PlayIcon),
      onClick: onPlay,
    },
  ];

  if (onQueue) {
    options.push({
      label: 'Add to Queue',
      icon: React.createElement(AddToQueueIcon),
      onClick: onQueue,
    });
  }

  return options;
}

export function buildLikedOptions(params: {
  collectionId: string;
  collectionName: string;
  collectionProvider: ProviderId | undefined;
  descriptor: ProviderDescriptor | null | undefined;
  likedLoading: boolean;
  onPlayLiked: ((collectionId: string, collectionName: string, collectionProvider: ProviderId | undefined) => void) | undefined;
  onQueueLiked: ((collectionId: string, collectionName: string) => void) | undefined;
}): PopoverOption[] {
  const {
    collectionId,
    collectionName,
    collectionProvider,
    descriptor,
    likedLoading,
    onPlayLiked,
    onQueueLiked,
  } = params;

  const canSaveTrack = descriptor?.capabilities.hasSaveTrack && !!descriptor.catalog.isTrackSaved;
  const options: PopoverOption[] = [];

  if (canSaveTrack && onPlayLiked && descriptor) {
    options.push({
      label: likedLoading ? 'Loading…' : 'Play Liked',
      icon: React.createElement(HeartIcon),
      onClick: () => {
        if (!likedLoading) onPlayLiked(collectionId, collectionName, collectionProvider);
      },
    });
  }

  if (canSaveTrack && onQueueLiked && descriptor) {
    options.push({
      label: likedLoading ? 'Loading…' : 'Queue Liked',
      icon: React.createElement(HeartIcon),
      onClick: () => {
        if (!likedLoading) onQueueLiked(collectionId, collectionName);
      },
    });
  }

  return options;
}

export function buildSaveAlbumOption(params: {
  albumId: string;
  albumName: string;
  albumArtists: string;
  albumImages: { url: string }[];
  albumReleaseDate: string | undefined;
  albumTotalTracks: number | undefined;
  albumUri: string | undefined;
  albumProvider: ProviderId | undefined;
  albumSaved: boolean | null;
  descriptor: ProviderDescriptor | null | undefined;
  onToggleSave: (currentlySaved: boolean) => void;
}): PopoverOption[] {
  const {
    albumSaved,
    descriptor,
    onToggleSave,
  } = params;

  if (!descriptor?.capabilities.hasSaveAlbum || !descriptor.catalog.setAlbumSaved || albumSaved === null) {
    return [];
  }

  return [{
    label: albumSaved ? 'Remove from Library' : 'Add to Library',
    icon: albumSaved ? React.createElement(RemoveFromLibraryIcon) : React.createElement(AddToLibraryIcon),
    onClick: () => onToggleSave(albumSaved),
  }];
}

export function buildExternalLinkOptions(params: {
  albumName: string;
  albumArtists: string;
  descriptor: ProviderDescriptor | null | undefined;
}): PopoverOption[] {
  const { albumName, albumArtists, descriptor } = params;
  const capabilities = descriptor?.capabilities;
  const ExternalIcon = descriptor?.getExternalUrl ? DiscogsIcon : SpotifyIcon;

  if (!(capabilities?.hasExternalLink ?? true)) return [];

  const externalUrls = descriptor?.getExternalUrls?.({
    type: 'album',
    name: albumName,
    artistName: albumArtists,
  });

  if (externalUrls) {
    return externalUrls.map((entry) => {
      const IconComponent = ICON_MAP[entry.icon] ?? DiscogsIcon;
      return {
        label: `Search ${entry.label}`,
        icon: React.createElement(IconComponent),
        onClick: () => void window.open(entry.url, '_blank', 'noopener,noreferrer'),
      };
    });
  }

  const providerName = capabilities?.externalLinkLabel?.replace('Open in ', '') ?? descriptor?.name ?? 'External';
  const albumUrl = descriptor?.getExternalUrl
    ? descriptor.getExternalUrl({ type: 'album', name: albumName, artistName: albumArtists })
    : undefined;

  if (albumUrl) {
    return [{
      label: `View album on ${providerName}`,
      icon: React.createElement(ExternalIcon),
      onClick: () => void window.open(albumUrl, '_blank', 'noopener,noreferrer'),
    }];
  }

  return [];
}

export function buildDeletePlaylistOption(params: {
  playlistId: string;
  playlistName: string;
  provider: ProviderId | undefined;
  canDelete: boolean;
  onDelete: (id: string, name: string, provider: ProviderId | undefined) => void;
}): PopoverOption[] {
  const { playlistId, playlistName, provider, canDelete, onDelete } = params;
  if (!canDelete) return [];

  return [{
    label: 'Delete Playlist',
    icon: React.createElement(TrashIcon),
    onClick: () => onDelete(playlistId, playlistName, provider),
  }];
}
