// Records the Vorbis Player teaser against the mock provider.
// The awaken playlist is used because its eight albums carry 1600px art in the fixture
// (upgraded from the Cover Art Archive); other fixture albums are 300px.
// Usage: npm run demo:record -- <outDir>   (dev server must be running with VITE_MOCK_PROVIDER=true)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const OUT = process.argv[2];
// Viewport (and recording) size. Override with DEMO_WIDTH / DEMO_HEIGHT, e.g. 2560x1440.
const W = Number(process.env.DEMO_WIDTH) || 1920;
const H = Number(process.env.DEMO_HEIGHT) || 1080;
// DEMO_CAPTURE=playwright (default): Playwright's built-in 25fps VP8 screencast.
// DEMO_CAPTURE=x11: headful Chromium in kiosk mode on $DISPLAY (an Xvfb started by
// record-x11.sh), grabbed by ffmpeg at DEMO_FPS (default 60) into an h264 mp4.
const CAPTURE = process.env.DEMO_CAPTURE === 'x11' ? 'x11' : 'playwright';
const FPS = Number(process.env.DEMO_FPS) || 60;
const PLAYLIST = 'playlist_29c76609'; // awaken (one track per album, high-res fixture art)

const CURSOR_SCRIPT = `
(() => {
  const mk = () => {
    if (document.getElementById('__demo_cursor')) return;
    const c = document.createElement('div');
    c.id = '__demo_cursor';
    Object.assign(c.style, {
      position: 'fixed', left: '0px', top: '0px', width: '22px', height: '22px',
      pointerEvents: 'none', zIndex: '2147483647', transform: 'translate(-4px,-3px)',
      opacity: '0', transition: 'opacity 200ms',
    });
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 3l14 9-6.2 1.3L16 20l-2.6 1.1-3.2-6.6L5 18z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    const ring = document.createElement('div');
    ring.id = '__demo_ring';
    Object.assign(ring.style, {
      position: 'fixed', left: '0px', top: '0px', width: '36px', height: '36px',
      borderRadius: '50%', border: '2px solid rgba(255,255,255,0.9)', pointerEvents: 'none',
      zIndex: '2147483646', transform: 'translate(-18px,-18px) scale(0.2)', opacity: '0',
    });
    document.documentElement.appendChild(ring);
    document.documentElement.appendChild(c);
    window.addEventListener('mousemove', (e) => {
      c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; c.style.opacity = '1';
      ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
    }, true);
    window.addEventListener('mousedown', (e) => {
      ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
      ring.style.transition = 'none'; ring.style.opacity = '0.9';
      ring.style.transform = 'translate(-18px,-18px) scale(0.3)';
      requestAnimationFrame(() => {
        ring.style.transition = 'transform 350ms ease-out, opacity 350ms ease-out';
        ring.style.opacity = '0'; ring.style.transform = 'translate(-18px,-18px) scale(1.4)';
      });
    }, true);
  };
  if (document.documentElement) mk(); else document.addEventListener('DOMContentLoaded', mk);
})();`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let cur = { x: W / 2, y: H / 2 };
const ease = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

async function glide(page, x, y, ms = 650) {
  // Time-based: each mouse.move round-trip can take 40-200ms while the canvas
  // visualizer is busy, so sample the eased path by wall clock instead of step count.
  const start = Date.now();
  const sx = cur.x, sy = cur.y;
  for (;;) {
    const el = Date.now() - start;
    const t = ease(Math.min(1, el / ms));
    await page.mouse.move(sx + (x - sx) * t, sy + (y - sy) * t);
    if (el >= ms) break;
  }
  cur = { x, y };
}
async function glideTo(page, locator, ms = 650, dx = 0, dy = 0) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('no box for ' + locator);
  await glide(page, b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, ms);
}
async function click(page, locator, { ms = 650, settle = 400, dx = 0, dy = 0 } = {}) {
  await glideTo(page, locator, ms, dx, dy);
  await sleep(120);
  await page.mouse.down(); await sleep(70); await page.mouse.up();
  await sleep(settle);
}

const marks = [];
let t0 = Date.now();
const mark = (label) => { marks.push({ label, t: (Date.now() - t0) / 1000 }); console.log(`[${((Date.now() - t0) / 1000).toFixed(2)}s] ${label}`); };

let ffmpeg = null;
const browser = CAPTURE === 'x11'
  ? await chromium.launch({
      headless: false,
      ignoreDefaultArgs: ['--enable-automation'],
      args: ['--kiosk', `--window-size=${W},${H}`, '--window-position=0,0', '--disable-infobars', '--hide-scrollbars'],
    })
  : await chromium.launch();
