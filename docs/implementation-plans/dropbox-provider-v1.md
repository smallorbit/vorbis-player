# Implementation Plan: Dropbox Provider (v1)

> **Status:** Ready for Implementation  
> **Depends on:** [Spotify Adapter Migration](/Users/roman/src/vorbis-player/docs/implementation-plans/spotify-adapter-migration.md), [Settings Provider UX](/Users/roman/src/vorbis-player/docs/implementation-plans/settings-provider-ux.md), [PRD Dropbox Provider](/Users/roman/src/vorbis-player/docs/prd-dropbox-provider.md)  
> **Created:** March 2025

## Overview

Implement the Dropbox music provider so users can connect their Dropbox account, browse music by folder and (after indexing) by artist/album, and play tracks with the same player controls as Spotify. v1 scope: **playback + metadata indexing**; no merged library, no “liked” collection for Dropbox, and no offline download.

## Goals

- **Auth:** OAuth 2.0 with Dropbox; token storage and refresh (if supported); connect/disconnect from app settings.
- **Catalog:** Folder view (navigate and pick a folder as a collection); metadata view (artist/album grouping from extracted tags) after indexing.
- **Playback:** Stream via temporary/signed links; play/pause, seek, next/previous, queue; refresh links on expiry.
- **Capabilities:** `hasLikedCollection: false`, `hasSaveTrack: false`, `hasExternalLink: false` so UI hides Like and “Open in Spotify” for Dropbox tracks.

## Architecture

### Adapter layout

- **`src/providers/dropbox/`**
  - `dropboxAuthAdapter.ts` – `AuthProvider`: OAuth 2.0 (PKCE or app key flow per Dropbox docs), token in localStorage (e.g. `dropbox_token`), `handleCallback` for `/auth/dropbox/callback`.
  - `dropboxCatalogAdapter.ts` – `CatalogProvider`: List “collections” as folders (and later virtual artist/album groups); list tracks for a folder (or for an artist/album group from index). Uses Dropbox Files API: list folder, get temporary link (or download URL) for streaming.
  - `dropboxPlaybackAdapter.ts` – `PlaybackProvider`: Play a `MediaTrack` whose `playbackRef` holds Dropbox path or temp link id; resolve to stream URL (refresh when expired); use HTML5 Audio or existing player stack; expose `getState` / `subscribe` for position/duration/playing.
  - `dropboxProvider.ts` – Builds `ProviderDescriptor` for `dropbox` with capabilities above.

### OAuth

- Use Dropbox OAuth 2.0 (PKCE recommended). Redirect URI: e.g. `http://127.0.0.1:3000/auth/dropbox/callback` (dev); add to Dropbox app console.
- Scopes: at least `files.metadata.read`, `files.content.read` (or scopes that allow listing and downloading file content).
- Store token (and optional refresh token) in localStorage; clear on disconnect.

### File listing and folder-as-collection

- **List folders:** Dropbox API `list_folder` (and `list_folder_continue` for cursor-based pagination). Filter by extension (e.g. `.mp3`, `.ogg`, `.m4a`, `.flac`) or by `metadata` tag if using Dropbox file types.
- **CollectionRef for Dropbox:** `{ provider: 'dropbox', kind: 'folder', id: path_lower }` (e.g. `/music/albums`). Use `collectionRefToKey` / `keyToCollectionRef` for persistence/URL.
- **List tracks in folder:** Recursively list folder contents; collect all audio files; sort by path or by extracted track number when available.

### Metadata extraction and indexing

- **Client-side parsing:** Use a library (e.g. jsmediatags, music-metadata-browser) to parse ID3 (MP3), Vorbis comments (OGG), or MP4 tags (M4A) from blob/arrayBuffer fetched via Dropbox (e.g. `get_temp_link` + fetch, or range request for first N KB to read tags only where format allows).
- **Index storage:** IndexedDB store keyed by provider + path (or content_hash). Fields: path_lower, rev, title, artist, album, trackNumber, durationMs, picture (blob or URL), year. Optional: content_hash for change detection.
- **Indexing flow:** On first load of a folder (or on “Index” action), enumerate files, fetch tag data in batches, write to IndexedDB. Expose progress (e.g. “Indexing… 12/45”) so NFR-2 is met (progress visible within 5s).
- **Metadata view:** Query index by artist or album; return virtual “collections” as `MediaCollection` (e.g. kind `album` with synthetic id `artist://ArtistName/AlbumName`). List tracks for that collection from index.

### Streaming and playback

- **Temporary link:** Use Dropbox `get_temporary_upload_link` or the appropriate Files API endpoint that returns a temporary URL for downloading file content. Documented TTL (e.g. 4 hours); refresh before expiry or on 403/404.
- **PlaybackRef for Dropbox:** Store `path_lower` (and optionally rev) in `playbackRef.ref`; adapter resolves to temp link when `playTrack` is called; cache link with expiry; on play failure (e.g. 403), refresh link and retry.
- **Player:** Use HTML5 `Audio` or existing in-app player; set `src` to temp link. Support range requests for seek (if Dropbox link supports Range header). Update `PlaybackState` (positionMs, durationMs, isPlaying) via `timeupdate` / `durationchange` / `play` / `pause` events and expose through `getState` / `subscribe`.

### Supported formats

