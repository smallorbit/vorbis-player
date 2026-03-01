# Product Requirements Document: Dropbox Provider & Multi-Provider Architecture

## 1. Product Context

### 1.1 Problem Statement
Users who own personal music collections (e.g., stored in cloud storage like Dropbox) cannot play them through Vorbis Player today. The app is built exclusively around Spotify. Enabling Dropbox (and future providers such as Apple Music) requires a modular provider system and a clear first-party streaming experience for personal libraries.

### 1.2 Vision
Vorbis Player becomes a **multi-source music player**: one active music source at a time, selectable in app settings. Users can connect Spotify for streaming catalogs, connect Dropbox to stream their personal files, and later add other providers—all with a consistent playback and library UX.

### 1.3 User Segments
- **Spotify Premium users** (current): Continue using Spotify as the primary source with no regression.
- **Personal library users**: Store music in Dropbox and want to browse by folder and by metadata (artist/album) and play with the same player controls and visual experience.
- **Hybrid users**: Switch between Spotify and Dropbox depending on context (e.g., commute vs. home library).

---

## 2. Goals & Success Metrics

### 2.1 Goals
- **Dropbox v1**: Users can connect Dropbox, browse their music (folders + metadata views), and play tracks with seek/pause/next/previous and queue behavior.
- **Architecture**: Spotify is abstracted behind a provider interface so that Dropbox and future providers plug in without app-level coupling.
- **Settings**: Users choose a single active provider (e.g., Spotify or Dropbox) from the app settings menu; switching updates library and playback surfaces without requiring a full reload.

### 2.2 Success Metrics
- **Adoption**: Number of users who connect Dropbox at least once.
- **Retention**: Sessions where Dropbox is the active provider and at least one track is played.
- **Quality**: No increase in playback errors or auth failures for existing Spotify users post-refactor.
- **Performance**: Time to first play (Dropbox): target &lt; 10s after folder/collection selection when metadata is already indexed; first-time indexing progress visible within 5s.

---

## 3. Functional Requirements

### 3.1 Provider Connection (All Providers)
- **FR-1** Users can connect a provider (e.g., Spotify, Dropbox) from the app settings drawer.
- **FR-2** Users can disconnect a provider from the app settings drawer; disconnecting clears cached tokens and optionally clears that provider’s library cache.
- **FR-3** Only one provider is “active” at a time; the active provider drives the library view and playback.
- **FR-4** The active provider choice is persisted (e.g., localStorage) and restored on next visit.

### 3.2 Dropbox-Specific
- **FR-5** Users can authenticate with Dropbox via OAuth 2.0 (or approved alternative) and grant the app access to read files (e.g., `files.metadata.read`, `files.content.read` or equivalent).
- **FR-6** Users can browse their Dropbox music as:
  - **Folder view**: Navigate folder hierarchy and select a folder to use as a “collection” (playlist-like).
  - **Metadata view**: After indexing, browse by artist and/or album (grouped by extracted metadata).
- **FR-7** Users can play audio files from Dropbox with: play/pause, seek, next track, previous track, and queue behavior consistent with the current player (e.g., in-order or shuffled within the selected collection).
- **FR-8** Supported audio formats for Dropbox v1: at least MP3, and ideally OGG/Vorbis, M4A/AAC, FLAC where the browser supports playback. Unsupported formats are clearly indicated (e.g., disabled or with an explanation).

### 3.3 App Settings UX
- **FR-9** App settings (e.g., Visual Effects Menu / App Settings drawer) includes a “Music sources” or “Providers” section.
- **FR-10** Each available provider (Spotify, Dropbox, and placeholders for future ones) shows:
  - A toggle or control to “Connect” / “Disconnect.”
  - Status: Not connected, Connecting, Connected, Error (with short message if applicable).
- **FR-11** User can set the active provider (e.g., “Use Spotify” vs “Use Dropbox”); changing the active provider updates the library and playback context (e.g., clears or replaces current queue when switching).

### 3.4 Library & Playback Consistency
- **FR-12** When the active provider is Spotify, behavior matches current app (playlists, albums, liked songs, track info, external links to Spotify where applicable).
- **FR-13** When the active provider is Dropbox, library shows only Dropbox collections/folders and metadata views; playback uses stream URLs from Dropbox (temporary/signed links with refresh on expiry as needed).
- **FR-14** Provider-unsupported actions are hidden or disabled (e.g., “Like” / “Save” for Dropbox if not implemented; “Open in Spotify” only for Spotify tracks).

---

## 4. Non-Functional Requirements

