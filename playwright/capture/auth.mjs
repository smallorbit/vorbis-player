import { execFileSync } from 'node:child_process';
import { platform } from 'node:os';

const CDP_PORT = 9222;
const APP_URL = 'http://127.0.0.1:3000';
const USER_DATA_DIR = '/tmp/vorbis-capture-chrome';

const cdpFlags = [
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${USER_DATA_DIR}`,
  APP_URL,
];

console.log(`Launching Chrome with remote debugging on port ${CDP_PORT}...`);
console.log('Log in to Spotify and start playing a track.');
console.log('Leave this browser open, then run: npm run capture:cdp\n');

const os = platform();
let launched = false;

try {
  if (os === 'darwin') {
    execFileSync('open', ['-na', 'Google Chrome', '--args', ...cdpFlags]);
    launched = true;
  } else if (os === 'linux') {
    // Try common Chrome/Chromium binary names on Linux
    for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']) {
      try {
        execFileSync(bin, cdpFlags, { stdio: 'ignore' });
        launched = true;
        break;
      } catch { /* try next */ }
    }
  } else if (os === 'win32') {
    execFileSync('cmd', ['/c', 'start', 'chrome', ...cdpFlags]);
    launched = true;
  }
} catch { /* fall through to manual instructions */ }

if (!launched) {
  console.log('Could not auto-launch Chrome. Start it manually with:\n');
  if (os === 'darwin') {
    console.log('  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\');
  } else if (os === 'linux') {
    console.log('  google-chrome \\');
  } else {
    console.log('  chrome \\');
  }
  console.log(`    --remote-debugging-port=${CDP_PORT} \\`);
  console.log(`    --user-data-dir=${USER_DATA_DIR} \\`);
  console.log(`    ${APP_URL}`);
}
