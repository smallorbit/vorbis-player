/**
 * Debounced consumer hook for the IndexedDB-cached library search.
 *
 * Wraps `searchLibraryCache` with a ~150 ms debounce to keep IndexedDB reads
 * off the hot path while the user types. Strictly cache-only — never makes
 * network calls.
 */

import { useEffect, useRef, useState } from 'react';
import {
  searchLibraryCache,
  emptySearchResult,
  type LibrarySearchResult,
} from '@/services/cache/librarySearch';

const DEFAULT_DEBOUNCE_MS = 150;

export interface UseLibrarySearchOptions {
  /** Debounce window in ms before the cache is queried. Defaults to 150. */
  debounceMs?: number;
  /** Maximum results per category. Defaults to 10. */
  limitPerCategory?: number;
}

export interface UseLibrarySearchReturn {
  results: LibrarySearchResult;
  isLoading: boolean;
}

/**
 * `useLibrarySearch(query)` — runs `searchLibraryCache` debounced.
 *
 * - An empty/whitespace query immediately resets to an empty result.
 * - `isLoading` is true while the debounce timer is pending or the IndexedDB
 *   read is in flight.
 * - Stale responses (from queries the user has since changed) are discarded.
 */
export function useLibrarySearch(
  query: string,
  options: UseLibrarySearchOptions = {},
): UseLibrarySearchReturn {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, limitPerCategory } = options;

  const [results, setResults] = useState<LibrarySearchResult>(() => emptySearchResult());
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (query.trim().length === 0) {
      requestIdRef.current += 1;
      setResults(emptySearchResult());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const requestId = ++requestIdRef.current;

    const timer = setTimeout(() => {
      searchLibraryCache(query, { limitPerCategory })
        .then((next) => {
          if (requestIdRef.current !== requestId) return;
          setResults(next);
          setIsLoading(false);
        })
        .catch((err) => {
          if (requestIdRef.current !== requestId) return;
          console.warn('[useLibrarySearch] search failed:', err);
          setResults(emptySearchResult());
          setIsLoading(false);
        });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [query, debounceMs, limitPerCategory]);

  return { results, isLoading };
}
