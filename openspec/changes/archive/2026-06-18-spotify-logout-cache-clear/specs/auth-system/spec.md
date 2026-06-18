# auth-system — Delta Spec: Logout Cache Clearing

## Change

Extends **Requirement: Disconnect Confirmation and Cleanup** to require that provider
logout clears all provider-derived cached data, not only queue and playback state.

## New Requirement: Provider Logout Clears All Derived Caches

On logout, a provider adapter SHALL clear all cached data it wrote during the session,
including in-memory caches and IndexedDB stores.

**Rationale**: without this, playlist, track, and search data from a previous account
persist into the next session on the same device — a data-hygiene leak. Dropbox already
satisfies this requirement; this delta brings Spotify to parity.

### Scenario: Spotify logout clears in-memory caches

- **WHEN** the Spotify provider is logged out
- **THEN** the in-memory track-saved, album-saved, and track-list caches are cleared
- **AND** the in-memory liked-songs count and liked-songs list caches are cleared

### Scenario: Spotify logout clears IndexedDB library cache

- **WHEN** the Spotify provider is logged out
- **THEN** the IndexedDB library cache (playlists, albums, track lists, meta stores)
  is cleared so no data from the previous account leaks into the next session
