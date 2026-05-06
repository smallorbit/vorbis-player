import { test as base, expect } from '@playwright/test';

// Mirrors WELCOME_SEEN_STORAGE_KEY in src/hooks/useWelcomeSeen.ts.
// useLocalStorage JSON-stringifies its values, so the persisted form is the
// literal string 'true'.
const WELCOME_SEEN_STORAGE_KEY = 'vorbis-player-welcome-seen';

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript((key: string) => {
      window.localStorage.setItem(key, 'true');
    }, WELCOME_SEEN_STORAGE_KEY);

    if (process.env.PW_DEBUG_CONSOLE) {
      context.on('page', (page) => {
        page.on('console', (msg) => {
          // eslint-disable-next-line no-console
          console.log(`[browser:${msg.type()}]`, msg.text());
        });
      });
    }

    await use(context);
  },
});

export { expect };
