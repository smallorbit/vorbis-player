import { test as base, chromium, type Page } from '@playwright/test';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };

const APP_URL = 'http://127.0.0.1:3000';

function defaultPlaylistKey(): string {
  const first = spotifySnapshot.playlists?.[0];
  return first ? `spotify:playlist:${first.id}` : 'spotify:liked:';
}

export const test = base.extend<{ capturePage: Page }>({
  capturePage: async (_fixtures, runFixture, testInfo) => {
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
