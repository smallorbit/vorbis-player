import { useMemo } from 'react';
import { useLibrarySync } from '@/hooks/useLibrarySync';
import {
  useRecentlyPlayedCollections,
  type RecentlyPlayedEntry,
} from '@/hooks/useRecentlyPlayedCollections';
import type { SectionState } from '../types';

export function useRecentlyPlayedSection(): SectionState<RecentlyPlayedEntry> {
  const { history } = useRecentlyPlayedCollections();
  const { playlists, albums } = useLibrarySync();

  const items = useMemo<RecentlyPlayedEntry[]>(() => {
    return history.map((entry) => {
      if (entry.imageUrl) return entry;
      const { ref } = entry;
      if (ref.kind === 'playlist') {
        const match = playlists.find(
          (p) => p.id === ref.id && (p.provider ?? 'spotify') === ref.provider,
        );
        const imageUrl = match?.images?.[0]?.url;
        return imageUrl ? { ...entry, imageUrl } : entry;
      }
      if (ref.kind === 'album') {
        const match = albums.find(
          (a) => a.id === ref.id && (a.provider ?? 'spotify') === ref.provider,
        );
        const imageUrl = match?.images?.[0]?.url;
        return imageUrl ? { ...entry, imageUrl } : entry;
      }
      return entry;
    });
  }, [history, playlists, albums]);

  return { items, isLoading: false, isEmpty: items.length === 0 };
}
