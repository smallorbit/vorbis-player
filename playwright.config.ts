import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  // Tags decide which viewport a spec runs at. `isMobile` in usePlayerSizing
  // flips at 700px and swaps whole components (QueueBottomSheet vs QueueDrawer),
  // so a desktop-only run leaves the mobile surface unasserted.
  //   untagged       → desktop only (the default; right-click, CmdK, hover)
  //   @mobile-only   → mobile only (touch affordances, bottom sheet)
  //   @responsive    → both viewports
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@mobile-only/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      grep: /@mobile-only|@responsive/,
    },
  ],
  webServer: {
    // VITE_LASTFM_API_KEY only has to be present — isLastFmConfigured gates the
    // radio UI on its existence. Specs stub ws.audioscrobbler.com with
    // page.route, so this key is never sent anywhere.
    command: 'VITE_MOCK_PROVIDER=true VITE_LASTFM_API_KEY=e2e-stub-key npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
