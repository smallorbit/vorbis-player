# PRD: Unified Liked Tracks Playlist

## Introduction/Overview

When multiple music providers (Spotify, Dropbox) are enabled simultaneously, each has its own "Liked Songs" collection. This creates a fragmented experience where users must switch between providers to browse all their liked music. This feature consolidates all provider-specific liked tracks into a single, unified "Liked Songs" playlist that appears in place of the individual provider playlists.

## Goals

1. Present a single "Liked Songs" playlist that aggregates liked tracks from all enabled providers when 2+ providers are active.
2. Maintain full like/unlike functionality — actions sync back to the originating provider.
3. Show a provider icon per track so users know where each track lives.
4. Preserve existing single-provider behavior when only one provider is active.

## User Stories

- **As a user with Spotify and Dropbox enabled**, I want to see one "Liked Songs" playlist that contains all my liked tracks from both services, so I don't have to switch between providers.
- **As a user viewing the unified liked playlist**, I want to see a small provider icon next to each track, so I know which service it belongs to.
- **As a user**, I want to unlike a track from the unified playlist and have that unlike reflected in the source provider (e.g., removed from Spotify's saved tracks).
- **As a user**, I want the unified liked playlist sorted by most recently liked, interleaving tracks from all providers.
- **As a user with only one provider active**, I want the liked songs experience to remain exactly as it is today.

## Functional Requirements

1. **Unified playlist creation**: When 2+ providers are active and have `hasLikedCollection` capability, construct a virtual "Liked Songs" collection that merges tracks from all providers.
2. **Hide individual liked playlists**: When the unified playlist is active, individual provider "Liked Songs" entries must not appear in the library or playlist selection UI.
3. **Track aggregation**: Fetch liked tracks from each provider's `CatalogProvider.listTracks()` (with `kind: 'liked'`) and merge them into a single list.
4. **Sort order**: Tracks sorted by liked timestamp descending (most recent first), interleaved across providers. If a provider does not supply a liked timestamp, those tracks sort after timestamped tracks.
5. **Provider attribution**: Each track in the unified playlist displays a small provider icon (Spotify green icon, Dropbox blue icon) to indicate its source.
6. **Like/unlike sync**: Liking or unliking a track from the unified playlist delegates to the source provider's `setTrackSaved()`. The unified list updates accordingly (optimistic update, rollback on failure).
7. **Count display**: The unified playlist card shows the total count of liked tracks across all providers.
8. **Single-provider fallback**: When only one provider is active, the system behaves identically to today — no unified playlist is created, the provider's native liked songs collection is shown.
9. **Real-time updates**: When a track is liked/unliked from any context (e.g., the now-playing bar), the unified playlist reflects the change. Existing event mechanisms (Dropbox's `LIKES_CHANGED_EVENT`, Spotify's cache invalidation) should feed into the unified list.
10. **Playlist selection**: Selecting the unified "Liked Songs" playlist loads and plays all merged tracks. Playback delegates to the correct provider per track based on `playbackRef`.

## Non-Goals (Out of Scope)

- Cross-provider deduplication (same song on Spotify and Dropbox treated as separate tracks).
- A new persistent storage layer for the unified list — it is computed at runtime from provider data.
- Changing how individual providers store or manage their liked tracks internally.
- Unified liked tracks when only one provider is active.
- Drag-and-drop reordering of the unified liked playlist.

## Design Considerations

- The unified "Liked Songs" card in `PlaylistSelection` should use a blended gradient of the active provider colors (e.g., Spotify green + Dropbox blue).
- Provider icons should be small and unobtrusive — positioned near the track title or in a dedicated column, consistent with how provider info might appear elsewhere.
- The existing heart icon (♥) and like animation should work identically in the unified context.

## Technical Considerations

- **CollectionRef**: A new unified liked `CollectionRef` may be needed (e.g., `{ provider: 'unified', kind: 'liked' }`) or the system can use a sentinel value. Alternatively, the aggregation can happen at the hook/component level without a new ref type.
- **Timestamp availability**: Spotify returns `added_at` on liked tracks. Dropbox stores `likedAt` in IndexedDB. Both provide timestamps for sorting.
- **Performance**: Fetching liked tracks from multiple providers should happen in parallel. Consider caching the merged result with invalidation on any provider's change event.
- **useLibrarySync**: Currently returns `likedSongsPerProvider: PerProviderLikedCount[]`. This can be extended to also return a `totalLikedCount` when multiple providers are active.
- **PlaylistSelection**: Currently renders one card per provider when `likedSongsPerProvider.length >= 1`. Needs to render a single unified card when 2+ providers are present.
- **Track list rendering**: `QueueTrackList` (used by `QueueDrawer` / `QueueBottomSheet`) needs to support an optional provider icon column/badge.

## Success Metrics

- When 2+ providers are enabled, exactly one "Liked Songs" entry appears in the library (not one per provider).
- Liked tracks from all providers appear in the unified list, sorted by recency.
- Like/unlike actions in the unified list correctly update the source provider.
- No regression in single-provider behavior.

## Resolved Questions

1. **Gradient**: The unified playlist card uses a blended gradient of the active provider colors.
2. **Cross-provider playback**: Current provider-switching handles cross-provider track transitions seamlessly — no additional work needed.
