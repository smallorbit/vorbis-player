## Context

The Spotify Web API layer (`src/services/spotify/api.ts`) currently has the shape:

```ts
async function executeApiRequest<T>(url, token, options) {
  const response = await fetch(url, { ... });
  handleRateLimitResponse(response);
  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
  }
  // ...
}
```

The error is opaque — `status` is embedded in the message string. Two downstream sites in `spotifyPlaybackAdapter.ts` (lines 118 and 266) parse it back out with `message.includes('401')` to construct an `AuthExpiredError`. That's brittle and, more importantly, it skips the refresh-then-retry semantics that the Dropbox adapter implements (`dropboxApiClient.ts:74-82`):

```ts
let response = await makeRequest(token);
if (response.status === 401) {
  token = await this.auth.refreshAccessToken();
  if (!token) throw new AuthExpiredError('dropbox');
  response = await makeRequest(token);
  if (response.status === 401) {
    this.auth.reportUnauthorized();
    throw new AuthExpiredError('dropbox');
  }
}
```

`reportUnauthorized()` on the Dropbox auth adapter logs out and dispatches the shared `SESSION_EXPIRED_EVENT`. Spotify's `notifySessionExpired()` exists in `src/services/spotify/auth.ts:193-198` but is private and only fires from `performRefresh()` on a 400/401 refresh failure — never from a downstream 401 in user-data requests.

This change brings the Spotify API surface into parity with Dropbox on the auth-expiry contract while keeping the rest of `executeApiRequest`'s behavior (in-flight dedup, 429 backoff, single-flight refresh) untouched.

## Goals / Non-Goals

**Goals:**

- A structured `SpotifyApiError` carries the HTTP `status` (plus optional `statusText`) so downstream code can branch on `err.status` instead of `err.message.includes(...)`.
- A single retry-after-refresh on 401: first 401 forces `spotifyAuth.refreshAccessToken()` and re-issues the request; second 401 throws `AuthExpiredError('spotify')` and calls a new public `spotifyAuth.reportUnauthorized()` (logs out + dispatches `SESSION_EXPIRED_EVENT`).
- The two `.includes('401')` parse sites in `spotifyPlaybackAdapter.ts` use the structured error.
- Behavior unchanged for non-401 errors: 5xx / network / unknown statuses still propagate as `SpotifyApiError` (i.e. transient, no logout).
- `apiPlayTrack` / `apiPlayContext` / `apiPlayPlaylist` in `src/services/spotifyPlayerPlayback.ts` throw the same structured `SpotifyApiError` so the playback adapter sees the same type regardless of which code path produced the 401.

**Non-Goals:**

- Modifying Dropbox code. The Dropbox provider is the reference pattern, not the target.
- Restructuring 403 / 429 handling in `spotifyPlaybackAdapter.playWithRetry`. Those `message.includes('403')` / `'429'` branches will get the same structured-error treatment in a follow-up change. This change is narrowly scoped to 401.
- Adding a retry budget beyond `1`. Multiple refresh attempts during a single request would race with the auth singleton's `refreshInFlight` lock and would not improve recovery.
- Changing the public function signature of `spotifyApiRequest<T>(url, token, options)`. Callers still pass the token explicitly; the wrapper re-acquires the token from `spotifyAuth.ensureValidToken()` only on the retry path.
- Touching `useProviderPlayback.ts` / `useQueueManagement.ts` (other issues in this wave).

## Decisions

### Decision 1 — `SpotifyApiError extends Error` carries `status`

**Choice:** Define and export `SpotifyApiError` from `src/services/spotify/api.ts`:

```ts
export class SpotifyApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  constructor(status: number, statusText: string) {
    super(`Spotify API error: ${status} ${statusText}`);
    this.name = 'SpotifyApiError';
    this.status = status;
    this.statusText = statusText;
  }
}
```

The `message` keeps the legacy format so existing log output / Sentry breadcrumbs are unchanged.

**Why:**

- A named subclass lets call sites use `instanceof SpotifyApiError` and `err.status` instead of regex/substring matching.
- Keeping the legacy message text avoids invalidating any out-of-band log analysis or breadcrumb queries that match `Spotify API error:`.
- Co-locating the class with `executeApiRequest` mirrors the pattern Dropbox uses (`AuthExpiredError` lives in `src/providers/errors.ts`; `dropboxApiClient.ts` throws plain `Error` for non-401s because Dropbox has no equivalent need for downstream `status` branching yet).