- v1: **MP3** (browser support universal). **OGG/Vorbis**, **M4A/AAC**, **FLAC** where the browser can play them (feature detection or try/catch). Unsupported formats: grey out or show “Unsupported format” in UI; do not add to playable track list or allow play.

### Capability-aware UI

- **ProviderDescriptor.capabilities** for Dropbox: `hasLikedCollection: false`, `hasSaveTrack: false`, `hasExternalLink: false` (no “Open in Dropbox” required for v1).
- **Like button:** Hide or disable when `activeDescriptor.capabilities.hasSaveTrack === false`.
- **External link (e.g. “Open in Spotify”):** Only show when `capabilities.hasExternalLink` and current track’s provider matches; Dropbox tracks do not show this in v1.

## Implementation Steps

### Step 1: Dropbox auth adapter

- Create Dropbox app in developer console; get app key (and secret if not using PKCE).
- Implement `AuthProvider`: `getAuthUrl`, `handleCallback` (exchange code for token), `getAccessToken`, `ensureValidToken` (refresh if supported), `logout` (clear token). Register callback route in `App.tsx` (e.g. `/auth/dropbox/callback`).

### Step 2: Dropbox catalog adapter – folder listing

- Implement `listCollections`: Call Dropbox `list_folder` for a configurable root (e.g. `/` or user-chosen “Music” folder). Return only folders as `MediaCollection` (kind `folder`, id = path_lower). Optionally limit depth or add “Music root” setting.
- Implement `listTracks(collectionRef)` for `kind === 'folder'`: List folder recursively; filter by audio extension; build `MediaTrack` with minimal metadata (path, filename as title if no tags yet); `playbackRef = { provider: 'dropbox', ref: path_lower }`.

### Step 3: Metadata extraction and index

- Add dependency for tag parsing (e.g. `jsmediatags` or `music-metadata-browser`).
- Create IndexedDB store for Dropbox metadata (path_lower, rev, title, artist, album, trackNumber, durationMs, picture, year).
- When listing a folder, optionally trigger “indexing”: for each audio file, fetch first chunk (or full file for small files), parse tags, write to IndexedDB. Expose progress callback for UI (“Indexing… N/M”).
- After indexing, `listTracks` can merge in stored metadata (title, artist, album, durationMs, image). Add optional “Metadata view”: query index by artist/album; return virtual collections and their tracks.

### Step 4: Dropbox playback adapter

- Implement `playTrack(track)`: Resolve `track.playbackRef.ref` (path) to temporary link via Dropbox API; set HTML5 Audio src; play. Store current audio element and link expiry; on `timeupdate` etc., update internal state and notify subscribers.
- Implement `getState()` and `subscribe(listener)` from current playback state.
- Implement `pause`, `resume`, `seek(positionMs)`, `next`, `previous` (next/previous can be app-managed queue; adapter only plays one track at a time and reports end-of-track if needed).
- **Link refresh:** If playback fails with 403/404 or on expiry, call Dropbox again for new temp link and set new src; resume from last position if possible.

### Step 5: Register Dropbox provider

- In `src/providers/registry.ts`, register the Dropbox descriptor alongside Spotify. Ensure settings UI shows “Dropbox” and user can connect and set it as active.

### Step 6: Library UI for Dropbox

- When active provider is Dropbox, library view shows folder tree (and optionally “By Artist” / “By Album” from index). Reuse existing library/drawer patterns; data source is `activeDescriptor.catalog`. Selection uses `CollectionRef` (folder id = path_lower).

## File-Level Summary

| Action | File(s) |
|--------|---------|
| Add | `src/providers/dropbox/dropboxAuthAdapter.ts` |
| Add | `src/providers/dropbox/dropboxCatalogAdapter.ts` |
| Add | `src/providers/dropbox/dropboxPlaybackAdapter.ts` |
| Add | `src/providers/dropbox/dropboxProvider.ts` |
| Add | IndexedDB schema/helper for Dropbox metadata index (e.g. `src/services/cache/dropboxMetadataCache.ts` or under `src/providers/dropbox/`) |
| Add | Metadata parsing utility (e.g. `src/utils/audioMetadata.ts`) using chosen library |
| Refactor | `src/providers/registry.ts` – register Dropbox |
| Refactor | `App.tsx` – handle `/auth/dropbox/callback` |
| Refactor | Library/playlist selection component – when provider is Dropbox, show folder/metadata browser instead of Spotify playlists/albums |

## Environment / Config

- **Dropbox app key:** `VITE_DROPBOX_APP_KEY` (or similar) in `.env.local`; redirect URI configured in Dropbox console to match app (e.g. `http://127.0.0.1:3000/auth/dropbox/callback`).

## Acceptance Criteria

- [ ] User can connect and disconnect Dropbox from app settings.
- [ ] User can browse Dropbox folders and select a folder as the current collection.
- [ ] User can play tracks from the selected folder; play/pause, seek, next/previous work.
- [ ] Metadata indexing runs (progress visible); after indexing, artist/album view available (optional but recommended for v1).
- [ ] Expired stream links are refreshed and playback resumes where possible.
- [ ] Like/Save and “Open in Spotify” are hidden or disabled for Dropbox tracks.
- [ ] Unsupported file types are clearly indicated and not playable.

## Out of Scope (v1)

- Offline download.
- “Liked” or “Favorites” for Dropbox.
- Merged library with Spotify.
- Apple Music or other providers.
