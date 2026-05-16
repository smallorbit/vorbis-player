## Why

The provider-system spec documents a "Conditional Provider Availability" scenario — Dropbox registers only when `VITE_DROPBOX_CLIENT_ID` is set — but there is no test that asserts this contract in either direction, leaving a regression risk if the conditional guard in `dropboxProvider.ts` is accidentally removed.

## What Changes

- Add a Vitest test file that exercises `dropboxProvider.ts` module initialization under two env-var conditions: client ID absent (no registration) and client ID present (registration occurs).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
<!-- No spec-level behavior changes; the requirement already exists in provider-system spec. -->

## Impact

- `src/providers/__tests__/dropboxConditionalRegistration.test.ts` — new test file.
- No production code changes.
- No public API change.
