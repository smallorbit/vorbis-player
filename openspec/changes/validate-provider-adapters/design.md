## Context

`ProviderRegistryImpl.register()` in `src/providers/registry.ts` currently accepts any object whose static type matches `ProviderDescriptor` and stores it in a `Map`. TypeScript prevents call-site misuse, but does not protect against descriptors assembled at runtime (test fixtures, future dynamic loaders) or against a refactor that accidentally drops a required adapter. The provider-system spec already calls for rejection in this case but the code does not enforce it.

## Goals / Non-Goals

**Goals:**
- Reject any descriptor missing `auth`, `catalog`, or `playback` at the moment of registration.
- Surface a clear, typed error so tests and future callers can distinguish this from generic registration failures.
- Cover the rejection paths with unit tests.

**Non-Goals:**
- Validating the *shape* of each adapter (e.g., that `auth.login` is a function). The three required adapters are object-typed; deeper validation belongs to its own change if ever needed.
- Validating optional capability declarations against adapter contents.
- Changing how providers register (they continue to call `providerRegistry.register(...)` at module load).

## Decisions

**Validation lives inside `register()` rather than at the type boundary.**
The descriptor type already requires the three adapters; the runtime check exists for cases TypeScript can't see (untyped fixtures, dynamic descriptors). Putting it in `register()` keeps it close to the invariant it protects. Alternative considered: a separate `validateDescriptor()` helper exported from the module — rejected because no other call site needs it today.

**A dedicated `InvalidProviderDescriptorError` class.**
The existing `errors.ts` defines `AuthExpiredError` and `UnavailableTrackError` as named subclasses of `Error`. Following that pattern keeps the file consistent and lets callers (and tests) match on `instanceof InvalidProviderDescriptorError`. Alternative considered: throwing a generic `TypeError` — rejected because it cannot be distinguished from unrelated bugs.

**Check `typeof adapter === 'object' && adapter !== null` rather than truthiness alone.**
Truthy checks pass for non-object values (numbers, strings) that would clearly be wrong. Object-or-null is the cheapest correct guard.

**Error message includes the provider id and the missing adapter name.**
Easier debugging when a descriptor goes wrong in CI or in a build.

## Risks / Trade-offs

- **Risk**: A consumer relies on `register()` being silent on bad input → Mitigation: spec already required rejection; existing providers register full descriptors, so no current consumer breaks. Verified by running the existing test suite as part of the change.
- **Trade-off**: Validation runs once per provider at module load — negligible cost.
