import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFilterState } from '../useFilterState';

describe('useFilterState', () => {
  beforeEach(() => {
    window.localStorage.getItem = vi.fn().mockReturnValue(null);
    window.localStorage.setItem = vi.fn();
  });

  it('initializes with default filter state', () => {
    // #given
    // No localStorage value set

    // #when
    const { result } = renderHook(() => useFilterState());

    // #then
    expect(result.current.filterState.collectionType).toBe('playlists');
    expect(result.current.filterState.selectedProviderIds).toEqual([]);
    expect(result.current.filterState.searchQuery).toBe('');
  });

  it('loads filter state from localStorage on init', () => {
    // #given
    const storedState = JSON.stringify({
      searchQuery: 'test',
      collectionType: 'albums',
      selectedProviderIds: ['spotify'],
    });
    window.localStorage.getItem = vi.fn((key: string) => {
      if (key === 'vorbis-player-filter-state') return storedState;
      return null;
    });

    // #when
    const { result } = renderHook(() => useFilterState());

    // #then
    expect(result.current.filterState.collectionType).toBe('albums');
    expect(result.current.filterState.selectedProviderIds).toEqual(['spotify']);
    expect(result.current.filterState.searchQuery).toBe('test');
  });

  it('updates collection type', () => {
    // #given
    const { result } = renderHook(() => useFilterState());

    // #when
    act(() => {
      result.current.updateCollectionType('albums');
    });

    // #then
    expect(result.current.filterState.collectionType).toBe('albums');
  });

  it('persists collection type change to localStorage', () => {
    // #given
    const { result } = renderHook(() => useFilterState());

    // #when
    act(() => {
      result.current.updateCollectionType('albums');
    });

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalled();
  });

  it('updates provider filters', () => {
    // #given
    const { result } = renderHook(() => useFilterState());

    // #when
    act(() => {
      result.current.updateProviderFilters(['spotify', 'dropbox']);
    });

    // #then
    expect(result.current.filterState.selectedProviderIds).toEqual(['spotify', 'dropbox']);
  });

  it('persists provider filter change to localStorage', () => {
    // #given
    const { result } = renderHook(() => useFilterState());

    // #when
    act(() => {
      result.current.updateProviderFilters(['spotify']);
    });

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalled();
  });

  it('resets filters to default state', () => {
    // #given
    const { result } = renderHook(() => useFilterState());
    act(() => {
      result.current.updateCollectionType('albums');
      result.current.updateProviderFilters(['spotify']);
    });

    // #when
    act(() => {
      result.current.resetFilters();
    });

    // #then
    expect(result.current.filterState.collectionType).toBe('playlists');
    expect(result.current.filterState.selectedProviderIds).toEqual([]);
  });

  it('persists filter reset to localStorage', () => {
    // #given
    const { result } = renderHook(() => useFilterState());

    // #when
    act(() => {
      result.current.resetFilters();
    });

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalled();
  });

  it('preserves other fields when updating collection type', () => {
    // #given
    const { result } = renderHook(() => useFilterState());
    act(() => {
      result.current.updateProviderFilters(['spotify']);
    });

    // #when
    act(() => {
      result.current.updateCollectionType('albums');
    });

    // #then
    expect(result.current.filterState.selectedProviderIds).toEqual(['spotify']);
    expect(result.current.filterState.collectionType).toBe('albums');
  });

  it('preserves other fields when updating provider filters', () => {
    // #given
    const { result } = renderHook(() => useFilterState());
    act(() => {
      result.current.updateCollectionType('albums');
    });

    // #when
    act(() => {
      result.current.updateProviderFilters(['spotify']);
    });

    // #then
    expect(result.current.filterState.collectionType).toBe('albums');
    expect(result.current.filterState.selectedProviderIds).toEqual(['spotify']);
  });

  it('updates search query', () => {
    // #given
    const { result } = renderHook(() => useFilterState());

    // #when
    act(() => {
      result.current.updateSearchQuery('test search');
    });

    // #then
    expect(result.current.filterState.searchQuery).toBe('test search');
  });

  it('persists search query change to localStorage', () => {
    // #given
    const { result } = renderHook(() => useFilterState());

    // #when
    act(() => {
      result.current.updateSearchQuery('test');
    });

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalled();
  });

  it('clears search query when reset', () => {
    // #given
    const { result } = renderHook(() => useFilterState());
    act(() => {
      result.current.updateSearchQuery('test');
    });

    // #when
    act(() => {
      result.current.resetFilters();
    });

    // #then
    expect(result.current.filterState.searchQuery).toBe('');
  });
});
