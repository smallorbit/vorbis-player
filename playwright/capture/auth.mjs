import { execFileSync } from 'node:child_process';

const CDP_PORT = 9222;
const APP_URL = 'http://127.0.0.1:3000';

console.log(`Launching Chrome with remote debugging on port ${CDP_PORT}...`);
console.log('Log in to Spotify and start playing a track.');
console.log('Leave this browser open, then run: npm run capture\n');

try {
  execFileSync('open', [
    '-na', 'Google Chrome',
    '--args',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=/tmp/vorbis-capture-chrome`,
    APP_URL,
  ]);
} catch {
  console.log(`Could not auto-launch Chrome. Start it manually with:`);
  console.log(`  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\`);
  console.log(`    --remote-debugging-port=${CDP_PORT} \\`);
  console.log(`    --user-data-dir=/tmp/vorbis-capture-chrome \\`);
  console.log(`    ${APP_URL}`);
}
