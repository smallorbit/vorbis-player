import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const APP_URL = 'http://127.0.0.1:3000';
const AUTH_STATE_PATH = path.resolve(import.meta.dirname, '.auth-state.json');

const AUTH_KEYS = [
  'spotify_token',
  'vorbis-player-active-provider',
  'vorbis-player-dropbox-token',
  'vorbis-player-dropbox-refresh-token',
  'vorbis-player-dropbox-token-expiry',
];

function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  // Check if dev server is running
  try {
    await fetch(APP_URL);
  } catch {
    console.error(`\n  Dev server not running at ${APP_URL}`);
    console.error('  Start it first:  npm run dev\n');
    process.exit(1);
  }

  console.log('\n  Opening browser — log into Spotify (and optionally Dropbox).');
  console.log('  Once the player is loaded, come back here and press Enter.\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(APP_URL);

  await waitForEnter('  Press Enter when you are logged in and the player is ready... ');

  // Extract auth-related localStorage entries
  const entries = await page.evaluate((keys: string[]) => {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val !== null) result[key] = val;
    }
    return result;
  }, AUTH_KEYS);

  await browser.close();

  if (Object.keys(entries).length === 0) {
    console.error('\n  No auth tokens found in localStorage. Did you log in?\n');
    process.exit(1);
  }

  const state = {
    savedAt: new Date().toISOString(),
    localStorage: entries,
  };

  fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify(state, null, 2) + '\n');

  console.log(`\n  Auth state saved to ${path.relative(process.cwd(), AUTH_STATE_PATH)}`);
  console.log('  Captured keys:');
  for (const key of Object.keys(entries)) {
    console.log(`    - ${key}`);
  }

  if (entries.spotify_token) {
    try {
      const token = JSON.parse(entries.spotify_token);
      if (token.expires_at) {
        const expiresAt = new Date(token.expires_at);
        console.log(`  Spotify access token expires: ${expiresAt.toLocaleString()}`);
        console.log('  (The app will auto-refresh using the refresh token.)');
      }
    } catch { /* ignore parse errors */ }
  }

  console.log('\n  Run screenshots with:  npm run capture\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
