import { useMemo } from 'react';
import { useLibrarySync } from '@/hooks/useLibrarySync';
import { usePinnedItems } from '@/hooks/usePinnedItems';
import type { MediaCollection } from '@/types/domain';
import type { SectionState, UseCollectionSectionParams } from '../types';

export function usePlaylistsSection(
  { providerFilter, excludePinned = true }: UseCollectionSectionParams = {},
): SectionState<MediaCollection> {
  const { playlists, isInitialLoadComplete } = useLibrarySync();
  const { pinnedPlaylistIds } = usePinnedItems();

  const items = useMemo(() => {
    let result = playlists;
    if (providerFilter && providerFilter.length > 0) {
      const allowed = new Set(providerFilter);
      result = result.filter((p) => allowed.has(p.provider));
    }
    if (excludePinned) {
      const pinnedSet = new Set(pinnedPlaylistIds);
      result = result.filter((p) => !pinnedSet.has(p.id));
    }
    return result;
  }, [playlists, providerFilter, excludePinned, pinnedPlaylistIds]);

  return {
    items,
    isLoading: !isInitialLoadComplete,
    isEmpty: items.length === 0,
  };
}
