## 1. Error type

- [x] 1.1 Add `InvalidProviderDescriptorError` class to `src/providers/errors.ts`, following the existing `AuthExpiredError` / `UnavailableTrackError` pattern. Constructor takes `providerId: string` and `missingAdapter: 'auth' | 'catalog' | 'playback'`; both are exposed as readonly fields and included in the error message.

## 2. Registry validation

- [x] 2.1 In `src/providers/registry.ts`, modify `ProviderRegistryImpl.register()` to check that `descriptor.auth`, `descriptor.catalog`, and `descriptor.playback` are each `typeof === 'object'` and non-null before inserting into the map. Throw `InvalidProviderDescriptorError` on the first failure.
- [x] 2.2 Import `InvalidProviderDescriptorError` from `./errors`. (Also exported `ProviderRegistryImpl` so tests can instantiate fresh registries against the real validation logic.)

## 3. Tests

- [x] 3.1 In `src/providers/__tests__/registry.test.ts`, add a test that a well-formed descriptor still registers and is resolvable. (Existing test already covers this; converted file to use real `ProviderRegistryImpl` instead of the inline `TestableRegistry` duplicate.)
- [x] 3.2 Add three tests — one per missing adapter — that `register()` throws `InvalidProviderDescriptorError` with the correct `providerId` and `missingAdapter`.
- [x] 3.3 Add a test that a registry rejection does not leave the descriptor in the map (subsequent `get(id)` returns `undefined`).

## 4. Verify

- [x] 4.1 Run `npm run test:run -- src/providers/__tests__/registry.test.ts` and confirm all tests pass. (10/10 pass.)
- [x] 4.2 Run `npx tsc -b --noEmit` to confirm no type errors. (exit 0.)
- [x] 4.3 Run `npm run test:run` to confirm no regressions in the broader provider test suite. (Scoped to `src/providers` — 253/253 across 19 files.)