**Alternatives considered:**

- *Add a `status` field to `Error` directly.* Rejected — TypeScript doesn't allow augmenting the base `Error` cleanly without `as any` or a `// @ts-expect-error`, both blocked by project rules.
- *Re-use `AuthExpiredError` for every non-OK response.* Rejected — conflates terminal auth failure with transient errors and would falsely log the user out on a 5xx.

### Decision 2 — Use existing `AuthExpiredError` for the terminal-401 signal

**Choice:** When the second 401 happens (after refresh), throw `AuthExpiredError('spotify')` from `@/providers/errors`. Do not introduce a `SpotifyAuthExpiredError` subclass.

**Why:**

- `AuthExpiredError` is already the cross-provider terminal-auth signal: `spotifyPlaybackAdapter.ts:119, 266`, `useSpotifyPlaylistManager.ts:218`, `dropboxApiClient.ts:80`, etc. all branch on it.
- Adding a Spotify-specific subclass would force every consumer to widen its `catch` block; a flat single error type keeps the contract simple.
- The `providerId` field on `AuthExpiredError` already distinguishes the two providers when needed.

### Decision 3 — Single retry-after-refresh, force-refresh via `refreshAccessToken()`

**Choice:** On the first 401, call `spotifyAuth.refreshAccessToken()` (not `ensureValidToken`), then read the fresh access token via `spotifyAuth.getAccessToken()` and re-issue the request with it. If still 401, throw `AuthExpiredError('spotify')` and call `spotifyAuth.reportUnauthorized()`.

**Why:**

- `ensureValidToken()` only refreshes when the token is within the 5-minute expiry buffer. A token that's been server-side revoked but not yet near expiry would short-circuit through `ensureValidToken` without refreshing, and the retry would re-use the same dead token. Forcing `refreshAccessToken()` bypasses that.
- The Spotify auth singleton already has a single-flight guard (`refreshInFlight`) inside `refreshAccessToken`, so concurrent 401 retries from different requests collapse onto one network refresh — same shape as Dropbox.
- Capping the retry at one mirrors Dropbox, prevents infinite refresh loops, and aligns with HTTP best practices for stale-token replay.

**Alternatives considered:**

- *Retry indefinitely with exponential backoff.* Rejected — a persistent 401 means the refresh token has been revoked; further retries waste battery and never recover.
- *Skip the retry when `refreshAccessToken()` itself fails.* Already handled: `refreshAccessToken` throws when no refresh token exists or the refresh endpoint returns 400/401; the wrapper catches and re-raises as `AuthExpiredError('spotify')` after calling `reportUnauthorized()`.

### Decision 4 — Promote `notifySessionExpired()` to a public `reportUnauthorized()` method

**Choice:** Add a public `reportUnauthorized(): void` on the `spotifyAuth` singleton that performs `logout()` then dispatches `SESSION_EXPIRED_EVENT` (i.e. the existing `notifySessionExpired` private). The private `notifySessionExpired()` is removed; its single internal call site in `performRefresh()` is updated to call `reportUnauthorized()` instead.

**Why:**

- Mirrors `DropboxAuthAdapter.reportUnauthorized()` — same name, same semantics (clear tokens + notify).
- Encapsulates "session is unrecoverable" in one place: callers don't need to remember to `logout()` + `notifySessionExpired()` in the right order.
- Avoids exposing `notifySessionExpired` as public on its own, which would be a footgun (dispatching the event without clearing tokens leaves the app in an inconsistent state).

**Alternatives considered:**

- *Just make `notifySessionExpired` public.* Rejected — callers would have to remember to call `logout()` first or risk leaving stale tokens in `localStorage`.

### Decision 5 — Wrap the retry inside `spotifyApiRequest`, not `executeApiRequest`

**Choice:** Keep `executeApiRequest` as the low-level fetch + status-check that throws `SpotifyApiError`. Add the 401 retry-after-refresh logic inside `spotifyApiRequest`, which already owns rate-limit gating and request dedup.

**Why:**

