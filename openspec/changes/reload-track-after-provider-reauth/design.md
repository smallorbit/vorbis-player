## Context

The player carries a single "current track" pointer and a driving-provider playback adapter. When a provider's session expires mid-playback:

1. The Web Playback SDK (Spotify) or the HTML5 `<audio>` element (Dropbox) is left in a transitional state — the SDK detaches, the audio element's `src` is unset, or playback is paused with no recoverable source.
2. The seek bar collapses to `0:00 / 0:00` because the driving adapter no longer emits `state` with a real duration.
3. After the user re-authenticates via Settings (toggle on → OAuth popup → success), `authRevision` bumps and `connectedProviderIds` recomputes — but nothing prompts the playback adapter to re-load the current track. Play button presses no-op (or call `playTrack` on a track whose `prepareTrack`/`<audio>.src` was never primed against a valid token).

The existing `prepareTrack(track, { positionMs })` pathway (used by next-track pre-warm and persisted-session hydrate) already knows how to silently set up a track for playback at any position without auto-playing. We can reuse it: when a provider's auth transitions `false → true` AND the queue's current track belongs to that provider, call `prepareTrack` on the current track at the position the user left off at — sourced from the persisted session snapshot (`SessionSnapshot.playbackPosition` in `src/services/sessionPersistence.ts`) that the app already maintains for on-reload hydration. When that snapshot is absent or its `trackId` does not match the current track, fall back to position `0`.

Stakeholders: end users (recovery from session expiry should be one-toggle), and the playback-engine + auth-system specs which currently leave this transition undefined.

## Goals / Non-Goals

**Goals:**
- After a re-authentication that restores a previously-expired session, the seek bar paints with the real duration of the current track within ~one render cycle.
- The cursor is positioned where the user left off before navigating to Settings to re-authenticate (sourced from `SessionSnapshot.playbackPosition`).
- Pressing play immediately after re-authentication resumes playback from that cursor position.
- The re-prime is silent: no auto-play, no toast, no queue mutation, no scroll, no track-change notification.
- Works for both Spotify Web Playback SDK and Dropbox HTML5 audio.

**Non-Goals:**
- Auto-resuming playback. The user pressed pause (implicitly via the auth failure); they need to consciously press play after re-auth.
- Re-priming non-current tracks in the queue. Only the queue's `currentTrackIndex` track is re-primed.
- Persisting position with higher granularity than the existing session snapshot already provides. Whatever `SessionSnapshot.playbackPosition` says is authoritative; this change does not adjust how often that field is written.

## Decisions

### Decision 1: Trigger source — provider auth `false → true` transition

Detect the transition in `ProviderContext` by diffing `connectedProviderIds` across renders (or by listening to `AUTH_STATE_CHANGED_EVENT` and the OAuth-complete `message` handler that already exists). When a `providerId` is newly present in `connectedProviderIds` and was absent in the previous render, dispatch a `PROVIDER_RECONNECTED_EVENT` with `detail: { providerId }`.

**Alternatives considered:**
- Polling the adapter state — wasteful and racy.
- Have `MockAuthAdapter.beginLogin()` / Spotify `handleCallback` dispatch the event directly — couples auth adapters to playback concerns; the diff in ProviderContext is the single right place because it already owns `connectedProviderIds`.

### Decision 2: Effect placement — `useProviderPlayback` (or a new sibling hook in `src/hooks/`)

The listener lives in the same hook that already calls `playTrack` / consumes the driving descriptor, because that hook has the queue's current track and the driving-provider mapping. The handler:

1. Reads `currentTrack` from `mediaTracksRef` at `currentTrackIndex`.
2. If `currentTrack?.provider !== detail.providerId`, no-op.
3. Else, resolves the driving descriptor for `currentTrack.provider` and calls `descriptor.playback.prepareTrack(currentTrack, { positionMs: 0 })`.

**Alternatives considered:**
- Putting the re-prime in `ProviderContext` directly — context shouldn't reach into playback adapters or know about queue/current-track state.
- A new `usePlayerReauth` hook — premature; the logic is small enough to fit in `useProviderPlayback`.

### Decision 3: Reuse `prepareTrack` rather than introducing a new adapter method

