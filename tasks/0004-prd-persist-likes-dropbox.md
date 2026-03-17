# PRD: Persist Dropbox Likes to Dropbox Cloud Storage

## Introduction/Overview

Currently, Dropbox liked songs are stored only in the browser's IndexedDB, making them local to each device. Users who listen on multiple devices lose their liked songs when switching browsers or machines. This feature moves the source of truth for Dropbox likes to a JSON file stored in the user's own Dropbox account (`.vorbis/likes.json`), enabling cross-device sync while keeping IndexedDB as a fast local cache.

## Goals

1. Persist Dropbox liked songs to `/.vorbis/likes.json` in the user's Dropbox account
2. Sync likes across devices — likes/unlikes made on one device appear on all others
3. Maintain fast, responsive UI by keeping IndexedDB as the local read cache
4. Handle offline/error scenarios gracefully without blocking the user
5. Properly resolve conflicts when the same track is liked on one device and unliked on another

## User Stories

- As a user, I want my liked songs to be available on any device where I log in to my Dropbox account
- As a user, I want liking/unliking a song to feel instant, with the sync happening in the background
- As a user, I want unliking a song on one device to remove it on my other devices too
- As a user, I want the app to work normally even if the sync fails temporarily

## Functional Requirements

1. On app load (when Dropbox is authenticated), download `/.vorbis/likes.json` from Dropbox, merge with local IndexedDB, and update both
2. On like/unlike, write to IndexedDB immediately, then upload to Dropbox after a 2-second debounce
3. Use last-write-wins conflict resolution with tombstones: track both likes (`likedAt`) and unlikes (`deletedAt`); the most recent timestamp wins
4. Prune tombstones older than 30 days to bound file size
5. Create the `.vorbis` folder automatically on first sync
6. On upload failure, retry on the next mutation or after a timeout
7. On download failure, fall back to local IndexedDB data
8. Existing export/import functionality should trigger a sync push after import

## Non-Goals

- Real-time push notifications between devices (user must reload to pick up changes from other devices)
- Syncing other data types (pins, playlists) — this is likes-only for now
- Conflict-free merging without any data loss possibility (last-write-wins is acceptable)
- UI indicators for sync status (nice-to-have, not required)

## Technical Considerations

- Dropbox content API uses a different host (`content.dropboxapi.com`) with `Dropbox-API-Arg` header for upload/download
- Upload uses `mode: "overwrite"` and `mute: true` (suppress desktop notifications)
- Download returns 409 with `path/not_found` when file doesn't exist (first use)
- Tombstones are stored locally in a new `tombstones` IndexedDB store (requires DB version bump from 5→6)
- The sync service is a singleton initialized alongside the Dropbox provider
- Auth token refresh follows the existing 401-retry pattern

## File Format: `/.vorbis/likes.json`

```json
{
  "version": 1,
  "updatedAt": "2026-03-17T12:00:00.000Z",
  "likes": [
    { "trackId": "id:abc", "track": { ... }, "likedAt": 1710000000000 }
  ],
  "tombstones": [
    { "trackId": "id:xyz", "deletedAt": 1710000000000 }
  ]
}
```

## Success Metrics

- Likes persist across browser sessions and devices
- Like/unlike operations remain instant (no perceptible UI delay)
- No data loss when syncing between two devices
