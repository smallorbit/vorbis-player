import { chromium } from '@playwright/test';
import readline from 'node:readline';

const SPOTIFY_TOKEN_KEY = 'spotify_token';

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
 * Opens Chromium, navigates to appUrl, prompts the user to log into Spotify,
 * then scrapes the access token from localStorage. Tokens are kept in memory only.
 */
export async function getSpotifyAccessToken(opts: {
  appUrl: string;
}): Promise<{ accessToken: string }> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(opts.appUrl);

    console.log('\n  Browser opened — log into Spotify.');
    console.log('  Once the player is loaded, come back here and press Enter.\n');

    await waitForEnter('  Press Enter when you are logged in and the player is ready... ');

    const stored = await page.evaluate((key: string) => localStorage.getItem(key), SPOTIFY_TOKEN_KEY);

    if (!stored) {
      throw new Error('No Spotify token found in localStorage. Did you complete the login?');
    }

    let tokenData: Record<string, unknown>;
    try {
      tokenData = JSON.parse(stored) as Record<string, unknown>;
    } catch {
      throw new Error('Spotify token in localStorage is not valid JSON.');
    }

    const accessToken = tokenData['access_token'];
    if (typeof accessToken !== 'string' || !accessToken) {
      throw new Error('Spotify token in localStorage has no access_token field.');
    }

    return { accessToken };
  } finally {
    await browser.close();
  }
}
