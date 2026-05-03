import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scenarios',
  testMatch: '*.capture.ts',
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'off',
  },
  webServer: {
    command: 'VITE_MOCK_PROVIDER=true npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'tablet',
      use: {
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
      },
    },
  ],
});
