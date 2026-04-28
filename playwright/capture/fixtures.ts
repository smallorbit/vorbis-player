import { test as base, chromium, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const APP_URL = 'http://127.0.0.1:3000';
const CDP_ENDPOINT = 'http://127.0.0.1:9222';
const AUTH_STATE_PATH = path.resolve(import.meta.dirname, '.auth-state.json');

/** Default Dropbox album used when no PLAYLIST env var is set. */
const DEFAULT_PLAYLIST = 'album:/andy timmons band/theme from a perfect world';

type AuthState = {
  savedAt: string;
  localStorage: Record<string, string>;
};

function loadAuthState(): AuthState | null {
  try {
    return JSON.parse(fs.readFileSync(AUTH_STATE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export const test = base.extend<{ capturePage: Page }>({
  capturePage: async (_fixtures, runFixture, testInfo) => {
    const playlist = process.env.PLAYLIST || DEFAULT_PLAYLIST;
    const useCdp = process.env.USE_CDP === '1';
    const headless = process.env.HEADLESS === '1';
    const authState = loadAuthState();

    const viewport = testInfo.project.use.viewport as { width: number; height: number } | undefined;
    const dpr = (testInfo.project.use.deviceScaleFactor as number | undefined) ?? 2;
    const width = viewport?.width ?? 1440;
    const height = viewport?.height ?? 900;

    let page: Page;
    let cleanup: () => Promise<void>;

    if (useCdp || !authState) {
      // --- CDP mode: connect to a running Chrome instance ---
      if (!authState && !useCdp) {
        console.warn(
          'No .auth-state.json found. Run "npm run capture:login" first,\n' +
          'or use "npm run capture:cdp" to connect to a running Chrome with CDP.',
        );
      }

      const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
      const context = browser.contexts()[0];

      page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: dpr,
        mobile: width < 700,
      });
      await page.goto(`${APP_URL}?playlist=${encodeURIComponent(playlist)}`);
      await page.locator('button[title^="Zen Mode"]').waitFor({ state: 'visible', timeout: 30_000 });

      cleanup = async () => {
        await cdp.send('Emulation.clearDeviceMetricsOverride');
        await cdp.detach();
        await page.close();
      };
    } else {
      // --- Standalone mode: launch browser with injected auth tokens ---
      const browser = await chromium.launch({ headless });
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: dpr,
      });

      await context.addInitScript((tokens: Record<string, string>) => {
        for (const [key, value] of Object.entries(tokens)) {
          localStorage.setItem(key, value);
        }
      }, authState.localStorage);

      page = await context.newPage();
      await page.goto(`${APP_URL}?playlist=${encodeURIComponent(playlist)}`);
      await page.locator('button[title^="Zen Mode"]').waitFor({ state: 'visible', timeout: 30_000 });

      cleanup = async () => {
        await page.close();
        await context.close();
        await browser.close();
      };
    }

    await runFixture(page);
    await cleanup();
  },
});

export { expect } from '@playwright/test';
