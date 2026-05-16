## Context

The provider-system spec already declares the negative-path invariant ("callers SHALL NOT invoke the corresponding optional adapter method when the capability is not declared"). No production code change is needed — the gap is test coverage only.

## Goals / Non-Goals

**Goals:**
- Add representative unit tests across hooks/components that gate on optional capabilities.
- Cover the negative path (adapter not invoked when capability flag is false) for 3 call sites: `useAlbumSavedStatus`, `useRadioSession`, `useCollectionLoader`.

**Non-Goals:**
- Changing production code.
- Exhaustive coverage of every optional capability across every call site — 3–5 representative tests per the issue scope.
- Creating a new spec requirement — the existing spec already states the invariant.

## Decisions

**No delta spec.** The existing `provider-system` spec already contains the requirement in full. Adding tests does not change the spec requirement — only demonstrates it. An empty delta spec would be noise.

**Test placement alongside existing test suites.** New tests are added to the existing `__tests__/` files adjacent to the hooks/components under test, consistent with the project's colocated-test convention.

## Risks / Trade-offs

- No production risk — test-only change.
- If the hooks/components are later refactored, the spy references in tests may need updating — acceptable, as that is normal test maintenance.
