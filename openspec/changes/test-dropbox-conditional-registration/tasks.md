## 1. Test implementation

- [x] 1.1 Create `src/providers/__tests__/dropboxConditionalRegistration.test.ts` with `vi.mock()` declarations for all adapter modules imported by `dropboxProvider.ts`, so adapter constructors do not run real code during module initialization.
- [x] 1.2 Add test case: with `VITE_DROPBOX_CLIENT_ID` stubbed to `''`, dynamically import `dropboxProvider.ts` and assert `providerRegistry.has('dropbox') === false`.
- [x] 1.3 Add test case: with `VITE_DROPBOX_CLIENT_ID` stubbed to `'test-client-id'`, dynamically import `dropboxProvider.ts` and assert `providerRegistry.has('dropbox') === true`.
- [x] 1.4 Ensure `vi.resetModules()` runs in `beforeEach` and `vi.unstubAllEnvs()` + `vi.restoreAllMocks()` run in `afterEach` to prevent state leakage between cases.

## 2. Verify

- [x] 2.1 Run `npm run test:run -- src/providers/__tests__/dropboxConditionalRegistration.test.ts` and confirm both cases pass.
- [x] 2.2 Run `npx tsc -b --noEmit` and confirm no type errors.
- [x] 2.3 Run `npm run test:run -- src/providers` and confirm no regressions across the full provider test suite.
