# Last.fm & MusicBrainz API Reference for Radio Feature

A practical guide to both APIs, how they interrelate, and how universal music identifiers bridge across Spotify, Dropbox, and external recommendation services.

---

## The Identifier Landscape

Understanding how tracks are identified across services is foundational to building a cross-provider radio feature.

### Industry-Standard Identifiers (Platform-Agnostic)

| Identifier | Scope | Format | Example |
|---|---|---|---|
| **ISRC** | Single recording | 12 alphanumeric chars | `USRC17607839` |
| **UPC / EAN** | Release (album/EP/single) | 12–13 digit barcode | `602517737280` |
| **ISWC** | Musical composition/work | `T-` + 9 digits + check | `T-345246800-1` |

**ISRC** is the most important for your use case. Key facts:

- Identifies a **specific recording** (not a song). The original album version, a radio edit, a remaster, and a remix each get their own ISRC.
- Should be **identical across all platforms** (Spotify, Apple Music, Deezer, etc.) when properly distributed.
- Can be **embedded in audio file metadata** (ID3 tags in MP3, Vorbis comments in FLAC/OGG). MusicBrainz Picard writes ISRCs to files when available.
- Spotify exposes ISRCs via `external_ids.isrc` on track objects (though this was briefly removed in Feb 2026 and then reverted).
- MusicBrainz stores ISRCs and allows lookup by ISRC.

### Platform-Specific Identifiers

| Platform | Identifier | Example |
|---|---|---|
| **Spotify** | Spotify URI / ID | `spotify:track:6rqhFgbbKwnb9MLmUQDhG6` |
| **MusicBrainz** | MBID (UUID) | `b1a9c0e9-d987-4042-ae91-78d6a3267d69` |
| **Last.fm** | URL-based (artist + track name) | No stable numeric ID; uses MBIDs when available |
| **Apple Music** | Apple Music ID | Numeric, e.g. `1440833098` |

### Cross-Referencing Between Services

```
Dropbox file (ID3 tags) ──→ ISRC, MBID (if tagged by Picard)
         │
         ├── MBID ──→ MusicBrainz ──→ ISRC (via recording lookup with inc=isrcs)
         ├── ISRC ──→ Spotify search (q=isrc:USRC17607839) ──→ Spotify URI
         ├── ISRC ──→ MusicBrainz search ──→ MBID ──→ more metadata
         └── artist + track name ──→ Last.fm ──→ similar tracks (with MBIDs)

Last.fm similar track ──→ MBID ──→ MusicBrainz ──→ ISRC ──→ Spotify / Dropbox match
Last.fm similar track ──→ artist + track name ──→ fuzzy match against Dropbox library
```

**Picard-tagged files typically contain these ID3 frames:**

- `MUSICBRAINZ_TRACKID` — Recording MBID
- `MUSICBRAINZ_ALBUMID` — Release MBID
- `MUSICBRAINZ_ARTISTID` — Artist MBID
- `MUSICBRAINZ_RELEASEGROUPID` — Release Group MBID
- `TSRC` (ID3v2) / `ISRC` (Vorbis comment) — ISRC code

---

## Last.fm API

**Base URL:** `https://ws.audioscrobbler.com/2.0/`

**Auth:** API key only (no user auth needed for read-only data). Get one at https://www.last.fm/api/account/create

**Rate limit:** 5 requests/second per API key (undocumented but widely reported). Use an identifiable `User-Agent` header.

**Response format:** XML by default; add `&format=json` for JSON.

### Endpoints Relevant to Radio

#### `track.getSimilar`

Returns tracks similar to a given track, based on Last.fm listener co-play data.

**Request:**
```
GET /2.0/?method=track.getsimilar
  &artist=Cher
  &track=Believe
  &api_key=YOUR_API_KEY
  &format=json
  &limit=30           # optional, max similar tracks to return
  &autocorrect=1      # optional, fix misspelled names
```

You can also use `&mbid=<recording_mbid>` instead of `artist` + `track`.