### 4.1 Performance
- **NFR-1** Startup: If the active provider is Spotify, time-to-interactive and time-to-playable-library should not regress vs. current baseline.
- **NFR-2** Dropbox indexing: First batch of metadata (e.g., first folder or first N files) should be available for display within a reasonable time (target: progress visible within 5s; first play within 10s when data is cached).
- **NFR-3** Playback: Seek and play/pause for Dropbox streams should feel responsive (e.g., &lt; 500 ms where network allows).

### 4.2 Reliability & Error Handling
- **NFR-4** Expired stream links (e.g., Dropbox temporary links): App detects expiry (e.g., 4xx on range request) and refreshes the link and resumes playback where possible, with a clear transient error state if refresh fails.
- **NFR-5** Partial metadata: Missing or invalid tags (e.g., no artist) are handled gracefully (e.g., “Unknown Artist” / filename fallback) without breaking indexing or playback.
- **NFR-6** Rate limits: Respect Dropbox (and Spotify) rate limits; back off and surface a user-visible message when the app is throttled.

### 4.3 Security & Privacy
- **NFR-7** OAuth tokens (Spotify, Dropbox) are stored in a manner consistent with current practice (e.g., localStorage with same security considerations); no tokens in logs or analytics.
- **NFR-8** Cached metadata (e.g., file paths, track titles) is stored locally (e.g., IndexedDB) and not sent to third parties except the chosen provider’s API for streaming/auth.
- **NFR-9** Disconnecting a provider revokes or discards stored tokens and optionally clears that provider’s cached data.

---

## 5. User Experience Flows & States

### 5.1 First-Time Provider Connection
- User opens App Settings and sees “Music sources” with Spotify and Dropbox.
- User taps “Connect” for Dropbox → redirect to Dropbox OAuth (or in-app OAuth flow) → callback returns to app → status shows “Connected.”
- If Dropbox is selected as active provider, library view switches to Dropbox (folder/metadata browse); if no collection selected yet, show empty state with CTA to browse folders or wait for indexing.

### 5.2 Switching Active Provider
- User opens App Settings, sees current active provider (e.g., “Spotify”).
- User selects “Use Dropbox” (or similar) → app sets Dropbox as active, persists preference, updates library source and playback context (e.g., clear current queue, show Dropbox library or empty state).
- No full page reload required; transition is in-place.

### 5.3 Empty / Error / Indexing States
- **Empty**: No collection selected (Dropbox) or no playlist selected (Spotify) → show existing “choose playlist” / “choose folder or album” experience.
- **Error**: Auth failed, network error, or rate limit → show short message and “Retry” or “Reconnect” where applicable.
- **Indexing (Dropbox)**: While metadata is being extracted, show a progress indicator (e.g., “Indexing your music…” with optional count or spinner); allow playback from folder view even before full metadata indexing completes.

### 5.4 Playback
- Playback controls (play/pause, seek, next/prev, volume) behave the same regardless of provider; only the source of the stream and the track metadata (and optional provider-specific actions) differ.

---

## 6. Out of Scope for v1

- **Unified merged library**: Single view mixing tracks from Spotify and Dropbox in one list is not in v1.
- **Full provider feature parity**: e.g., “Liked songs” or “Save track” for Dropbox is not required in v1; such actions can be hidden or disabled for Dropbox.
- **Offline / download**: Downloading Dropbox files for offline play is out of scope for v1.
- **Apple Music (or other providers)**: Design and implementation of additional providers beyond Dropbox are out of scope for this PRD; the architecture must allow adding them later without redesign.

---

## 7. Dependencies & Assumptions

- **Dropbox API**: Use of Dropbox API v2 (or recommended version) for OAuth, file list, and temporary link generation; assumption that temporary links are sufficient for streaming with refresh-on-expiry.
- **Browser support**: Same as current app (e.g., modern evergreen); reliance on HTML5 audio or existing player stack for actual playback of streamed URLs.
- **Metadata extraction**: Client-side (or optional worker) parsing of ID3/OGG/MP4 metadata for artist, album, artwork, etc.; no dependency on a separate metadata service for v1.

---

## 8. Acceptance Criteria (Summary)

- Users can connect and disconnect Dropbox from app settings.
- Users can set “Dropbox” as the active provider and browse folder + metadata views and play tracks with standard controls.
- Users can switch active provider (Spotify ↔ Dropbox) from settings; library and playback context update without reload.
- Spotify-only flows remain functionally equivalent after refactor.
- No app-level code directly imports Spotify-specific modules for playback/catalog; all access goes through provider interfaces.
- Clear UX for empty, error, and indexing states; expired stream links are handled with refresh or clear error message.
