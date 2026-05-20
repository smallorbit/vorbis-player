## Context

`src/providers/dropbox/dropboxProvider.ts` wraps the three Dropbox adapters in an `if (DROPBOX_CLIENT_ID)` guard and only calls `providerRegistry.register()` inside that block. This conditional is the production implementation of the "Conditional Provider Availability" requirement in `openspec/specs/provider-system/spec.md`. No test currently exercises the guard.

The mock-provider isolation pattern in `src/providers/mock/__tests__/shouldUseMockProvider.test.ts` is the established template: `vi.stubEnv()` sets the env var, `vi.resetModules()` clears the module cache, and a dynamic `import()` re-executes the module under the new env state.

## Goals / Non-Goals

**Goals:**
- Assert `providerRegistry.has('dropbox') === false` when `VITE_DROPBOX_CLIENT_ID` is empty.
- Assert `providerRegistry.has('dropbox') === true` when `VITE_DROPBOX_CLIENT_ID` is a non-empty string.
- Keep the two cases fully isolated (no leaked state between tests).

**Non-Goals:**
- Testing adapter behavior (auth, catalog, playback) — covered by `dropboxAdapters.test.ts`.
- Testing the registry implementation itself — covered by `registry.test.ts`.

## Decisions

**Dynamic import with `vi.resetModules()` per test case**: Module-level side-effects (the `if` block calling `register()`) run once at import time. Resetting the module registry before each dynamic import ensures each case gets a fresh module evaluation under the stubbed env. This mirrors the existing `shouldUseMockProvider.test.ts` pattern and is the idiomatic Vitest approach for env-gated module initialization.

**Import `providerRegistry` fresh each time**: The singleton is also re-imported dynamically after `resetModules()` so both the registry and the provider module share the same fresh instance (not two different singleton instances from different module evaluations).

**Mock heavy adapter dependencies**: `dropboxProvider.ts` imports adapters that touch `localStorage`, `fetch`, and DOM APIs. A blanket `vi.mock()` at the top of the test file prevents those imports from running real code while still allowing `dropboxProvider.ts` itself to execute its conditional registration logic.

## Risks / Trade-offs

[Risk] Adapter constructors or `initLikesSync`/`initPreferencesSync` calls may throw in the test environment → Mitigation: mock all adapter modules (`dropboxAuthAdapter`, `dropboxCatalogAdapter`, `dropboxPlaybackAdapter`, `dropboxLikesSync`, `dropboxPreferencesSync`, `dropboxPlaylistStorage`, `DropboxIcon`) before importing the provider.

[Risk] The singleton `providerRegistry` accumulates registrations across the test file if `resetModules` is not applied correctly → Mitigation: `vi.resetModules()` in `beforeEach` ensures a clean registry on each test.
