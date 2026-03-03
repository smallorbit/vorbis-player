import { test as base, chromium, type Page } from '@playwright/test';

const CDP_ENDPOINT = 'http://127.0.0.1:9222';

export const test = base.extend<{ capturePage: Page }>({
  capturePage: async ({}, use, testInfo) => {
    const playlist = process.env.PLAYLIST;
    const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    const context = browser.contexts()[0];

    const viewport = testInfo.project.use.viewport as { width: number; height: number } | undefined;
    const dpr = (testInfo.project.use.deviceScaleFactor as number | undefined) ?? 2;
    const width = viewport?.width ?? 1440;
    const height = viewport?.height ?? 900;

    let page: Page;
    let cdp;

    if (playlist) {
      page = await context.newPage();
      cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: dpr,
        mobile: width < 700,
      });
      await page.goto(`http://127.0.0.1:3000?playlist=${encodeURIComponent(playlist)}`);
      await page.locator('button[title^="Zen Mode"]').waitFor({ state: 'visible', timeout: 30_000 });
    } else {
      const pages = context.pages();
      page = pages.find(p => p.url().includes('127.0.0.1:3000')) ?? pages[0];
      cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: dpr,
        mobile: width < 700,
      });
      await page.waitForTimeout(500);
    }

    await use(page);

    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await cdp.detach();
    if (playlist) {
      await page.close();
    }
  },
});

export { expect } from '@playwright/test';
