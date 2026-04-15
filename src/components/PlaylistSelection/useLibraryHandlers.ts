import * as React from 'react';
import { LIKED_SONGS_ID, LIKED_SONGS_NAME, toAlbumPlaylistId } from '../../constants/playlist';
import { logQueue } from '@/lib/debugLog';
import type { ProviderDescriptor } from '@/types/providers';
import type { ProviderId } from '@/types/domain';
import type { PlaylistInfo, AlbumInfo } from '../../services/spotify';

interface LikedSongsEntry {
  provider: ProviderId;
  count: number;
}

interface UseLibraryHandlersParams {
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  isUnifiedLikedActive: boolean;
  likedSongsPerProvider: LikedSongsEntry[];
  activeDescriptor: ProviderDescriptor | null | undefined;
  togglePinPlaylist: (id: string) => void;
  togglePinAlbum: (id: string) => void;
  setArtistFilter: (artistName: string) => void;
}

export interface LibraryHandlers {
  handlePlaylistClick: (playlist: PlaylistInfo) => void;
  handleAlbumClick: (album: AlbumInfo) => void;
  handleLikedSongsClick: (provider?: ProviderId) => void;
  handlePinPlaylistClick: (id: string, event: React.MouseEvent) => void;
  handlePinAlbumClick: (id: string, event: React.MouseEvent) => void;
  handleArtistClick: (artistName: string, event: React.MouseEvent) => void;
}

export function useLibraryHandlers({
  onPlaylistSelect,
  isUnifiedLikedActive,
  likedSongsPerProvider,
  activeDescriptor,
  togglePinPlaylist,
  togglePinAlbum,
  setArtistFilter,
}: UseLibraryHandlersParams): LibraryHandlers {
  function handlePlaylistClick(playlist: PlaylistInfo): void {
    logQueue('selected playlist: %s (%s)', playlist.name, playlist.id);
    onPlaylistSelect(playlist.id, playlist.name, playlist.provider);
  }

  function handleAlbumClick(album: AlbumInfo): void {
    logQueue('selected album: %s (%s)', album.name, album.id);
    onPlaylistSelect(toAlbumPlaylistId(album.id), album.name, album.provider);
  }

  function handleLikedSongsClick(provider?: ProviderId): void {
    if (provider !== undefined) {
      logQueue('liked songs click: explicit provider %s', provider);
      onPlaylistSelect(LIKED_SONGS_ID, LIKED_SONGS_NAME, provider);
      return;
    }

    if (isUnifiedLikedActive) {
      logQueue('liked songs click: unified path');
      onPlaylistSelect(LIKED_SONGS_ID, LIKED_SONGS_NAME, undefined);
      return;
    }

    if (likedSongsPerProvider.length === 1) {
      logQueue('liked songs click: single provider %s', likedSongsPerProvider[0].provider);
      onPlaylistSelect(LIKED_SONGS_ID, LIKED_SONGS_NAME, likedSongsPerProvider[0].provider);
      return;
    }

    logQueue(
      'liked songs click: ambiguous — %d providers, unified inactive; falling back to active provider',
      likedSongsPerProvider.length,
    );
    onPlaylistSelect(LIKED_SONGS_ID, LIKED_SONGS_NAME, activeDescriptor?.id);
  }

  function handlePinPlaylistClick(id: string, event: React.MouseEvent): void {
    event.stopPropagation();
    togglePinPlaylist(id);
  }

  function handlePinAlbumClick(id: string, event: React.MouseEvent): void {
    event.stopPropagation();
    togglePinAlbum(id);
  }

  function handleArtistClick(artistName: string, event: React.MouseEvent): void {
    event.stopPropagation();
    setArtistFilter(artistName);
  }

  return {
    handlePlaylistClick,
    handleAlbumClick,
    handleLikedSongsClick,
    handlePinPlaylistClick,
    handlePinAlbumClick,
    handleArtistClick,
  };
}