- `executeApiRequest` is also called from inside the dedup `Promise` cached in `inflightRequests`. If we put the retry there, two concurrent GETs to the same URL would dedup into the same retry, which is fine — but the first 401 retry would re-enter `executeApiRequest` with the stale `token` parameter. Keeping the retry one level up lets us recompute the token for the retry call cleanly.
- Single-flight: when `refreshAccessToken()` is in flight, all concurrent 401 retries await the same refresh and re-fire with the same fresh token. The dedup map in `spotifyApiRequest` continues to work because the retry uses a different `token`-bearing closure but the same URL/method key — the dedup logic still returns the in-flight promise to a second caller hitting the same URL.

### Decision 6 — `apiPlayTrack` and friends throw `SpotifyApiError` too

**Choice:** `apiPlayTrack`, `apiPlayContext`, and `apiPlayPlaylist` in `src/services/spotifyPlayerPlayback.ts` change their `throw new Error(...)` to `throw new SpotifyApiError(status, ...)`. The `parsePlayError` helper continues to format the rich message (including `error.reason`, `Retry-After`, etc.) but the thrown object now carries the structured `status` field.

**Why:**

- The 401 path the issue calls out (line 118 in `spotifyPlaybackAdapter.ts`) actually comes from `spotifyPlayer.playTrack()` → `apiPlayTrack()`, not from `spotifyApiRequest`. If `apiPlayTrack` keeps throwing a plain `Error`, line 118's `instanceof SpotifyApiError` check fails and we'd still need `.includes('401')` parsing as a fallback.
- `apiPlayTrack` does not get the retry-after-refresh treatment (the play endpoint is more sensitive to replay, and the existing `playWithRetry` already retries with its own state machine). It only adopts the structured error type — the retry path stays in `playWithRetry`.

**Alternatives considered:**

- *Route `apiPlayTrack` through `spotifyApiRequest`.* Rejected — the request body, headers, and play-error message formatting are specific to the play endpoint, and routing through the generic helper would lose the `parsePlayError` shape that surfaces `error.reason` and `Retry-After` to logs.

## Risks / Trade-offs

- **Risk:** A 401 occurring inside the dedup window for a GET request would refresh once and retry; if the second 401 fires for one caller while another concurrent caller is mid-flight on the original token, only one of them will see `AuthExpiredError`. **Mitigation:** the dedup map keys by URL+method, so both concurrent callers share the *same* promise — the retry happens once and both callers receive the same outcome (success or `AuthExpiredError`). Verified by reading the dedup logic: `inflightRequests.get(key)` returns the existing promise, including its rejection.

- **Risk:** `reportUnauthorized()` calls `logout()` which clears `localStorage.spotify_token`. If a refresh-then-retry sequence is racing a user-initiated re-auth (e.g. the user re-clicked the Spotify toggle mid-401), we could clear a token the user just set. **Mitigation:** `reportUnauthorized` only fires when the *second* 401 happens, by which point the post-refresh token was rejected — so any token in storage at that point is dead. The user-initiated re-auth would write a fresh token *after* the clear, so the worst case is a momentarily empty `localStorage` slot, not a lost session.

- **Risk:** Existing callers that catch `Error` and inspect `err.message` to display a toast would still see the same message, but cosmetic differences (e.g. `SpotifyApiError` vs `Error` in console traces) might surprise reviewers. **Mitigation:** `SpotifyApiError` extends `Error`, sets `name = 'SpotifyApiError'`, and uses the same `message` format. Existing `instanceof Error` checks continue to work.

- **Trade-off:** This change focuses on 401 only; the 403 / 429 parsing in `spotifyPlaybackAdapter.playWithRetry` remains string-based. The structured `SpotifyApiError` makes that follow-up cleanup trivial (`err.status === 429` instead of `message.includes('429')`), but is deferred to keep this change focused.

## Spec strategy

The behavioral contract this change codifies — Spotify Web API requests retry once after a forced token refresh on 401 and surface a terminal 401 as a structured `AuthExpiredError` plus a session-expired notification — is already captured in `openspec/specs/auth-system/spec.md` Requirements 5 ("Transient vs Terminal Failure Handling") and 6 ("Mid-Session Unrecoverable Auth Failure"), but only at the *general* provider level. Today neither requirement names a Spotify-specific scenario, so the Spotify implementation drifted (no retry, message-string parsing) without violating the literal text.

The delta adds one **MODIFIED Requirement** block for each of these two requirements, keeping the existing language and adding Spotify-specific scenarios that pin down the one-shot retry-after-refresh contract and the terminal-401 handling. The general transient-vs-terminal language stays intact and continues to govern Dropbox.
