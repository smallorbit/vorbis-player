## 1. Dispatch a provider-reconnected signal

- [ ] 1.1 Add `PROVIDER_RECONNECTED_EVENT` constant to `src/constants/events.ts` with detail shape `{ providerId: ProviderId }`. Document it alongside `SESSION_EXPIRED_EVENT`.
- [ ] 1.2 In `src/contexts/ProviderContext.tsx`, hold a `previousConnectedRef` initialized on first render to a snapshot of `connectedProviderIds`. After the initial mount, on each render where `connectedProviderIds` changes, compute `(connected - previousConnected)` and dispatch `PROVIDER_RECONNECTED_EVENT` once per newly-connected provider id.
- [ ] 1.3 Verify the dispatch does NOT fire on first render (use the first-render skip pattern documented in design.md Decision 4).

## 2. Subscribe and re-prime the current track

- [ ] 2.1 In `src/hooks/useProviderPlayback.ts`, attach a listener for `PROVIDER_RECONNECTED_EVENT` inside a `useEffect` with `[]` deps. Use refs for `mediaTracks`, `currentTrackIndex`, and `getDrivingProviderDescriptor` so the listener reads current values without re-binding.
- [ ] 2.2 In the handler, look up `currentTrack = mediaTracksRef.current[currentTrackIndexRef.current]`. If `currentTrack?.provider !== detail.providerId`, return.
- [ ] 2.3 Resolve the re-prime position: call `loadSession()` from `src/services/sessionPersistence.ts`. If `snapshot?.trackId === currentTrack.id` AND `typeof snapshot.playbackPosition === 'number'`, use `snapshot.playbackPosition`; otherwise use `0`.
- [ ] 2.4 Resolve the descriptor for `currentTrack.provider` via the registry. Call `descriptor.playback.prepareTrack(currentTrack, { positionMs: resolvedPosition })` and swallow rejections (the engine's existing error-recovery path per playback-engine Requirement 5 surfaces unavailable-track failures).
- [ ] 2.5 Confirm the handler is a no-op when `currentTrack` is undefined (empty queue) or when the resolved descriptor lacks `prepareTrack`.

## 3. Verify adapter `prepareTrack` re-primes from cold state

- [ ] 3.1 Read `src/providers/spotify/spotifyPlaybackAdapter.ts` `prepareTrack` to confirm it correctly re-binds the Spotify SDK to the current track when invoked after a `logout()` + re-`beginLogin()` cycle. Extend the adapter only if a cold-state guard suppresses the needed reload.
- [ ] 3.2 Read `src/providers/dropbox/dropboxPlaybackAdapter.ts` `prepareTrack` (post-#1563) to confirm the same-track guard at `audio.src && this.currentTrack?.id === track.id` does NOT short-circuit when `currentTrack` is null/stale after a logout (i.e., the post-logout reset clears `currentTrack` so the second arm of the guard fails, allowing the prime to proceed). Extend if necessary.

## 4. Tests

- [ ] 4.1 Add a unit test in `src/contexts/__tests__/ProviderContext.test.tsx`: simulate `AUTH_STATE_CHANGED_EVENT` flipping a provider into `isAuthenticated() === true` from a prior `false` state, assert `PROVIDER_RECONNECTED_EVENT` is dispatched exactly once with the correct `providerId`.
- [ ] 4.2 Add a unit test that the initial mount does NOT dispatch `PROVIDER_RECONNECTED_EVENT` for providers that are already authenticated at render time.
- [ ] 4.3 Add a unit test in `src/hooks/__tests__/` (new file `useProviderPlayback.reauth.test.ts` or extend an existing) covering three cases for a re-auth event whose `providerId` matches the current track's provider:
  - persisted snapshot's `trackId` matches → adapter `prepareTrack` called with `(currentTrack, { positionMs: snapshot.playbackPosition })`
  - persisted snapshot is absent OR `trackId` mismatch → adapter `prepareTrack` called with `(currentTrack, { positionMs: 0 })`
  - re-auth event for a different provider → adapter `prepareTrack` NOT called
- [ ] 4.4 Extend `playwright/specs/provider-auth-expiry.spec.ts` (or add a new spec `provider-auth-reauth.spec.ts`): use the mock test-control API to (a) expire Spotify, (b) seed the queue + a non-zero playback position for a Spotify track via `__mockTest.setPlaybackState({ trackId, positionMs: 45_000, isPlaying: false })` so `SessionSnapshot.playbackPosition` is populated, (c) call a new `__mockTest.restoreAuth(providerId)` helper that flips the mock adapter back to authenticated and dispatches `AUTH_STATE_CHANGED_EVENT`, (d) assert the seek bar slider's `aria-valuemax` updates from `1` (zeroed placeholder) to the track's real duration AND `aria-valuenow` lands within ~2s of the seeded `45_000`ms — confirming the cursor restored to where the user left off, not `0:00`.

## 5. Verify and document

- [ ] 5.1 Run `npx tsc -b --noEmit`, `npm run test:run`, `npm run build`, and `npx playwright test playwright/specs/provider-auth-expiry.spec.ts playwright/specs/<reauth-spec>.spec.ts`. All must be green.
- [ ] 5.2 Run `openspec validate reload-track-after-provider-reauth --strict` to confirm the delta specs parse cleanly.
- [ ] 5.3 Manual smoke: with the bundle running, expire Spotify mid-playback, re-toggle Spotify on, return to the player, confirm the seek bar paints the real duration and pressing play resumes from position `0`.
