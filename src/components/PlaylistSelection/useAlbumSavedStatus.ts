import { useState, useEffect, useCallback } from 'react';
import type { AlbumInfo } from '../../services/spotify';
import type { ProviderDescriptor } from '@/types/providers';
import type { ProviderId } from '@/types/domain';
import { librarySyncEngine } from '@/services/cache/librarySyncEngine';
import { logLibrary } from '@/lib/debugLog';
import type { ItemPopoverState } from './useItemPopover';

export interface UseAlbumSavedStatusReturn {
  albumSaved: boolean | null;
  saveError: string | null;
  clearSaveError: () => void;
  buildToggleSaveHandler: (album: AlbumInfo, descriptor: ProviderDescriptor | null | undefined) => (() => void) | null;
}

export function useAlbumSavedStatus(
  popover: ItemPopoverState,
  activeDescriptor: ProviderDescriptor | null,
  getDescriptor: (id: ProviderId) => ProviderDescriptor | undefined,
): UseAlbumSavedStatusReturn {
  const [albumSaved, setAlbumSaved] = useState<boolean | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (popover?.kind !== 'album') {
      setAlbumSaved(null);
      return;
    }
    const descriptor = popover.album.provider
      ? getDescriptor(popover.album.provider)
      : activeDescriptor;
    if (!descriptor?.capabilities.hasSaveAlbum || !descriptor.catalog.isAlbumSaved) {
      setAlbumSaved(null);
      return;
    }
    let cancelled = false;
    descriptor.catalog.isAlbumSaved(popover.album.id).then((saved) => {
      if (!cancelled) setAlbumSaved(saved);
    }).catch((err) => {
      logLibrary('isAlbumSaved check failed', err);
      if (!cancelled) setAlbumSaved(null);
    });
    return () => { cancelled = true; };
  }, [popover, activeDescriptor, getDescriptor]);

  const buildToggleSaveHandler = useCallback((
    album: AlbumInfo,
    descriptor: ProviderDescriptor | null | undefined,
  ): (() => void) | null => {
    const catalog = descriptor?.catalog;
    if (!descriptor?.capabilities.hasSaveAlbum || !catalog?.setAlbumSaved || albumSaved === null) {
      return null;
    }
    const currentlySaved = albumSaved;
    return () => {
      setAlbumSaved(!currentlySaved);
      catalog.setAlbumSaved!(album.id, !currentlySaved).then(() => {
        if (currentlySaved) {
          librarySyncEngine.optimisticRemoveAlbum(album.id).catch((err) => {
            logLibrary('optimisticRemoveAlbum failed', err);
          });
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
          }).catch((err) => {
            logLibrary('optimisticAddAlbum failed', err);
          });
        }
      }).catch((err) => {
        logLibrary('setAlbumSaved failed', err);
        setAlbumSaved(currentlySaved);
        setSaveError(currentlySaved ? 'Failed to remove album from library.' : 'Failed to add album to library.');
      });
    };
  }, [albumSaved]);

  return {
    albumSaved,
    saveError,
    clearSaveError: useCallback(() => setSaveError(null), []),
    buildToggleSaveHandler,
  };
}
