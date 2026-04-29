import { test as base, chromium, type Page } from '@playwright/test';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import dropboxSnapshot from '../fixtures/data/dropbox-snapshot.json' with { type: 'json' };

const APP_URL = 'http://127.0.0.1:3000';

function defaultPlaylistKey(): string {
  const first = spotifySnapshot.playlists?.[0];
  return first ? `spotify:playlist:${first.id}` : 'spotify:liked:';
}

// Snapshot-emptiness guard — see #1372 §10 "Curating fixtures".
//
// The snapshot JSONs ship as empty placeholders in the repo. Captures require
// real content: run `npm run snapshot:spotify -- --list` to enumerate your
// library, populate `snapshot.config.json`, then `npm run snapshot:spotify`
// to write the fixture. If the snapshots are still placeholder-empty, every
// scenario skips rather than timing out waiting for a player that never loads.
function hasSnapshotContent(): boolean {
  return (
    (spotifySnapshot.playlists?.length ?? 0) > 0 ||
    (spotifySnapshot.likedTrackIds?.length ?? 0) > 0 ||
    (dropboxSnapshot.albums?.length ?? 0) > 0
  );
}

export const test = base.extend<{ capturePage: Page }>({
  capturePage: async ({}, runFixture, testInfo) => {
    if (!hasSnapshotContent()) {
      testInfo.skip(
        true,
        'Capture scenarios skipped: spotify-snapshot.json has empty arrays. ' +
          'Run `npm run snapshot:spotify -- --list` to enumerate your library, ' +
          'populate `snapshot.config.json`, then `npm run snapshot:spotify` to write ' +
          'the fixture. See blueprint #1372 §10 ("Curating fixtures") for the workflow.',
      );
      return;
    }

    const playlist = process.env.PLAYLIST || defaultPlaylistKey();
    const headless = process.env.HEADLESS === '1';
    const viewport = testInfo.project.use.viewport as { width: number; height: number } | undefined;
    const dpr = (testInfo.project.use.deviceScaleFactor as number | undefined) ?? 2;

    const browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      viewport: { width: viewport?.width ?? 1440, height: viewport?.height ?? 900 },
      deviceScaleFactor: dpr,
    });
    const page = await context.newPage();
    await page.goto(`${APP_URL}?playlist=${encodeURIComponent(playlist)}`);
    await page.locator('button[title^="Zen Mode"]').waitFor({ state: 'visible', timeout: 30_000 });

    await runFixture(page);

    await page.close();
    await context.close();
    await browser.close();
  },
});

export { expect } from '@playwright/test';
