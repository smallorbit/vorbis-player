import { useCallback } from 'react';
import type { CollectionRef } from '@/types/domain';
import { collectionRefToKey } from '@/types/domain';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const STORAGE_KEY = 'vorbis-player-recently-played';
const MAX_ENTRIES = 5;

export interface RecentlyPlayedEntry {
  ref: CollectionRef;
  name: string;
}

export interface UseRecentlyPlayedCollectionsResult {
  history: RecentlyPlayedEntry[];
  record: (ref: CollectionRef, name: string) => void;
}

export function useRecentlyPlayedCollections(): UseRecentlyPlayedCollectionsResult {
  const [history, setHistory] = useLocalStorage<RecentlyPlayedEntry[]>(STORAGE_KEY, []);

  const record = useCallback(
    (ref: CollectionRef, name: string) => {
      const key = collectionRefToKey(ref);
      setHistory((prev) => {
        const filtered = prev.filter((entry) => collectionRefToKey(entry.ref) !== key);
        return [{ ref, name }, ...filtered].slice(0, MAX_ENTRIES);
      });
    },
    [setHistory]
  );

  return { history, record };
}
