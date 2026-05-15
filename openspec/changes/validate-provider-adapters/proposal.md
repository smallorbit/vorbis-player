## Why

The provider-system spec requires that descriptors missing any of the three required adapters (`auth`, `catalog`, `playback`) be rejected at registration time. Today `ProviderRegistryImpl.register()` writes any descriptor it receives into its map without inspecting it, so a malformed provider would register silently and surface as a runtime crash later when a missing adapter is invoked. A recent conformance audit flagged this as the only critical gap in provider-system spec adherence.

## What Changes

- Add runtime validation inside `ProviderRegistryImpl.register()` that throws when `auth`, `catalog`, or `playback` is missing or non-object.
- Introduce an `InvalidProviderDescriptorError` class in `src/providers/errors.ts` so callers can distinguish this failure mode from generic errors.
- Add a unit test (in `src/providers/__tests__/registry.test.ts`) verifying that a descriptor missing each required adapter is rejected, and that a well-formed descriptor still registers.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `provider-system`: tightens the existing "Provider missing a required adapter" scenario from a behavioral assertion into a runtime-enforced invariant. No requirement is added or removed; the existing scenario gains an enforcement clause.

## Impact

- `src/providers/registry.ts` — adds validation logic to `register()`.
- `src/providers/errors.ts` — adds `InvalidProviderDescriptorError`.
- `src/providers/__tests__/registry.test.ts` — adds rejection-path tests.
- No public API change; existing provider modules (`spotify`, `dropbox`, `mock`) already supply complete descriptors and are unaffected.
- No runtime perf concern — validation runs once per provider at module load.
