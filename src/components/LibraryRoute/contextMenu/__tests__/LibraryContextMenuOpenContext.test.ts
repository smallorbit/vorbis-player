/**
 * Unit tests for LibraryContextMenuOpenContext.
 *
 * Covers:
 *  - Default context value is null
 *  - useLibraryContextMenuOpen returns the value provided by the Provider
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import {
  LibraryContextMenuOpenContext,
  useLibraryContextMenuOpen,
} from '../LibraryContextMenuOpenContext';

describe('LibraryContextMenuOpenContext', () => {
  it('returns null when no Provider is present', () => {
    const { result } = renderHook(() => useLibraryContextMenuOpen());
    expect(result.current).toBeNull();
  });

  it('returns the provided value', () => {
    const value = 'playlist:spotify:abc';
    const { result } = renderHook(() => useLibraryContextMenuOpen(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(LibraryContextMenuOpenContext.Provider, { value }, children),
    });
    expect(result.current).toBe(value);
  });
});
