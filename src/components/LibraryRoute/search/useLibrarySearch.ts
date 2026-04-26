import { useCallback, useMemo, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { ProviderId } from '@/types/domain';

export type LibraryKindFilter = 'playlist' | 'album';
export type LibrarySort = 'recent' | 'name-asc' | 'name-desc';

const STORAGE_KEYS = {
  providerFilter: 'vorbis-player-library-route-provider-filter',
  kindFilter: 'vorbis-player-library-route-kind-filter',
  sort: 'vorbis-player-library-route-sort',
} as const;

const DEFAULT_KIND_FILTER: LibraryKindFilter[] = [];
const DEFAULT_PROVIDER_FILTER: ProviderId[] = [];
const DEFAULT_SORT: LibrarySort = 'recent';

export interface LibrarySearchState {
  query: string;
  setQuery: (q: string) => void;
  providerFilter: ProviderId[];
  setProviderFilter: (next: ProviderId[]) => void;
  toggleProvider: (id: ProviderId) => void;
  kindFilter: LibraryKindFilter[];
  setKindFilter: (next: LibraryKindFilter[]) => void;
  toggleKind: (kind: LibraryKindFilter) => void;
  sort: LibrarySort;
  setSort: (s: LibrarySort) => void;
  isSearching: boolean;
  hasActiveFilters: boolean;
  clearAll: () => void;
}

export function useLibrarySearch(): LibrarySearchState {
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useLocalStorage<ProviderId[]>(
    STORAGE_KEYS.providerFilter,
    DEFAULT_PROVIDER_FILTER,
  );
  const [kindFilter, setKindFilter] = useLocalStorage<LibraryKindFilter[]>(
    STORAGE_KEYS.kindFilter,
    DEFAULT_KIND_FILTER,
  );
  const [sort, setSort] = useLocalStorage<LibrarySort>(STORAGE_KEYS.sort, DEFAULT_SORT);

  const toggleProvider = useCallback(
    (id: ProviderId) => {
      setProviderFilter(
        providerFilter.includes(id)
          ? providerFilter.filter((p) => p !== id)
          : [...providerFilter, id],
      );
    },
    [providerFilter, setProviderFilter],
  );

  const toggleKind = useCallback(
    (kind: LibraryKindFilter) => {
      setKindFilter(
        kindFilter.includes(kind) ? kindFilter.filter((k) => k !== kind) : [...kindFilter, kind],
      );
    },
    [kindFilter, setKindFilter],
  );

  const isSearching = query.trim().length > 0;
  const hasActiveFilters = useMemo(
    () =>
      providerFilter.length > 0 || kindFilter.length > 0 || sort !== DEFAULT_SORT,
    [providerFilter, kindFilter, sort],
  );

  const clearAll = useCallback(() => {
    setQuery('');
    setProviderFilter(DEFAULT_PROVIDER_FILTER);
    setKindFilter(DEFAULT_KIND_FILTER);
    setSort(DEFAULT_SORT);
  }, [setProviderFilter, setKindFilter, setSort]);

  return {
    query,
    setQuery,
    providerFilter,
    setProviderFilter,
    toggleProvider,
    kindFilter,
    setKindFilter,
    toggleKind,
    sort,
    setSort,
    isSearching,
    hasActiveFilters,
    clearAll,
  };
}
