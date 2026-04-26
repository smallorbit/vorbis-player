# Testing Guide

Run with `npm run test:run`. Tests are colocated with source files in `__tests__/` subdirectories.

- Verify actual behavior, not mock implementations
- Every test should have meaningful assertions

## Test utilities (`src/test/`)

| File | Purpose |
|------|---------|
| `setup.ts` | Global test setup: mocks `localStorage`, `sessionStorage`, `window.location`, `history`, `fetch`, `crypto` (for PKCE), `btoa`/`atob`; imports `fake-indexeddb/auto` and `@testing-library/jest-dom`; clears all mocks in `afterEach` |
| `fixtures.ts` | Factory functions for domain objects: `makeTrack()`, `makeMediaTrack()`, `makePlaylistInfo()`, `makeAlbumInfo()`, `makeProviderDescriptor()` — all accept partial overrides |
| `testWrappers.tsx` | `TestWrapper` component that nests all app context providers (`ProviderProvider`, `PlayerSizingProvider`, `TrackProvider`, `ColorProvider`, `VisualEffectsProvider`, `PinnedItemsProvider`) for component/hook tests |
| `providerTestUtils.tsx` | `ProviderWrapper` — lighter wrapper with only `ProviderProvider`, for hooks that only need provider context |

## BDD comment convention

Tests use `// #given`, `// #when`, `// #then` comments to mark the Arrange-Act-Assert phases:

```ts
it('loads volume from localStorage on init', () => {
  // #given
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => {
    if (key === 'vorbis-player-volume') return '75';
    return null;
  });

  // #when
  const { result } = renderHook(() => useVolume(), { wrapper: ProviderWrapper });

  // #then
  expect(result.current.volume).toBe(75);
});
```

Use this pattern in all new tests. The `#given` section is optional when there is no setup beyond what `beforeEach` provides.
