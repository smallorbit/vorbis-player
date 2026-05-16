## Context

`keyToCollectionRef` parses a `"providerId:kind:id"` string and returns a
`CollectionRef` or `null`. The function already returns `null` for any provider id
not present in the registry. The test suite exercised this via the existing
`'returns null for unknown provider'` test (`'apple:playlist:abc'`), but that
single case did not make the unregistered-provider-id rejection a first-class,
named contract.

## Goals / Non-Goals

**Goals:**
- Add one dedicated test case that names the invariant explicitly and uses a
  provider id (`fakeprov`) that could never be registered in any environment.

**Non-Goals:**
- Changing production code — none is required.
- Adding edge-case coverage (empty id, whitespace) — optional follow-up.

## Decisions

**One test, co-located with existing domain tests.**
`src/types/__tests__/domain.test.ts` already contains the `keyToCollectionRef`
describe block. Adding the new case there keeps related tests together with no
new files or dependencies.

## Risks / Trade-offs

None. Pure test addition with no runtime impact.
