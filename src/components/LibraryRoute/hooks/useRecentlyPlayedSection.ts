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

  const playlistImageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of playlists) {
      if (p.imageUrl) map.set(`${p.id}:${p.provider}`, p.imageUrl);
    }
    return map;
  }, [playlists]);

  const albumImageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of albums) {
      if (a.imageUrl) map.set(`${a.id}:${a.provider}`, a.imageUrl);
    }
    return map;
  }, [albums]);

  const items = useMemo<RecentlyPlayedEntry[]>(() => {
    return history.map((entry) => {
      if (entry.imageUrl) return entry;
      const { ref } = entry;
      if (ref.kind === 'playlist') {
        const imageUrl = playlistImageMap.get(`${ref.id}:${ref.provider}`);
        return imageUrl ? { ...entry, imageUrl } : entry;
      }
      if (ref.kind === 'album') {
        const imageUrl = albumImageMap.get(`${ref.id}:${ref.provider}`);
        return imageUrl ? { ...entry, imageUrl } : entry;
      }
      return entry;
    });
  }, [history, playlistImageMap, albumImageMap]);

  return { items, isLoading: false, isEmpty: items.length === 0 };
}
