import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, runFixture) => {
    await page.addInitScript(() => {
      localStorage.setItem('spotify_token', JSON.stringify({
        access_token: 'fake-e2e-token',
        expires_at: Date.now() + 3600 * 1000,
        refresh_token: 'fake-refresh-token',
      }));
      localStorage.setItem('vorbis-player-active-provider', JSON.stringify('spotify'));
    });
    await runFixture(page);
  },
});

export { expect } from '@playwright/test';
