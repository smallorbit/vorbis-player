/**
 * Fixture preconditions for the e2e specs.
 *
 * These specs used to guard on `test.skip(!hasContent, ...)`, which turned an
 * empty snapshot into a green CI run: coverage could evaporate silently and did
 * (the Dropbox snapshot shipped empty for months, so every cross-provider spec
 * skipped). The guards below throw instead, so a missing or hollow fixture
 * fails the run loudly and names the command that repopulates it.
 */

type Provider = 'spotify' | 'dropbox';

interface FixtureTrack {
  id: string;
  name: string;
  durationMs: number;
}

interface FixtureCollection {
  id: string;
  name: string;
  trackIds: string[];
}

export interface FixtureSnapshot {
  tracks: Record<string, FixtureTrack>;
  playlists: FixtureCollection[];
  albums: FixtureCollection[];
}

export interface CollectionTarget {
  kind: 'playlist' | 'album';
  collection: FixtureCollection;
  trackName: string;
}

function regenerateHint(provider: Provider): string {
  if (provider === 'dropbox') {
    return (
      'playwright/fixtures/data/dropbox-snapshot.json is committed and synthetic — ' +
      'restore it from git, or regenerate a real one with `npm run snapshot:dropbox` ' +
      'after populating `folderPaths` in snapshot.config.json.'
    );
  }
  return (
    'Run `npm run snapshot:spotify -- --list` to enumerate your library, populate ' +
    'playwright/fixtures/data/snapshot.config.json, then `npm run snapshot:spotify`. ' +
    'See CLAUDE.md §"Curating fixtures".'
  );
}

function fail(provider: Provider, problem: string): never {
  throw new Error(
    `[fixture] ${provider}-snapshot.json ${problem}. ${regenerateHint(provider)}`,
  );
}

/** At least one playlist or album — the entry point every player spec needs. */
export function requireCollections(snapshot: FixtureSnapshot, provider: Provider): void {
  if (snapshot.playlists.length === 0 && snapshot.albums.length === 0) {
    fail(provider, 'has no playlists and no albums');
  }
}

export function requirePlaylist(snapshot: FixtureSnapshot, provider: Provider): FixtureCollection {
  const playlist = snapshot.playlists[0];
  if (!playlist) fail(provider, 'has no playlists');
  return playlist;
}

export function requireAlbum(snapshot: FixtureSnapshot, provider: Provider): FixtureCollection {
  const album = snapshot.albums[0];
  if (!album) fail(provider, 'has no albums');
  return album;
}

/**
 * A track long enough that a mid-track seek position stays inside its duration.
 * The hydrate and re-auth specs seed a 45s position and assert the seek bar
 * lands there, so anything shorter makes the assertion meaningless.
 */
export function requireLongTrack(
  snapshot: FixtureSnapshot,
  provider: Provider,
  minDurationMs = 60_000,
): FixtureTrack {
  const sorted = Object.entries(snapshot.tracks).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  for (const [, track] of sorted) {
    if (track.durationMs > minDurationMs) return track;
  }
  fail(provider, `has no track longer than ${minDurationMs}ms`);
}

/**
 * The first collection whose leading track resolves to a name in `tracks` —
 * what the CmdK specs open so the track is written through to the library cache.
 */
export function requireCollectionWithTrack(
  snapshot: FixtureSnapshot,
  provider: Provider,
): CollectionTarget {
  const candidates: Array<{ kind: 'playlist' | 'album'; collection: FixtureCollection }> = [
    ...snapshot.playlists.map((collection) => ({ kind: 'playlist' as const, collection })),
    ...snapshot.albums.map((collection) => ({ kind: 'album' as const, collection })),
  ];
  for (const candidate of candidates) {
    const trackId = candidate.collection.trackIds[0];
    const trackName = trackId ? snapshot.tracks[trackId]?.name : undefined;
    if (trackName) return { ...candidate, trackName };
  }
  fail(provider, 'has no collection whose first track resolves to a name');
}
