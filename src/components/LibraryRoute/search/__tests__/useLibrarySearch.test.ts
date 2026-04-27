import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLibrarySearch } from '../useLibrarySearch';

describe('useLibrarySearch', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  it('defaults to empty query and inactive search', () => {
    // #when
    const { result } = renderHook(() => useLibrarySearch());

    // #then
    expect(result.current.query).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.providerFilter).toEqual([]);
    expect(result.current.kindFilter).toEqual([]);
    expect(result.current.sort).toBe('recent');
  });

  it('marks isSearching true when query has non-whitespace', () => {
    // #given
    const { result } = renderHook(() => useLibrarySearch());

    // #when
    act(() => {
      result.current.setQuery('rock');
    });

    // #then
    expect(result.current.isSearching).toBe(true);
  });

  it('whitespace-only query is not searching', () => {
    // #given
    const { result } = renderHook(() => useLibrarySearch());

    // #when
    act(() => {
      result.current.setQuery('   ');
    });

    // #then
    expect(result.current.isSearching).toBe(false);
  });

  it('toggleProvider adds and removes provider', () => {
    // #given
    const { result } = renderHook(() => useLibrarySearch());

    // #when
    act(() => {
      result.current.toggleProvider('spotify');
    });
    expect(result.current.providerFilter).toEqual(['spotify']);

    act(() => {
      result.current.toggleProvider('spotify');
    });

    // #then
    expect(result.current.providerFilter).toEqual([]);
  });

  it('toggleKind adds and removes kind', () => {
    // #given
    const { result } = renderHook(() => useLibrarySearch());

    // #when
    act(() => {
      result.current.toggleKind('album');
    });

    // #then
    expect(result.current.kindFilter).toEqual(['album']);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('hasActiveFilters reflects sort change', () => {
    // #given
    const { result } = renderHook(() => useLibrarySearch());

    // #when
    act(() => {
      result.current.setSort('name-asc');
    });

    // #then
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('clearAll resets query, filters, and sort', () => {
    // #given
    const { result } = renderHook(() => useLibrarySearch());
    act(() => {
      result.current.setQuery('test');
      result.current.toggleProvider('spotify');
      result.current.toggleKind('album');
      result.current.setSort('name-asc');
    });

    // #when
    act(() => {
      result.current.clearAll();
    });

    // #then
    expect(result.current.query).toBe('');
    expect(result.current.providerFilter).toEqual([]);
    expect(result.current.kindFilter).toEqual([]);
    expect(result.current.sort).toBe('recent');
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('persists provider filter to localStorage', () => {
    // #given
    const { result } = renderHook(() => useLibrarySearch());

    // #when
    act(() => {
      result.current.toggleProvider('dropbox');
    });

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'vorbis-player-library-route-provider-filter',
      JSON.stringify(['dropbox']),
    );
  });

  it('does not persist query to localStorage', () => {
    // #given
    const { result } = renderHook(() => useLibrarySearch());

    // #when
    act(() => {
      result.current.setQuery('jazz');
    });

    // #then
    const setItemCalls = vi.mocked(window.localStorage.setItem).mock.calls;
    const queryWrite = setItemCalls.find(([key]) => String(key).includes('search'));
    expect(queryWrite).toBeUndefined();
  });
});
