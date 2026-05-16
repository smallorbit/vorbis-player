## Why

The provider-system spec requires that callers SHALL NOT invoke an optional adapter method when the provider does not declare the corresponding capability, but this invariant was enforced only by convention — no automated test verified the negative path. A recent review surfaced that the "undeclared capability → adapter not invoked" path lacked coverage across the hooks and components that gate on capabilities.

## What Changes

- Add 5 representative unit tests across 3 files that assert adapter methods are NOT called when the relevant capability flag is false:
  - `useAlbumSavedStatus` — `isAlbumSaved` and `setAlbumSaved` are not called when `hasSaveAlbum: false`
  - `useRadioSession` — `getRecommendations` is not called when `hasRadio: false`
  - `useCollectionLoader` — `getLikedTracks` is not called when `hasLikedCollection: false`
- All tests follow the existing BDD `// #given / #when / #then` comment convention.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
<!-- No spec-level requirement is changing. The existing provider-system spec already declares:
     "WHEN a provider does not declare an optional capability THEN callers SHALL NOT invoke the corresponding optional adapter method."
     This change adds tests to verify that invariant — no delta spec needed. -->

## Impact

- `src/components/LibraryRoute/contextMenu/__tests__/useAlbumSavedStatus.test.ts` — new test suite
- `src/hooks/__tests__/useRadioSession.test.ts` — new test
- `src/hooks/__tests__/useCollectionLoader.test.ts` — new test
- No production code changes; no API changes; no new dependencies.
