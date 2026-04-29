/**
 * Dropbox snapshot generator — writes playwright/fixtures/data/dropbox-snapshot.json
 * from a real Dropbox library.
 *
 * Usage:
 *   npm run snapshot:dropbox           # real run (requires populated snapshot.config.json)
 *   npm run snapshot:dropbox -- --list # enumerate your library (read-only)
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
} from '../playwright/fixtures/data/snapshot.types.ts';

import { loadSnapshotConfig, isDropboxConfigEmpty, EMPTY_CONFIG_HINT } from './snapshot/load-config.ts';
import { loadOrInitSeed, SeedFreshlyCreatedError } from './snapshot/seed-store.ts';
import { createAnonymizationContext, hashId, SCRUBBED } from './snapshot/anonymize.ts';
import { sortKeysDeep } from './snapshot/sort-keys.ts';
import { assertNoTokenLeak } from './snapshot/leak-guard.ts';
import { getDropboxAccessToken } from './snapshot/auth-dropbox.ts';
import { createDropboxApiClient } from './snapshot/dropbox-api.ts';
import type { DropboxFolderEntry } from './snapshot/dropbox-api.ts';
import { runListDropbox } from './snapshot/list-dropbox.ts';

const APP_URL = 'http://127.0.0.1:3000';
const CONFIG_PATH = resolve('playwright/fixtures/data/snapshot.config.json');
const SEED_PATH = resolve('scripts/snapshot/seed.json');
const OUTPUT_PATH = resolve('playwright/fixtures/data/dropbox-snapshot.json');

const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.ogg', '.m4a', '.wav', '.aac', '.wma', '.opus'];
const PERSONAL_NAME_RE = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;

function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function parentDir(pathLower: string): string {
  const idx = pathLower.lastIndexOf('/');
  return idx <= 0 ? '/' : pathLower.slice(0, idx);
}

function warnPersonalName(field: string, value: string): void {
  if (PERSONAL_NAME_RE.test(value)) {
    process.stderr.write(
      `[WARN] Possible personal name in ${field}: "${value}" — review before committing.\n`,
    );
  }
}

interface SavedPlaylistJson {
  name?: string;
  tracks?: string[];
}

async function checkDevServer(): Promise<void> {
  try {
    await fetch(APP_URL, { signal: AbortSignal.timeout(3000) });
  } catch {
    console.error(`\n  Dev server not running at ${APP_URL}`);
    console.error('  Start it first:  npm run dev  (separate terminal)\n');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main flows
// ---------------------------------------------------------------------------

async function runList(): Promise<void> {
  await checkDevServer();
  const { accessToken } = await getDropboxAccessToken({ appUrl: APP_URL });
  const client = createDropboxApiClient(accessToken);
  await runListDropbox(client);
}

async function runSnapshot(): Promise<void> {
  const config = loadSnapshotConfig(CONFIG_PATH);
  const dropboxCfg = config.dropbox;

  if (!dropboxCfg.enabled) {
    console.log('Provider dropbox disabled in config; nothing to do.');
    process.exit(0);
  }

  if (isDropboxConfigEmpty(dropboxCfg)) {
    console.error(EMPTY_CONFIG_HINT);
    process.exit(1);
  }

  const seed = loadOrInitSeed(SEED_PATH);
  const anon = createAnonymizationContext(seed.anonymizationSeed);

  await checkDevServer();

  const { accessToken } = await getDropboxAccessToken({ appUrl: APP_URL });
  const client = createDropboxApiClient(accessToken);

  const account = await client.getCurrentAccount();
  const user = {
    displayName: SCRUBBED.DISPLAY_NAME,
    hashedId: hashId(seed.anonymizationSeed, 'user', account.account_id),
  };

  const tracks: Record<string, SnapshotTrack> = {};
  const playlists: SnapshotPlaylist[] = [];
  const albums: SnapshotAlbum[] = [];
  const likedTrackIds: string[] = [];

  let skippedUnsupportedFormat = 0;
  let fieldsScrubbedCount = 1; // user.account_id

  // Folders → albums
  for (const folderPath of dropboxCfg.folderPaths) {
    const allEntries = await client.listFolderRecursive(folderPath);

    // Group audio files by their parent directory
    const audioByDir = new Map<string, DropboxFolderEntry[]>();
    for (const entry of allEntries) {
      if (entry['.tag'] !== 'file') continue;
      if (!isAudioFile(entry.name)) {
        const lower = entry.name.toLowerCase();
        const hasExt = lower.lastIndexOf('.') > lower.lastIndexOf('/');
        if (hasExt) skippedUnsupportedFormat += 1;
        continue;
      }
      const dir = parentDir(entry.path_lower);
      const existing = audioByDir.get(dir) ?? [];
      existing.push(entry);
      audioByDir.set(dir, existing);
    }

    for (const [dir, audioEntries] of audioByDir) {
      const cappedEntries = audioEntries.slice(0, dropboxCfg.trackLimitPerFolder);
      const albumName = dir.split('/').filter(Boolean).pop() ?? dir;

      warnPersonalName('dropbox.folder', dir);

      const trackIds: string[] = [];
      let trackNum = 1;
      for (const entry of cappedEntries) {
        const track: SnapshotTrack = {
          id: entry.path_lower,
          name: entry.name.replace(/\.[^.]+$/, ''),
          artists: [],
          artistsDisplay: '',
          album: { id: dir, name: albumName },
          durationMs: 0,
          trackNumber: trackNum++,
          ref: entry.path_lower,
        };
        if (!tracks[track.id]) tracks[track.id] = track;
        trackIds.push(track.id);
      }

      const album: SnapshotAlbum = {
        id: dir,
        name: albumName,
        artists: [],
        trackCount: audioEntries.length,
        trackIds,
      };
      albums.push(album);
    }
  }

  // Saved playlist files
  for (const playlistPath of dropboxCfg.savedPlaylistPaths) {
    let fileBuffer: Buffer;
    try {
      fileBuffer = await client.downloadFile(playlistPath);
    } catch (err) {
      process.stderr.write(`[WARN] Could not download playlist file ${playlistPath}: ${String(err)}\n`);
      continue;
    }

    let parsed: SavedPlaylistJson;
    try {
      parsed = JSON.parse(fileBuffer.toString('utf-8')) as SavedPlaylistJson;
    } catch {
      process.stderr.write(`[WARN] Could not parse playlist file ${playlistPath} as JSON — skipping.\n`);
      continue;
    }

    if (!parsed.name || !Array.isArray(parsed.tracks)) {
      process.stderr.write(`[WARN] Playlist file ${playlistPath} does not match expected shape — skipping.\n`);
      continue;
    }

    const anonymizedId = anon.anonymizePlaylistId(playlistPath);
    const anonymizedName = anon.nextPlaylistName();
    fieldsScrubbedCount += 2; // playlist id + name

    // Populate trackIds from the JSON's tracks array, cross-referencing the global tracks map.
    const trackIds = parsed.tracks.filter((id) => {
      if (typeof id !== 'string') return false;
      if (!tracks[id]) {
        process.stderr.write(`[INFO] Playlist ${playlistPath} references track ${id} not in captured folders — skipping track.\n`);
        return false;
      }
      return true;
    });

    playlists.push({
      id: anonymizedId,
      name: anonymizedName,
      description: SCRUBBED.EMPTY_STRING,
      ownerName: SCRUBBED.DISPLAY_NAME,
      trackCount: parsed.tracks.length,
      revision: null,
      trackIds,
    });
  }

  // Liked tracks
  if (dropboxCfg.likesFilePath) {
    try {
      const likesBuffer = await client.downloadFile(dropboxCfg.likesFilePath);
      const likesData = JSON.parse(likesBuffer.toString('utf-8')) as unknown;
      if (Array.isArray(likesData)) {
        const limited = (likesData as string[]).slice(0, dropboxCfg.likedTracks.limit);
        for (const id of limited) {
          if (typeof id === 'string' && tracks[id]) {
            likedTrackIds.push(id);
          }
        }
      }
    } catch {
      process.stderr.write(
        `[INFO] Likes file not found or invalid at ${dropboxCfg.likesFilePath} — skipping.\n`,
      );
    }
  }

  // Pin remap
  const anonymizedPinPlaylistIds = dropboxCfg.pins.playlistIds
    .map((id) => {
      const mapped = anon.anonymizePlaylistId(id);
      if (!playlists.find((p) => p.id === mapped)) {
        process.stderr.write(`[WARN] Pin id ${id} not found in captured snapshot — removing.\n`);
        return null;
      }
      return mapped;
    })
    .filter((id): id is string => id !== null);

  const validPinAlbumIds = dropboxCfg.pins.albumIds.filter((id) => {
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
    provider: 'dropbox',
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

  assertProviderSnapshot(snapshot, 'dropbox');

  const sorted = sortKeysDeep(snapshot);
  const serialized = JSON.stringify(sorted, null, 2) + '\n';

  assertNoTokenLeak(serialized);

  writeFileSync(OUTPUT_PATH, serialized);

  console.log('\n  Snapshot written to', OUTPUT_PATH);
  console.log(`  Albums:    ${albums.length}`);
  console.log(`  Playlists: ${playlists.length}`);
  console.log(`  Tracks:    ${Object.keys(tracks).length}`);
  console.log(`  Liked:     ${likedTrackIds.length}`);
  console.log(`  Skipped:   ${skippedUnsupportedFormat} unsupported audio formats`);
  console.log(`  Scrubbed:  ${fieldsScrubbedCount} fields (playlist names/ids, user account_id)`);
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
