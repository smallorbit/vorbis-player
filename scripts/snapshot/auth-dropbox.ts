import { chromium } from '@playwright/test';
import readline from 'node:readline';

const DROPBOX_TOKEN_KEY = 'vorbis-player-dropbox-token';

function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Opens Chromium, navigates to appUrl, prompts the user to log into Dropbox,
 * then scrapes the access token from localStorage. Tokens are kept in memory only.
 */
export async function getDropboxAccessToken(opts: {
  appUrl: string;
}): Promise<{ accessToken: string }> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(opts.appUrl);

    console.log('\n  Browser opened — log into Dropbox.');
    console.log('  Once the player is loaded, come back here and press Enter.\n');

    await waitForEnter('  Press Enter when you are logged in and the player is ready... ');

    const accessToken = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      DROPBOX_TOKEN_KEY,
    );

    if (!accessToken) {
      throw new Error('No Dropbox token found in localStorage. Did you complete the login?');
    }

    return { accessToken };
  } finally {
    await browser.close();
  }
}