`prepareTrack(track, { positionMs })` already produces the desired effect on both providers — see issue #1563 / PR #1573 for the recent Dropbox guard rework and `src/providers/spotify/spotifyPlaybackAdapter.ts` for the SDK-side prime. The pre-warm and persisted-session paths use it; this change just adds one more caller.

**Alternatives considered:**
- Adding `rehydrate(track)` — duplicates `prepareTrack` semantics.
- Calling `playTrack` and immediately `pause` — auto-plays for a frame; visibly bad UX.

### Decision 5: Source the re-prime position from `SessionSnapshot.playbackPosition`

The app already persists `playbackPosition` (and `trackId`, `queueTracks`, etc.) to `localStorage` under `vorbis-player-last-session` via `saveSession()` in `src/services/sessionPersistence.ts`. That snapshot is what powers the on-reload hydrate. Reuse it here:

1. Read the snapshot via `loadSession()` at re-prime time.
2. If `snapshot?.trackId === currentTrack.id` AND `typeof snapshot.playbackPosition === 'number'`, use `snapshot.playbackPosition` as `positionMs`.
3. Otherwise fall back to `0`.

The `trackId` match is the safety guard — if the queue advanced after the snapshot was last written (e.g., the user manually skipped while the SDK was in a half-broken state), re-priming at a stale position from a different track would be wrong. Position `0` is the safe fallback.

**Alternatives considered:**
- Introducing a new "last-known position per provider" cache — duplicates `SessionSnapshot` for no added value; the snapshot already updates on `state` notifications during steady-state playback (see existing `useSessionPersistence` write path).
- Reading position from the playback adapter just before re-prime — adapters are in a degraded state post-logout (Spotify SDK detached, Dropbox `<audio>.src` cleared); they cannot reliably report the last position. The persisted snapshot is the only durable source.
- Always re-priming at `0` — rejected per user feedback: resuming from where the user left off is the expected UX.

### Decision 4: Guard against double-prime during initial mount

`ProviderContext` initializes with `authRevision=0` and `connectedProviderIds` derived once. The first render of `useProviderPlayback` MUST NOT treat the initial set as a `false → true` transition for already-current-track providers, otherwise the persisted-session hydrate would race against this effect. Use the standard "first-render skip" pattern: hold a `previousConnectedRef` initialized to the first-render snapshot, and only diff on subsequent renders.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Re-prime fires when the queue is empty / current index is invalid | The handler early-returns when `currentTrack` is undefined. |
| Two adjacent re-prime triggers (e.g., AUTH_STATE_CHANGED + storage event from another tab) | `prepareTrack` is idempotent with the existing same-track guards (Dropbox: `audio.src && this.currentTrack.id === track.id` short-circuits; Spotify: SDK accepts repeat prepare calls). |
| The current track no longer exists on the provider after re-auth (e.g., user revoked playlist access) | `prepareTrack` rejects → engine surfaces existing error path (per playback-engine Requirement 5). Out of scope to handle differently. |
| The persisted `playbackPosition` is beyond the track's actual duration (e.g., snapshot stale, track on the provider has a different length than recorded) | Adapter implementations already clamp; both the Spotify SDK and the Dropbox `<audio>` element resolve out-of-range seeks to the nearest valid position. No additional guard needed in this layer. |
| `SessionSnapshot` write cadence isn't tight enough — user left off at 1:23 but snapshot reads 1:18 | Acceptable for v1; matches the existing on-reload hydrate fidelity. If field testing shows visible drift, increase the snapshot write frequency in a follow-up. |
| The mock provider's `prepareTrack` is a no-op pre-warm path now (post #1563), so the Playwright spec needs a different signal | Acceptable. The spec verifies the *event dispatch* and the *handler invocation*, not adapter internals — see tasks.md for the test strategy. |

## Migration Plan

Drop-in. No data shape changes, no persisted state, no breaking API. The event listener is added in `useProviderPlayback`; the dispatcher in `ProviderContext`. Both are wired with the existing event-bus pattern (`window.addEventListener` / `dispatchEvent`).

Rollback: revert the commit. There is no migration data to undo.

## Open Questions

- Should the re-prime also fire when the user opens settings → enables a NEW (never-authed) provider whose tracks happen to be in the queue? Initial answer: yes, the diff captures that case automatically. The test plan covers it under "re-prime on first authentication". If field testing surfaces issues we can scope down.