**Response (JSON):**
```json
{
  "similartracks": {
    "track": [
      {
        "name": "Ray of Light",
        "match": 0.54,
        "mbid": "",
        "url": "https://www.last.fm/music/Madonna/_/Ray+of+Light",
        "artist": {
          "name": "Madonna",
          "mbid": "79239441-bfd5-4981-a70c-55c3f15c1287",
          "url": "https://www.last.fm/music/Madonna"
        },
        "image": [ ... ]
      },
      ...
    ],
    "@attr": {
      "artist": "Cher"
    }
  }
}
```

Key fields per result:
- `name` — Track name
- `artist.name` — Artist name
- `artist.mbid` — Artist's MusicBrainz ID (usually populated)
- `mbid` — Track (recording) MusicBrainz ID (often empty for tracks — this is a known gap)
- `match` — Similarity score (0.0 to 1.0, higher = more similar)

**Important:** The track-level `mbid` field is frequently empty. The `artist.mbid` is more reliably present. For matching, you'll primarily use `artist.name` + `name`, supplemented by MusicBrainz lookups when MBIDs are available.

#### `artist.getSimilar`

Returns artists similar to a given artist.

**Request:**
```
GET /2.0/?method=artist.getsimilar
  &artist=Radiohead
  &api_key=YOUR_API_KEY
  &format=json
  &limit=20
```

Also accepts `&mbid=<artist_mbid>` instead of `artist`.

**Response (JSON):**
```json
{
  "similarartists": {
    "artist": [
      {
        "name": "Thom Yorke",
        "mbid": "8ed2e0b3-aa4c-4e13-bec3-dc7393ed4d6b",
        "match": 0.87,
        "url": "https://www.last.fm/music/Thom+Yorke",
        "image": [ ... ]
      },
      ...
    ]
  }
}
```

#### `artist.getTopTracks`

Useful for turning an artist radio seed into actual tracks. Returns the most popular tracks for an artist.

**Request:**
```
GET /2.0/?method=artist.gettoptracks
  &artist=Radiohead
  &api_key=YOUR_API_KEY
  &format=json
  &limit=10
```

**Response:** Array of tracks with `name`, `mbid`, `playcount`, `listeners`, `artist` info.

#### `track.getInfo`

Get detailed metadata for a single track. Useful for enriching results.

**Request:**
```
GET /2.0/?method=track.getinfo
  &artist=Radiohead
  &track=Creep
  &api_key=YOUR_API_KEY
  &format=json
```

**Response includes:** `name`, `mbid`, `duration`, `listeners`, `playcount`, `toptags`, `album` info.

#### `album.getInfo`

Get tracks for an album. Useful when the radio seed is an album — you can get all tracks, then call `track.getSimilar` on some/all of them.

**Request:**
```
GET /2.0/?method=album.getinfo
  &artist=Radiohead
  &album=OK Computer
  &api_key=YOUR_API_KEY
  &format=json
```

**Response includes:** `tracks.track[]` with name and duration for each track on the album.

### Other Useful Endpoints

| Endpoint | Purpose |
|---|---|
| `tag.getTopTracks` | Get popular tracks for a genre tag (e.g., "shoegaze") |
| `tag.getSimilar` | Find related genre tags |
| `artist.getTopAlbums` | Get an artist's albums ranked by popularity |
| `track.search` | Search tracks by name |
| `artist.search` | Search artists by name |
| `artist.getCorrection` | Fix misspelled artist names to canonical forms |

### Last.fm API Limitations

- **No ISRC data.** Last.fm does not return ISRCs in any endpoint. You get MBIDs (sometimes) and names.
- **Track MBIDs often empty.** Artist MBIDs are much more reliable.
- **Image URLs are mostly broken.** Last.fm stopped serving artist/album images years ago; most return a placeholder. Don't rely on these.
- **Similarity is co-listen based.** It reflects what listeners play together, not audio similarity. Tends toward popularity bias for mainstream artists and can be sparse for niche/obscure music.
- **No album-level similarity.** There's no `album.getSimilar`. To do album radio, get the album's tracks and aggregate `track.getSimilar` results.

