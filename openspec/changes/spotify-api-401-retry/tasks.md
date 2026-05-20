## 1. Structured error type

- [x] 1.1 In `src/services/spotify/api.ts`, define and export `SpotifyApiError extends Error` carrying `status: number` and `statusText: string`. Keep the legacy message format (`Spotify API error: <status> <statusText>`).
- [x] 1.2 Update `executeApiRequest` to throw `SpotifyApiError` instead of generic `Error`.

## 2. Public reportUnauthorized on auth singleton

- [x] 2.1 In `src/services/spotify/auth.ts`, add a public `reportUnauthorized(): void` that performs `this.logout()` then dispatches `SESSION_EXPIRED_EVENT`.
- [x] 2.2 Update `performRefresh()` to call `this.reportUnauthorized()` instead of `this.logout() + this.notifySessionExpired()`.
- [x] 2.3 Remove the now-redundant private `notifySessionExpired()` if its only call site was `performRefresh()`.

## 3. Retry-after-refresh in spotifyApiRequest

- [x] 3.1 Refactor `spotifyApiRequest` so its non-dedup return path goes through a single wrapper that catches `SpotifyApiError` with `status === 401`, forces a refresh via `spotifyAuth.refreshAccessToken()`, re-issues the request with the fresh token, and on a second 401 throws `AuthExpiredError('spotify')` after calling `spotifyAuth.reportUnauthorized()`.
- [x] 3.2 Ensure the dedup map still keys correctly across the retry — the retry should not create a duplicate entry.
- [x] 3.3 Verify the 429 backoff and `inflightRequests` cleanup still work after the refactor.

## 4. apiPlayTrack and friends throw SpotifyApiError

- [x] 4.1 In `src/services/spotifyPlayerPlayback.ts`, change `apiPlayTrack`, `apiPlayContext`, and `apiPlayPlaylist` to throw `SpotifyApiError` (preserving the rich `parsePlayError` message).
- [x] 4.2 Do **not** add retry-after-refresh inside `apiPlayTrack`; only the error type changes. The existing `playWithRetry` state machine continues to handle 403 / 429 retries.

## 5. Update spotifyPlaybackAdapter parse sites

- [x] 5.1 In `src/providers/spotify/spotifyPlaybackAdapter.ts` (`playWithRetry`, around line 118), replace the `message.includes('401') || message.toLowerCase().includes('unauthorized')` branch with `error instanceof AuthExpiredError ? rethrow : error instanceof SpotifyApiError && error.status === 401 ? throw new AuthExpiredError('spotify') : ...`.
- [x] 5.2 In `probePlayable` (around line 266), replace `message.includes('401') ? throw new AuthExpiredError(...)` with `err instanceof SpotifyApiError && err.status === 401 ? throw new AuthExpiredError('spotify') : ...`. Keep the `404 → false` branch but route it through `err.status === 404` instead of `message.includes('404')`.

## 6. Tests

- [x] 6.1 Add `src/services/spotify/__tests__/api.test.ts` (or extend an existing one) covering:
  - `executeApiRequest` throws `SpotifyApiError` with `status === 500` on a transient 5xx (the user is not logged out).
  - `spotifyApiRequest` retries once on 401: first 401 triggers `spotifyAuth.refreshAccessToken()`, second call succeeds, no `AuthExpiredError` thrown.
  - `spotifyApiRequest` throws `AuthExpiredError('spotify')` on a second 401 after refresh and calls `spotifyAuth.reportUnauthorized()`.
- [x] 6.2 Confirm the existing `spotifyPlaybackAdapterPrepareTrack.test.ts` 401 case (`probePlayable`) still passes under the new error contract.
- [x] 6.3 Run `npm run test:run` and confirm zero new failures.

## 7. Verify

- [x] 7.1 `npx tsc -b --noEmit` clean.
- [x] 7.2 `npm run test:run` green.
- [x] 7.3 `npm run build` green.
