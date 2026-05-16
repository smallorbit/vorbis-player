## 1. useAlbumSavedStatus — negative-path tests

- [x] 1.1 Add test asserting `isAlbumSaved` is not called when `hasSaveAlbum: false` (adapter method present but capability flag false).
- [x] 1.2 Add test asserting `setAlbumSaved` is not called when `hasSaveAlbum: false` and a toggle is attempted via `toggleSaved()`.

## 2. useRadioSession — negative-path test

- [x] 2.1 Add test asserting the radio-recommendation adapter method is not called when `hasRadio: false`.

## 3. useCollectionLoader — negative-path test

- [x] 3.1 Add test asserting the liked-collection adapter method is not called when `hasLikedCollection: false`.

## 4. Verify

- [x] 4.1 Run `npx vitest run` on the three affected test files and confirm all tests pass.
- [x] 4.2 Run `npx tsc -b --noEmit` and confirm no type errors.