---

## MusicBrainz API

**Base URL:** `https://musicbrainz.org/ws/2/`

**Auth:** None required for reads. Must include a `User-Agent` header identifying your app (e.g., `VorbisPlayer/1.0 (your@email.com)`).

**Rate limit:** 1 request/second (strictly enforced). Exceeding this gets you temporarily blocked. Plan for this in your architecture.

**Response format:** XML by default; add `?fmt=json` for JSON.

### Core Concepts

MusicBrainz organizes music data into these entity types:

| Entity | What it represents | Example |
|---|---|---|
| **Recording** | A unique recorded performance | "Creep" by Radiohead (the specific 1992 recording) |
| **Release** | A specific issued product | "Pablo Honey" (UK CD release) |
| **Release Group** | All editions of an album | "Pablo Honey" (all formats/countries combined) |
| **Artist** | A performer or group | Radiohead |
| **Work** | An abstract composition | The song "Creep" as a musical work |

Each entity has a permanent UUID called an **MBID**.

### Lookup by MBID

When you have an MBID (from a Picard-tagged file or from Last.fm), you can look up full details.

**Recording lookup (with ISRCs):**
```
GET /ws/2/recording/{mbid}?inc=isrcs+artist-credits+releases&fmt=json
```

**Example:**
```
GET /ws/2/recording/b9ad642e-b012-41c7-b72a-42cf4911f9ff?inc=isrcs+artist-credits&fmt=json
```

**Response:**
```json
{
  "id": "b9ad642e-b012-41c7-b72a-42cf4911f9ff",
  "title": "LAST ANGEL",
  "length": 230000,
  "artist-credit": [
    {
      "artist": {
        "id": "455641ea-fff4-49f6-8fb4-49f961d8f1ac",
        "name": "倖田來未",
        "sort-name": "Koda, Kumi"
      },
      "joinphrase": " feat. "
    },
    ...
  ],
  "isrcs": ["JPB600760301"]
}
```

**Artist lookup:**
```
GET /ws/2/artist/{mbid}?fmt=json
```

### Lookup by ISRC

Find recordings associated with an ISRC. Returns a list (ISRCs can map to multiple recordings due to duplicates or re-releases).

```
GET /ws/2/recording/?query=isrc:GBAHT1600302&fmt=json
```

Or using the dedicated ISRC endpoint:
```
GET /ws/2/isrc/GBAHT1600302?inc=artist-credits+releases&fmt=json
```

### Search by Name

When you don't have an MBID, search by text:

**Recording search:**
```
GET /ws/2/recording/?query=recording:"Creep" AND artist:"Radiohead"&fmt=json&limit=5
```

**Artist search:**
```
GET /ws/2/artist/?query=artist:"Radiohead"&fmt=json&limit=5
```

### Available `inc=` Parameters

For recordings: `artist-credits`, `isrcs`, `releases`, `release-groups`, `tags`, `ratings`, `aliases`

For releases: `artist-credits`, `labels`, `recordings`, `release-groups`, `media`, `discids`, `isrcs` (requires `recordings`)

For artists: `recordings`, `releases`, `release-groups`, `works`, `aliases`, `tags`, `ratings`

### MusicBrainz API Limitations

- **1 request/second rate limit.** This is the biggest constraint. You cannot burst requests. Plan caching and batch strategies accordingly.
- **Browse results capped at 25 by default** (max 100 with `limit=100`). Use `offset` for pagination.
- **Search requires specific syntax.** Use Lucene-style query syntax with field names.
- **No similarity/recommendation data.** MusicBrainz is a metadata database, not a recommendation engine. It tells you *what* a recording is, not what's similar to it.

---

## How the APIs Complement Each Other

