## Why

After a provider's session expires mid-playback and the user later re-authenticates from Settings, the player still holds the stale "no source loaded" state for the current track. Returning to the player from Settings shows `0:00 / 0:00` on the seek bar, and pressing play does nothing because the underlying playback adapter (Spotify Web Playback SDK, Dropbox HTML5 audio element) never re-loaded the track. The user has to manually skip back, restart the queue, or re-click the track in the library — a confusing dead-end for what should be a transparent recovery.

## What Changes

- Detect when a provider transitions from "not authenticated" to "authenticated" while the player has a current track from that provider whose playback state is unloaded/zeroed.
- Re-prime the playback adapter for the current track at the user's last known playback position — sourced from the same persisted session snapshot the app already uses for on-reload hydration — without auto-playing.
- When the persisted snapshot is absent or its `trackId` doesn't match the current track, fall back to position `0`.
- The re-prime is silent (no toast, no scroll, no queue mutation) — it restores the steady-state the player would have had if auth had never lapsed, including the cursor position the user left off at.
- Cover both providers that surface this gap: Spotify Web Playback SDK and Dropbox HTML5 audio.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `playback-engine`: extend the existing Hydrate / Pre-Warm requirements with a "Re-prime After Re-Authentication" scenario covering provider auth transitions from `false → true` while a track from that provider is current.
- `auth-system`: clarify Requirement 2 (Single On-Off Toggle per Provider) — re-enabling a provider whose session previously expired SHALL trigger the playback re-prime when the queue's current track belongs to that provider.

## Impact

- `src/contexts/ProviderContext.tsx` — emit a structured "provider reconnected" signal (or expose `connectedProviderIds` change with previous-state diffing) so playback layers can subscribe.
- `src/hooks/useProviderPlayback.ts` or a new sibling hook — listen for the signal and, when the current driving track's provider just transitioned to authenticated, call `prepareTrack(currentTrack, { positionMs: 0 })` on the adapter without invoking `playTrack`.
- `src/providers/spotify/spotifyPlaybackAdapter.ts` and `src/providers/dropbox/dropboxPlaybackAdapter.ts` — confirm `prepareTrack` is safe to call on the current track from a cold (post-logout) state and produces a `state` notification with the real duration; extend if a same-track guard would suppress the needed reload.
- No new dependencies, no breaking API changes. Adds at most one event listener and one effect; constant-time work per auth transition.
