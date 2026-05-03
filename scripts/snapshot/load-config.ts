import { readFileSync } from 'node:fs';
import {
  SNAPSHOT_CONFIG_VERSION,
  type SnapshotConfig,
  type SpotifySnapshotConfig,
  type DropboxSnapshotConfig,
} from './types.ts';

export const EMPTY_CONFIG_HINT =
  'snapshot.config.json has no curated content. Run `npm run snapshot:spotify -- --list`\n' +
  '(and `npm run snapshot:dropbox -- --list`) to see what is available, then populate\n' +
  'snapshot.config.json with the IDs/paths you want to capture. Re-run this command\n' +
  '(without --list) to write the snapshot.';

export function loadSnapshotConfig(configPath: string): SnapshotConfig {
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Config file not found: ${configPath}\n` +
          'Run `cp playwright/fixtures/data/snapshot.config.json snapshot.config.json` and edit it,\n' +
          'or create playwright/fixtures/data/snapshot.config.json from the empty template.',
      );
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse ${configPath}: invalid JSON`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${configPath} must be a JSON object`);
  }
  const cfg = parsed as Record<string, unknown>;

  if (cfg['version'] !== SNAPSHOT_CONFIG_VERSION) {
    throw new Error(
      `Config version ${String(cfg['version'])} not supported by this tooling. Update tooling first.`,
    );
  }

  return parsed as SnapshotConfig;
}

export function isSpotifyConfigEmpty(cfg: SpotifySnapshotConfig): boolean {
  return (
    cfg.playlistIds.length === 0 &&
    cfg.albumIds.length === 0 &&
    cfg.pins.playlistIds.length === 0 &&
    cfg.pins.albumIds.length === 0
  );
}

export function isDropboxConfigEmpty(cfg: DropboxSnapshotConfig): boolean {
  return (
    cfg.folderPaths.length === 0 &&
    cfg.savedPlaylistPaths.length === 0 &&
    cfg.pins.playlistIds.length === 0 &&
    cfg.pins.albumIds.length === 0
  );
}