const context = await browser.newContext(
  CAPTURE === 'x11'
    ? { viewport: null }
    : { viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: { width: W, height: H } } },
);
await context.addInitScript(CURSOR_SCRIPT);
const page = await context.newPage();
let capturePath = null;
if (CAPTURE === 'x11') {
  if (!process.env.DISPLAY) throw new Error('DEMO_CAPTURE=x11 needs DISPLAY (use scripts/demo/record-x11.sh)');
  capturePath = path.join(OUT, 'capture.mp4');
  // --kiosk is not honoured for Playwright-launched windows, so go fullscreen through CDP
  // and verify the page fills the virtual screen before the grabber starts.
  const cdp = await context.newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } });
  // Chromium reports the fullscreen window one pixel short of the Xvfb screen (1919x1079 on a
  // 1920x1080 display); the grabber still captures the full screen, so allow that slack.
  await page.waitForFunction(([w, h]) => Math.abs(window.innerWidth - w) <= 2 && Math.abs(window.innerHeight - h) <= 2, [W, H], { timeout: 10_000 });
  ffmpeg = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'x11grab', '-framerate', String(FPS), '-video_size', `${W}x${H}`, '-draw_mouse', '0', '-i', process.env.DISPLAY,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16', '-pix_fmt', 'yuv420p', capturePath,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  t0 = Date.now();
  await sleep(1000); // let the grabber settle before the first scene
}
mark('context ready');

await page.goto('http://127.0.0.1:3000/?provider=mock');
await page.getByRole('button', { name: 'Browse your library' }).waitFor();
await page.mouse.move(W * 0.62, H * 0.72); cur = { x: W * 0.62, y: H * 0.72 };
mark('welcome visible');
await sleep(1600);

// 1. Welcome -> library
await click(page, page.getByRole('button', { name: 'Browse your library' }), { ms: 700, settle: 900 });
mark('library home');
await page.locator(`[data-testid="library-card-playlist-${PLAYLIST}"]`).waitFor();
await sleep(400);
// drift across a few playlist cards
await glideTo(page, page.locator('[data-testid="library-card-playlist-playlist_c14591a5"]'), 700);
await sleep(350);
await glideTo(page, page.locator('[data-testid="library-card-playlist-playlist_fc231ac6"]'), 900);
await sleep(350);
await click(page, page.locator(`[data-testid="library-card-playlist-${PLAYLIST}"]`), { ms: 700, settle: 300 });
mark('playlist clicked');

// 2. Player with fireflies
await page.locator('button[title^="Zen Mode"]').waitFor();
await page.locator('[data-testid="player-track-info-name"]').waitFor();
mark('player ready');
await glide(page, W * 0.78, H * 0.5, 900);
await sleep(3200);
await click(page, page.getByRole('button', { name: 'Next track' }), { ms: 800, settle: 200 });
mark('next track');
await glide(page, W * 0.22, H * 0.55, 900);
await sleep(2800);

// 3. Visualizer cycling via the flip menu
const art = () => page.locator('[data-testid="player-track-info-name"]').first();
async function switchStyle(name, hold) {
  const trackName = (await art().textContent())?.trim() ?? '';
  const img = page.locator(`img[alt="${trackName}"]`).first();
  await click(page, img, { ms: 750, settle: 900 });
  const chip = page.getByRole('radio', { name, exact: true }).or(page.getByRole('button', { name, exact: true })).first();
  await click(page, chip, { ms: 600, settle: 600 });
  mark(`style ${name}`);
  await click(page, page.getByRole('button', { name: 'Close menu' }), { ms: 600, settle: 700 });
  await glide(page, W * (0.2 + Math.random() * 0.1), H * 0.5, 900);
  await sleep(hold);
}
// Grid before Wave so zen mode (and the README GIF cut) runs on the smooth Wave band,
// which compresses far better as GIF than the moving dot grid.
await switchStyle('Comet', 3200);
await switchStyle('Grid', 3200);
await switchStyle('Wave', 3200);

// 4. Zen mode
await click(page, page.locator('button[title="Zen Mode OFF"]'), { ms: 900, settle: 300 });
mark('zen on');
await glide(page, W - 4, H * 0.42, 500); // park cursor at the right edge, clear of the art and bottom bar
await page.evaluate(() => { const c = document.getElementById('__demo_cursor'); if (c) c.style.opacity = '0'; });
await sleep(3000);
await page.keyboard.press('ArrowRight');
mark('zen next track');
await sleep(3800);
await page.keyboard.press('Escape');
mark('zen off');
await sleep(2400);
mark('end');

let videoPath = capturePath;
if (CAPTURE === 'playwright') videoPath = await page.video().path();
await page.close();
await context.close();
await browser.close();
if (ffmpeg) {
  await new Promise((resolve) => { ffmpeg.on('exit', resolve); ffmpeg.stdin.write('q'); ffmpeg.stdin.end(); });
}
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ videoPath, capture: CAPTURE, fps: CAPTURE === 'x11' ? FPS : 25, width: W, height: H, marks }, null, 2));
console.log('video:', videoPath);
