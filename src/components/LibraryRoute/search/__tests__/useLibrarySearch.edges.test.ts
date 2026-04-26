/**
 * Edge-case tests for useLibrarySearch beyond builder-1's baseline coverage.
 *
 * Covers:
 *  - localStorage hydration of providerFilter / kindFilter / sort
 *  - toggleProvider duplicate add+remove yields []
 *  - hasActiveFilters truth corners (only sort, only one filter)
 *  - clearAll clears query AND every persisted filter
 *  - isSearching with pure whitespace and surrounding-whitespace queries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLibrarySearch } from '../useLibrarySearch';

const KEYS = {
  provider: 'vorbis-player-library-route-provider-filter',
  kind: 'vorbis-player-library-route-kind-filter',
  sort: 'vorbis-player-library-route-sort',
} as const;

function primeStorage(values: Partial<Record<keyof typeof KEYS, unknown>>) {
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => {
    if (key === KEYS.provider && values.provider !== undefined) {
      return JSON.stringify(values.provider);
    }
    if (key === KEYS.kind && values.kind !== undefined) {
      return JSON.stringify(values.kind);
    }
    if (key === KEYS.sort && values.sort !== undefined) {
      return JSON.stringify(values.sort);
    }
    return null;
  });
}

describe('useLibrarySearch edges', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReset();
    vi.mocked(window.localStorage.setItem).mockReset();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  describe('localStorage hydration', () => {
    it('hydrates providerFilter from localStorage on first render', () => {
      // #given
      primeStorage({ provider: ['dropbox'] });

      // #when
      const { result } = renderHook(() => useLibrarySearch());

      // #then
      expect(result.current.providerFilter).toEqual(['dropbox']);
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('hydrates kindFilter from localStorage on first render', () => {
      // #given
      primeStorage({ kind: ['album'] });

      // #when
      const { result } = renderHook(() => useLibrarySearch());

      // #then
      expect(result.current.kindFilter).toEqual(['album']);
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('hydrates sort from localStorage on first render', () => {
      // #given
      primeStorage({ sort: 'name-desc' });

      // #when
      const { result } = renderHook(() => useLibrarySearch());

      // #then
      expect(result.current.sort).toBe('name-desc');
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('hydrates all three keys together', () => {
      // #given
      primeStorage({ provider: ['spotify', 'dropbox'], kind: ['playlist'], sort: 'name-asc' });

      // #when
      const { result } = renderHook(() => useLibrarySearch());

      // #then
      expect(result.current.providerFilter).toEqual(['spotify', 'dropbox']);
      expect(result.current.kindFilter).toEqual(['playlist']);
      expect(result.current.sort).toBe('name-asc');
    });
  });

  describe('toggleProvider duplicate semantics', () => {
    it('returns empty array when same provider toggled twice', () => {
      // #given
      const { result } = renderHook(() => useLibrarySearch());

      // #when
      act(() => {
        result.current.toggleProvider('spotify');
      });
      act(() => {
        result.current.toggleProvider('spotify');
      });

      // #then
      expect(result.current.providerFilter).toEqual([]);
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('toggleKind twice returns empty array', () => {
      // #given
      const { result } = renderHook(() => useLibrarySearch());

      // #when
      act(() => {
        result.current.toggleKind('playlist');
      });
      act(() => {
        result.current.toggleKind('playlist');
      });

      // #then
      expect(result.current.kindFilter).toEqual([]);
    });

    it('different providers can coexist after multiple toggles', () => {
      // #given
      const { result } = renderHook(() => useLibrarySearch());

      // #when
      act(() => {
        result.current.toggleProvider('spotify');
      });
      act(() => {
        result.current.toggleProvider('dropbox');
      });

      // #then
      expect(result.current.providerFilter).toEqual(['spotify', 'dropbox']);
    });
  });

  describe('hasActiveFilters truth corners', () => {
    it('is false at default state', () => {
      // #when
      const { result } = renderHook(() => useLibrarySearch());

      // #then
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('is true when ONLY sort changed (no filters)', () => {
      // #given
      const { result } = renderHook(() => useLibrarySearch());

      // #when
      act(() => {
        result.current.setSort('name-asc');
      });

      // #then
      expect(result.current.hasActiveFilters).toBe(true);
      expect(result.current.providerFilter).toEqual([]);
      expect(result.current.kindFilter).toEqual([]);
    });

    it('flips back to false when sort is set back to "recent"', () => {
      // #given
      const { result } = renderHook(() => useLibrarySearch());
      act(() => {
        result.current.setSort('name-desc');
      });
      expect(result.current.hasActiveFilters).toBe(true);

      // #when
      act(() => {
        result.current.setSort('recent');
      });

      // #then
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('clears query, providerFilter, kindFilter, and sort in one call', () => {
      // #given — every field dirty
      const { result } = renderHook(() => useLibrarySearch());
      act(() => {
        result.current.setQuery('rock');
        result.current.toggleProvider('spotify');
        result.current.toggleKind('playlist');
        result.current.setSort('name-desc');
      });
      expect(result.current.query).toBe('rock');
      expect(result.current.hasActiveFilters).toBe(true);

      // #when
      act(() => {
        result.current.clearAll();
      });

      // #then
      expect(result.current.query).toBe('');
      expect(result.current.providerFilter).toEqual([]);
      expect(result.current.kindFilter).toEqual([]);
      expect(result.current.sort).toBe('recent');
      expect(result.current.isSearching).toBe(false);
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe('isSearching whitespace handling', () => {
    it('returns false for tab/newline-only query', () => {
      // #given
      const { result } = renderHook(() => useLibrarySearch());

      // #when
      act(() => {
        result.current.setQuery('\t\n  ');
      });

      // #then
      expect(result.current.isSearching).toBe(false);
    });

    it('returns true for query with surrounding whitespace', () => {
      // #given
      const { result } = renderHook(() => useLibrarySearch());

      // #when
      act(() => {
        result.current.setQuery('  hi  ');
      });

      // #then — query stays as typed, but isSearching trims for the check
      expect(result.current.query).toBe('  hi  ');
      expect(result.current.isSearching).toBe(true);
    });

    it('returns true for single non-whitespace character', () => {
      // #given
      const { result } = renderHook(() => useLibrarySearch());

      // #when
      act(() => {
        result.current.setQuery('a');
      });

      // #then
      expect(result.current.isSearching).toBe(true);
    });
  });
});
