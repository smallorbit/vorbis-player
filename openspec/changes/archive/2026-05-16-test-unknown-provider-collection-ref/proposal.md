## Why

`keyToCollectionRef` in `src/types/domain.ts` correctly rejects keys whose provider id is not registered, but the test suite only exercised the `'apple:playlist:abc'` case inside the generic `'returns null for unknown provider'` test. The rejection path for any arbitrary well-formed key with an unregistered provider id had no dedicated, explicitly-named test, leaving a gap in specification coverage.

## What Changes

- Add a standalone test case `'returns null for a well-formed key with an unregistered provider id'` in `src/types/__tests__/domain.test.ts` using `'fakeprov:playlist:abc'` to make the unregistered-provider-id rejection explicit.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
<!-- No requirement is being added or removed. The existing provider-system spec already
     asserts that unregistered providers yield null. This change only adds test coverage
     for a gap — no spec-level behavior changes. -->

## Impact

- `src/types/__tests__/domain.test.ts` — one new test case added; no production code changed.
- No API, runtime, or dependency impact.
