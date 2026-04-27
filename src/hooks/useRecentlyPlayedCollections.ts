import { useCallback } from 'react';
import type { CollectionRef } from '@/types/domain';
import { collectionRefToKey } from '@/types/domain';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const STORAGE_KEY = 'vorbis-player-recently-played';
const MAX_ENTRIES = 5;

export interface RecentlyPlayedEntry {
  ref: CollectionRef;
  name: string;
  imageUrl?: string | null;
}

export interface UseRecentlyPlayedCollectionsResult {
  history: RecentlyPlayedEntry[];
  record: (ref: CollectionRef, name: string, imageUrl?: string | null) => void;
  remove: (ref: CollectionRef) => void;
}

export function useRecentlyPlayedCollections(): UseRecentlyPlayedCollectionsResult {
  const [history, setHistory] = useLocalStorage<RecentlyPlayedEntry[]>(STORAGE_KEY, []);

  const record = useCallback(
    (ref: CollectionRef, name: string, imageUrl?: string | null) => {
      const key = collectionRefToKey(ref);
      setHistory((prev) => {
        const filtered = prev.filter((entry) => collectionRefToKey(entry.ref) !== key);
        const entry: RecentlyPlayedEntry = imageUrl ? { ref, name, imageUrl } : { ref, name };
        return [entry, ...filtered].slice(0, MAX_ENTRIES);
      });
    },
    [setHistory]
  );

  const remove = useCallback(
    (ref: CollectionRef) => {
      const key = collectionRefToKey(ref);
      setHistory((prev) => prev.filter((entry) => collectionRefToKey(entry.ref) !== key));
    },
    [setHistory],
  );

  return { history, record, remove };
}
