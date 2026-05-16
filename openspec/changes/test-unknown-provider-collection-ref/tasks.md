## 1. Test

- [x] 1.1 In `src/types/__tests__/domain.test.ts`, add a dedicated test case `'returns null for a well-formed key with an unregistered provider id'` using key `'fakeprov:playlist:abc'` that asserts `keyToCollectionRef` returns `null`.

## 2. Verify

- [x] 2.1 Run `npm run test:run -- src/types` and confirm all 12 tests pass.
- [x] 2.2 Run `npx tsc -b --noEmit` and confirm no type errors.