| Need | Use |
|---|---|
| "Find tracks similar to X" | **Last.fm** `track.getSimilar` |
| "Find artists similar to X" | **Last.fm** `artist.getSimilar` |
| "Get the ISRC for this MBID" | **MusicBrainz** recording lookup with `inc=isrcs` |
| "Get the MBID for this ISRC" | **MusicBrainz** ISRC lookup |
| "Resolve this Last.fm result to a Spotify track" | Last.fm → (artist + track name) → Spotify Search API |
| "Resolve this Last.fm result to a Dropbox file" | Last.fm → MBID → MusicBrainz → ISRC → match against file tags; OR fuzzy match on artist + track name |
| "Get genre tags for a track" | **Last.fm** `track.getTopTags` or **MusicBrainz** tags |
| "Correct a misspelled artist name" | **Last.fm** `artist.getCorrection` |

---

## Practical Matching Strategy for Vorbis Player

### Spotify Provider Radio Flow

```
1. Seed track/artist/album from Spotify playback context
   └── You already have Spotify ID, track name, artist name

2. Call Last.fm track.getSimilar (or artist.getSimilar + artist.getTopTracks)
   └── Returns: list of (artist_name, track_name, match_score, ?mbid)

3. For each similar track, find it on Spotify:
   └── Spotify Search: GET /search?q=track:{name} artist:{artist}&type=track&limit=1
   └── Verify match: compare names (normalized) and artist names

4. Queue matched Spotify URIs for playback via Web Playback SDK
```

### Dropbox Provider Radio Flow

```
1. Seed track from Dropbox playback context
   └── You have: track name, artist name, and (from Picard tags) MBID + ISRC

2. Call Last.fm track.getSimilar using artist + track name (or mbid if available)
   └── Returns: list of (artist_name, track_name, match_score, ?mbid)

3. For each similar track, match against local Dropbox library:
   a. If similar track has MBID → match against MUSICBRAINZ_TRACKID in your catalog
   b. If no MBID match → match against ISRC:
      - Look up MBID in MusicBrainz → get ISRC → match against file ISRCs
      (⚠️ Slow due to 1 req/sec rate limit — cache aggressively)
   c. Fallback → normalized fuzzy match on (artist_name, track_name)

4. Queue matched Dropbox files for playback via HTML5 Audio
```

### Name Normalization for Fuzzy Matching

When matching by name (the most common fallback), normalize both sides:

- Lowercase everything
- Strip parenthetical suffixes: "(Remastered)", "(Deluxe Edition)", "(feat. X)"
- Strip common suffixes: "- Single", "- EP"
- Normalize unicode (NFD decomposition, strip accents)
- Collapse whitespace
- Optionally: Levenshtein distance threshold for close-but-not-exact matches

---

## Rate Limit Budget & Caching Recommendations

| Service | Rate Limit | Strategy |
|---|---|---|
| **Last.fm** | ~5 req/sec | Comfortable for real-time. Cache similar tracks by (artist, track) key. |
| **MusicBrainz** | 1 req/sec | Cache aggressively. Build a local MBID→ISRC map at library scan time. Avoid real-time lookups during radio playback if possible. |
| **Spotify Search** | ~30 req/sec (varies) | Comfortable for real-time. Cache search results. |

**Recommended:** When the Dropbox library is first scanned, extract all MBIDs from file tags and batch-resolve them to ISRCs via MusicBrainz (respecting rate limits). Store this mapping in IndexedDB alongside your existing catalog cache. Then radio matching against the local library becomes instant — no MusicBrainz calls needed at radio time.

---

## NPM Packages Worth Knowing

| Package | Purpose |
|---|---|
| [`last-fm`](https://www.npmjs.com/package/last-fm) | Lightweight Last.fm client for public (read-only) data. No auth needed. |
| [`musicbrainz-api`](https://www.npmjs.com/package/musicbrainz-api) | Full MusicBrainz client with TypeScript types, rate limiting, and ISRC submission support. |

Both are well-suited for a TypeScript + React project. The `last-fm` package is callback-based (could be wrapped in promises), while `musicbrainz-api` is promise-based and includes built-in throttling for the 1 req/sec limit.
