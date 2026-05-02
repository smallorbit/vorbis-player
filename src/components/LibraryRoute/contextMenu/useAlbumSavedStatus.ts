import { useCallback, useEffect, useState } from 'react';
import { useProviderContext } from '@/contexts/ProviderContext';
import type { ProviderId } from '@/types/domain';
import { logLibrary } from '@/lib/debugLog';
import { librarySyncEngine } from '@/services/cache/librarySyncEngine';

export interface UseAlbumSavedStatusResult {
  isSaved: boolean | null;
  toggleSaved: () => void;
  canToggle: boolean;
  saveError: string | null;
  clearSaveError: () => void;
}

export function useAlbumSavedStatus(
  albumId: string | null,
  provider: ProviderId | undefined,
): UseAlbumSavedStatusResult {
  const { activeDescriptor, getDescriptor } = useProviderContext();
  const [isSaved, setIsSaved] = useState<boolean | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const descriptor = provider ? getDescriptor(provider) : activeDescriptor;
  const canToggle = !!(
    albumId &&
    descriptor?.capabilities.hasSaveAlbum &&
    descriptor.catalog.setAlbumSaved
  );

  useEffect(() => {
    if (!albumId || !descriptor?.capabilities.hasSaveAlbum || !descriptor.catalog.isAlbumSaved) {
      setIsSaved(null);
      return;
    }
    let cancelled = false;
    descriptor.catalog
      .isAlbumSaved(albumId)
      .then((saved) => {
        if (!cancelled) setIsSaved(saved);
      })
      .catch((err) => {
        logLibrary('isAlbumSaved failed', err);
        if (!cancelled) setIsSaved(null);
      });
    return () => {
      cancelled = true;
    };
  }, [albumId, descriptor]);

  const toggleSaved = useCallback(() => {
    if (!canToggle || !albumId || isSaved === null) return;
    const next = !isSaved;
    setIsSaved(next);
    setSaveError(null);

    async function run() {
      try {
        await descriptor!.catalog.setAlbumSaved!(albumId!, next);
      } catch (err) {
        logLibrary('setAlbumSaved failed', err);
        setIsSaved(!next);
        setSaveError(next ? 'Failed to add album.' : 'Failed to remove album.');
        return;
      }

      // Optimistically refresh the library view so an unliked album disappears
      // from LibraryRoute within a frame instead of waiting for the next poll.
      // Spotify is the only provider with a saved-album surface today; mirror
      // the pattern when Dropbox (or others) gain one.
      if (descriptor!.id === 'spotify' && !next) {
        try {
          await librarySyncEngine.optimisticRemoveAlbum(albumId!);
        } catch (err) {
          logLibrary('optimisticRemoveAlbum failed', err);
        }
      }
    }

    run().catch((err) => logLibrary('toggleSaved unexpected error', err));
  }, [canToggle, albumId, isSaved, descriptor]);

  const clearSaveError = useCallback(() => setSaveError(null), []);

  return { isSaved, toggleSaved, canToggle, saveError, clearSaveError };
}
