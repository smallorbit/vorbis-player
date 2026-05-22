import { useMemo } from 'react';
import { useLibrarySync } from '@/hooks/useLibrarySync';
import { usePinnedItems } from '@/hooks/usePinnedItems';
import type { AlbumInfo } from '@/services/spotify';
import type { SectionState, UseCollectionSectionParams } from '../types';

export type UseAlbumsSectionParams = UseCollectionSectionParams;

export function useAlbumsSection(
  { providerFilter, excludePinned = true }: UseAlbumsSectionParams = {},
): SectionState<AlbumInfo> {
  const { albums, isInitialLoadComplete } = useLibrarySync();
  const { pinnedAlbumIds } = usePinnedItems();

  const items = useMemo(() => {
    let result = albums;
    if (providerFilter && providerFilter.length > 0) {
      const allowed = new Set(providerFilter);
      result = result.filter((a) => allowed.has(a.provider ?? 'spotify'));
    }
    if (excludePinned) {
      const pinnedSet = new Set(pinnedAlbumIds);
      result = result.filter((a) => !pinnedSet.has(a.id));
    }
    return result;
  }, [albums, providerFilter, excludePinned, pinnedAlbumIds]);

  return {
    items,
    isLoading: !isInitialLoadComplete,
    isEmpty: items.length === 0,
  };
}
