/**
 * Spotify snapshot generator — writes playwright/fixtures/data/spotify-snapshot.json
 * from a real Spotify library.
 *
 * Usage:
 *   npm run snapshot:spotify           # real run (requires populated snapshot.config.json)
 *   npm run snapshot:spotify -- --list # enumerate your library (read-only)
 *
 * ------------------------------------------------------------------
 * Curating fixtures
 *
 * Vorbis Player's Playwright tests run against committed JSON snapshots of a real
 * Spotify/Dropbox library. Because each user's library is different, you curate which
 * playlists/albums get captured before generating the snapshot.
 *
 * 1. **Enumerate** your library (read-only):
 *    npm run dev &
 *    npm run snapshot:spotify -- --list
 *    npm run snapshot:dropbox -- --list
 *    Each command logs you in interactively (Chromium pops up; log in once and press
 *    Enter when ready) and prints a list of available playlists / albums / folders
 *    with their IDs.
 *
 * 2. **Edit `playwright/fixtures/data/snapshot.config.json`** to include the IDs and
 *    folder paths you want to curate. Aim for a small, representative set — about
 *    5–10 playlists, a few saved albums, and the most-played folders. The committed
 *    file ships with empty arrays so you can populate from scratch.
 *
 * 3. **Generate the snapshot** (writes JSON + downloads art):
 *    npm run snapshot:spotify
 *    npm run snapshot:dropbox
 *    Personal data is anonymized automatically (display name, owner names, profile
 *    picture). Public catalog data (album/track/artist names, durations, ISRCs) is
 *    preserved verbatim.
 *
 * 4. **Review the diff** in `playwright/fixtures/data/*.json` and
 *    `public/playwright-fixtures/art/` and commit. The PR review is the human gate
 *    for any PII that slips past the automatic scrubber.
 *
 * Re-curate any time your library changes substantially. Re-running with the same
 * `scripts/snapshot/seed.json` produces deterministic diffs (only changed content
 * shows up).
 * ------------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { assertProviderSnapshot, SNAPSHOT_SCHEMA_VERSION } from '../playwright/fixtures/data/snapshot.types.ts';
import type {
  ProviderSnapshot,
  SnapshotMeta,
  SnapshotTrack,
  SnapshotPlaylist,
  SnapshotAlbum,
  SnapshotImage,
} from '../playwright/fixtures/data/snapshot.types.ts';

import { loadSnapshotConfig, isSpotifyConfigEmpty, EMPTY_CONFIG_HINT } from './snapshot/load-config.ts';
import { loadOrInitSeed, SeedFreshlyCreatedError } from './snapshot/seed-store.ts';
import { createAnonymizationContext, hashId, SCRUBBED } from './snapshot/anonymize.ts';
import { createArtDownloader } from './snapshot/art-downloader.ts';
import { sortKeysDeep } from './snapshot/sort-keys.ts';
import { assertNoTokenLeak } from './snapshot/leak-guard.ts';
import { getSpotifyAccessToken } from './snapshot/auth-spotify.ts';
import { createSpotifyApiClient } from './snapshot/spotify-api.ts';
import type { RawSpotifyTrack } from './snapshot/spotify-api.ts';
import { runListSpotify } from './snapshot/list-spotify.ts';

const APP_URL = 'http://127.0.0.1:3000';
const CONFIG_PATH = resolve('playwright/fixtures/data/snapshot.config.json');
const SEED_PATH = resolve('scripts/snapshot/seed.json');
const OUTPUT_PATH = resolve('playwright/fixtures/data/spotify-snapshot.json');
const ART_DIR = resolve('public/playwright-fixtures/art');

const PERSONAL_NAME_RE = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function checkDevServer(): Promise<void> {
  try {
    await fetch(APP_URL, { signal: AbortSignal.timeout(3000) });
  } catch {
    console.error(`\n  Dev server not running at ${APP_URL}`);
    console.error('  Start it first:  npm run dev  (separate terminal)\n');
    process.exit(1);
  }
}

function pickBestImage(
  images: Array<{ url: string; width: number | null; height: number | null }>,
): SnapshotImage | undefined {
  if (images.length === 0) return undefined;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const img = sorted[0];
  if (!img) return undefined;
  const result: SnapshotImage = { url: img.url };
  if (img.width != null) result.width = img.width;
  if (img.height != null) result.height = img.height;
  return result;
}

function trackFromRaw(raw: RawSpotifyTrack, artUrl: string | undefined): SnapshotTrack | null {
  if (!raw.track || !raw.track.id) return null;
  // After guard: raw.track.id is narrowed to string (non-null, non-empty).
  const trackId = raw.track.id;
  const t = raw.track;
  const track: SnapshotTrack = {
    id: trackId,
    name: t.name,
    artists: t.artists.map((a) => ({
      name: a.name,
      ...(a.external_urls.spotify ? { externalUrl: a.external_urls.spotify } : {}),
    })),
    artistsDisplay: t.artists.map((a) => a.name).join(', '),
    album: { id: t.album.id, name: t.album.name },
    durationMs: t.duration_ms,
    trackNumber: t.track_number,
    ref: t.uri,
    ...(t.external_urls.spotify ? { externalUrl: t.external_urls.spotify } : {}),
    ...(t.external_ids?.isrc ? { isrc: t.external_ids.isrc } : {}),
    ...(raw.added_at ? { addedAt: new Date(raw.added_at).getTime() } : {}),
  };
  if (artUrl) {
    track.image = { url: artUrl };
  }
  return track;
}

function warnPersonalName(field: string, value: string): void {
  if (PERSONAL_NAME_RE.test(value)) {
    process.stderr.write(
      `[WARN] Possible personal name in ${field}: "${value}" — review before committing.\n`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main flows
// ---------------------------------------------------------------------------

async function runList(): Promise<void> {
  await checkDevServer();
  const { accessToken } = await getSpotifyAccessToken({ appUrl: APP_URL });
  const client = createSpotifyApiClient(accessToken);
  await runListSpotify(client);
}

async function runSnapshot(): Promise<void> {
  const config = loadSnapshotConfig(CONFIG_PATH);
  const spotifyCfg = config.spotify;

  if (!spotifyCfg.enabled) {
    console.log('Provider spotify disabled in config; nothing to do.');
    process.exit(0);
  }

  if (isSpotifyConfigEmpty(spotifyCfg)) {
    console.error(EMPTY_CONFIG_HINT);
    process.exit(1);
  }

  const seed = loadOrInitSeed(SEED_PATH);
  const anon = createAnonymizationContext(seed.anonymizationSeed);

  await checkDevServer();

  const { accessToken } = await getSpotifyAccessToken({ appUrl: APP_URL });
  const client = createSpotifyApiClient(accessToken);
  const art = createArtDownloader(ART_DIR, seed.anonymizationSeed);

  const me = await client.getMe();
  const user = {
    displayName: SCRUBBED.DISPLAY_NAME,
    hashedId: hashId(seed.anonymizationSeed, 'user', me.id),
  };

  const tracks: Record<string, SnapshotTrack> = {};
  const playlists: SnapshotPlaylist[] = [];
  const albums: SnapshotAlbum[] = [];
  const likedTrackIds: string[] = [];

  let skippedTracks = 0;
  let artDownloaded = 0;
  let artCached = 0;
  let fieldsScrubbedCount = 0;

  // 1 for user.id scrub
  fieldsScrubbedCount += 1;

  async function downloadArt(imageUrl: string): Promise<string> {
    const { url, cacheHit } = await art.download(imageUrl);
    if (cacheHit) {
      artCached += 1;
    } else {
      artDownloaded += 1;
    }
    return url;
  }

  // Playlists
  for (const playlistId of spotifyCfg.playlistIds) {
    const playlistData = await client.getPlaylist(playlistId);
    const trackItems = await client.getPlaylistTracks(playlistId, spotifyCfg.playlistTrackLimit);

    const anonymizedId = anon.anonymizePlaylistId(playlistId);
    const anonymizedName = anon.nextPlaylistName();
    fieldsScrubbedCount += 2; // playlist id + name

    let playlistImage: SnapshotImage | undefined;
    const rawImage = pickBestImage(playlistData.images);
    if (rawImage) {
      const localUrl = await downloadArt(rawImage.url);
      playlistImage = {
        url: localUrl,
        ...(rawImage.width != null ? { width: rawImage.width, height: rawImage.height } : {}),
      };
    }

    warnPersonalName('playlist.owner.display_name', playlistData.owner.display_name ?? '');

    const trackIds: string[] = [];
    for (const item of trackItems) {
      if (!item.track || !item.track.id) {
        skippedTracks += 1;
        continue;
      }
      const albumImageRaw = pickBestImage(item.track.album.images);
      let artUrl: string | undefined;
      if (albumImageRaw) {
        artUrl = await downloadArt(albumImageRaw.url);
      }
      const track = trackFromRaw(item, artUrl);
      if (!track) {
        skippedTracks += 1;
        continue;
      }
      if (!tracks[track.id]) {
        tracks[track.id] = track;
      }
      trackIds.push(track.id);
    }

    playlists.push({
      id: anonymizedId,
      name: anonymizedName,
      description: SCRUBBED.EMPTY_STRING,
      ownerName: SCRUBBED.DISPLAY_NAME,
      trackCount: playlistData.tracks.total,
      revision: playlistData.snapshot_id ?? null,
      trackIds,
      ...(playlistImage ? { image: playlistImage } : {}),
    });
  }

  // Albums
  for (const albumId of spotifyCfg.albumIds) {
    const albumData = await client.getAlbum(albumId);

    const albumImageRaw = pickBestImage(albumData.images);
    let albumImage: SnapshotImage | undefined;
    if (albumImageRaw) {
      const localUrl = await downloadArt(albumImageRaw.url);
      albumImage = {
        url: localUrl,
        ...(albumImageRaw.width != null ? { width: albumImageRaw.width, height: albumImageRaw.height } : {}),
      };
    }

    warnPersonalName('album.name', albumData.name);

    const trackIds: string[] = [];
    for (const t of albumData.tracks.items) {
      const track: SnapshotTrack = {
        id: t.id,
        name: t.name,
        artists: t.artists.map((a) => ({ name: a.name })),
        artistsDisplay: t.artists.map((a) => a.name).join(', '),
        album: { id: albumData.id, name: albumData.name },
        durationMs: t.duration_ms,
        trackNumber: t.track_number,
        ref: t.uri,
        ...(t.external_ids?.isrc ? { isrc: t.external_ids.isrc } : {}),
        ...(albumImage ? { image: albumImage } : {}),
      };
      if (!tracks[track.id]) tracks[track.id] = track;
      trackIds.push(track.id);
    }

    albums.push({
      id: albumData.id,
      name: albumData.name,
      artists: albumData.artists.map((a) => ({ name: a.name })),
      trackCount: albumData.total_tracks,
      trackIds,
      ...(albumData.release_date ? { releaseDate: albumData.release_date } : {}),
      ...(albumData.genres.length > 0 ? { genres: albumData.genres } : {}),
      ...(albumImage ? { image: albumImage } : {}),
    });
  }

  // Liked tracks
  const likedItems = await client.getLikedTracks(spotifyCfg.likedTracks.limit);
  for (const item of likedItems) {
    if (!item.track || !item.track.id) {
      skippedTracks += 1;
      continue;
    }
    const albumImageRaw = pickBestImage(item.track.album.images);
    let artUrl: string | undefined;
    if (albumImageRaw) {
      artUrl = await downloadArt(albumImageRaw.url);
    }
    const track = trackFromRaw(item, artUrl);
    if (!track) {
      skippedTracks += 1;
      continue;
    }
    if (!tracks[track.id]) tracks[track.id] = track;
    likedTrackIds.push(track.id);
  }

  // Pin remap (D17): original playlist IDs → anonymized synthetic IDs
  const anonymizedPinPlaylistIds = spotifyCfg.pins.playlistIds
    .map((id) => {
      const mapped = anon.anonymizePlaylistId(id);
      if (!playlists.find((p) => p.id === mapped)) {
        process.stderr.write(`[WARN] Pin id ${id} not found in captured snapshot — removing.\n`);
        return null;
      }
      return mapped;
    })
    .filter((id): id is string => id !== null);

  // Album pins: kept verbatim since album IDs are public catalog data
  const validPinAlbumIds = spotifyCfg.pins.albumIds.filter((id) => {
    const found = albums.find((a) => a.id === id);
    if (!found) {
      process.stderr.write(`[WARN] Pin album id ${id} not found in captured snapshot — removing.\n`);
    }
    return !!found;
  });

  const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf-8')) as { version: string };

  const meta: SnapshotMeta = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    generatorVersion: packageJson.version,
    provider: 'spotify',
    anonymizationSeed: seed.anonymizationSeed,
  };

  const snapshot: ProviderSnapshot = {
    meta,
    user,
    tracks,
    playlists,
    albums,
    likedTrackIds,
    pins: {
      playlistIds: anonymizedPinPlaylistIds,
      albumIds: validPinAlbumIds,
    },
  };

  assertProviderSnapshot(snapshot, 'spotify');

  const sorted = sortKeysDeep(snapshot);
  const serialized = JSON.stringify(sorted, null, 2) + '\n';

  assertNoTokenLeak(serialized);

  writeFileSync(OUTPUT_PATH, serialized);

  console.log('\n  Snapshot written to', OUTPUT_PATH);
  console.log(`  Playlists: ${playlists.length}`);
  console.log(`  Albums:    ${albums.length}`);
  console.log(`  Tracks:    ${Object.keys(tracks).length}`);
  console.log(`  Liked:     ${likedTrackIds.length}`);
  console.log(`  Skipped:   ${skippedTracks} null/local tracks`);
  console.log(`  Art:       ${artDownloaded} downloaded, ${artCached} cached`);
  console.log(`  Scrubbed:  ${fieldsScrubbedCount} fields (playlist ids/names, owner names, user id)`);
  console.log();
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isList = args.includes('--list');
  const hasOtherArgs = args.filter((a) => a !== '--list').length > 0;

  if (isList && hasOtherArgs) {
    console.error('Cannot combine --list with other args. Pick one.');
    process.exit(2);
  }

  try {
    if (isList) {
      await runList();
    } else {
      await runSnapshot();
    }
  } catch (err) {
    if (err instanceof SeedFreshlyCreatedError) {
      console.error('\n  ' + err.message + '\n');
      process.exit(1);
    }
    console.error(err);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
