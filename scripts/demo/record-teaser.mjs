// Records the Vorbis Player teaser against the mock provider.
// The awaken playlist is used because its eight albums carry 1600px art in the fixture
// (upgraded from the Cover Art Archive); other fixture albums are 300px.
// Usage: npm run demo:record -- <outDir>   (dev server must be running with VITE_MOCK_PROVIDER=true)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const OUT = process.argv[2];
if (!OUT) throw new Error('usage: record-teaser.mjs <outDir>');
fs.mkdirSync(OUT, { recursive: true });
// Viewport (and recording) size. Override with DEMO_WIDTH / DEMO_HEIGHT, e.g. 2560x1440.
// In screen-capture mode on macOS the fullscreen window takes the display's size instead,
// and these are updated after the window settles.
let W = Number(process.env.DEMO_WIDTH) || 1920;
let H = Number(process.env.DEMO_HEIGHT) || 1080;
// DEMO_CAPTURE=playwright (default): Playwright's built-in 25fps VP8 screencast.
// DEMO_CAPTURE=screen: headful Chromium forced fullscreen, grabbed by ffmpeg at DEMO_FPS
//   (default 60) into an h264 mp4. The grabber follows the platform:
//     linux  -> x11grab on $DISPLAY (record-x11.sh starts an Xvfb for it)
//     darwin -> avfoundation screen capture (record-mac.sh), hardware-encoded with
//               VideoToolbox; DEMO_SCREEN_DEVICE picks the avfoundation screen index
//               (auto-detected from "Capture screen 0" when unset).
// 'x11' is accepted as an alias of 'screen' for older invocations.
const CAPTURE = ['screen', 'x11'].includes(process.env.DEMO_CAPTURE ?? '') ? 'screen' : 'playwright';
const FPS = Number(process.env.DEMO_FPS) || 60;
const GRABBER = process.platform === 'darwin' ? 'avfoundation' : 'x11grab';
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

async function glide(page, x, y, ms = 650, gap = 0) {
  // Time-based: each mouse.move round-trip can take 40-200ms while the canvas
  // visualizer is busy, so sample the eased path by wall clock instead of step count.
  // `gap` throttles the mouse-move events (ms between them) for steps where the app is
  // already busy, e.g. the flip menu's 3D transition and the zen enter/exit animation.
  const start = Date.now();
  const sx = cur.x, sy = cur.y;
  for (;;) {
    const el = Date.now() - start;
    const t = ease(Math.min(1, el / ms));
    await page.mouse.move(sx + (x - sx) * t, sy + (y - sy) * t);
    if (el >= ms) break;
    if (gap) await sleep(gap);
  }
  cur = { x, y };
}
const CALM = 45; // mouse-move gap (ms) around the flip menu and zen mode, roughly 20 events/s
async function glideTo(page, locator, ms = 650, dx = 0, dy = 0, gap = 0) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('no box for ' + locator);
  await glide(page, b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, ms, gap);
}
async function click(page, locator, { ms = 650, settle = 400, dx = 0, dy = 0, gap = 0 } = {}) {
  await glideTo(page, locator, ms, dx, dy, gap);
  await sleep(120);
  await page.mouse.down(); await sleep(70); await page.mouse.up();
  await sleep(settle);
}

const marks = [];
let t0 = Date.now();
const mark = (label) => { marks.push({ label, t: (Date.now() - t0) / 1000 }); console.log(`[${((Date.now() - t0) / 1000).toFixed(2)}s] ${label}`); };

let ffmpeg = null;
const browser = CAPTURE === 'screen'
  ? await chromium.launch({
      headless: false,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [`--window-size=${W},${H}`, '--window-position=0,0', '--disable-infobars', '--hide-scrollbars'],
    })
  : await chromium.launch();
const context = await browser.newContext(
  CAPTURE === 'screen'
    ? { viewport: null }
    : { viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: { width: W, height: H } } },
);
await context.addInitScript(CURSOR_SCRIPT);
const page = await context.newPage();
let capturePath = null;
let captureInfo = {};

const APP_URL = 'http://127.0.0.1:3000/?provider=mock';
const STORAGE_RESET_KEYS = [
  'vorbis-player-welcome-seen',     // land on the welcome screen again
  'vorbis-player-last-session',     // no resume hero on the library home
  'vorbis-player-recently-played',  // no recently-played row on the library home
  'vorbis-player-zen-mode-enabled',
];

// The app re-saves its session on unload, so clearing localStorage from inside the warm-up
// page is undone by the reload itself. Instead the warm-up sets a one-shot sessionStorage
// flag and this init script clears the keys on the next navigation, before the app boots.
await context.addInitScript((keys) => {
  if (sessionStorage.getItem('__demo_reset') === '1') {
    sessionStorage.removeItem('__demo_reset');
    for (const k of keys) localStorage.removeItem(k);
  }
}, STORAGE_RESET_KEYS);

// Drive the app once through everything the take touches so the first recorded run is
// not also the first cold run: Vite's dev transforms of the lazy chunks, the HTTP and
// decoded-image caches for the 1600px covers, the color-extraction worker, the flip
// menu's 3D transition and the zen animation all warm up here. Runs before the grabber
// starts (screen mode) or before the first scene mark (Playwright mode, where the trim
// drops it), so none of it reaches the video. Ends with a reload to the same URL so the
// take's reload starts from the welcome screen exactly as a fresh session would.
async function warmUp() {
  const t = Date.now();
  await page.goto(APP_URL);
  await page.getByRole('button', { name: 'Browse your library' }).click();
  await page.locator(`[data-testid="library-card-playlist-${PLAYLIST}"]`).click();
  await page.locator('button[title^="Zen Mode"]').waitFor();
  await page.locator('[data-testid="player-track-info-name"]').waitFor();
  await sleep(1500);
  for (let i = 0; i < 2; i++) { // the take shows the first three tracks' art
    await page.getByRole('button', { name: 'Next track' }).click();
    await sleep(1500);
  }
  await page.mouse.click(5, 5);
  const name = (await page.locator('[data-testid="player-track-info-name"]').textContent())?.trim() ?? '';
  await page.locator(`img[alt="${name}"]`).first().click();
  await sleep(900);
  for (const style of ['Comet', 'Grid', 'Wave', 'Fireflies']) { // back to the default last
    await page.getByRole('radio', { name: style, exact: true }).or(page.getByRole('button', { name: style, exact: true })).first().click();
    await sleep(700);
  }
  await page.getByRole('button', { name: 'Close menu' }).click();
  await sleep(900);
  await page.keyboard.press('z');
  await sleep(2500);
  await page.keyboard.press('Escape');
  await sleep(2000);
  await page.evaluate(() => sessionStorage.setItem('__demo_reset', '1'));
  console.log(`warm-up done in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}

function detectMacScreenDevice() {
  if (process.env.DEMO_SCREEN_DEVICE) return process.env.DEMO_SCREEN_DEVICE;
  // avfoundation lists cameras first, then "[N] Capture screen 0"; the index shifts with
  // the number of cameras, so parse it rather than guessing.
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''], { encoding: 'utf8' });
  const m = /\[(\d+)\]\s+Capture screen 0/.exec(probe.stderr + probe.stdout);
  if (!m) throw new Error('could not find "Capture screen 0" in ffmpeg -list_devices output; set DEMO_SCREEN_DEVICE');
  return m[1];
}

async function windowGeometry() {
  return page.evaluate(() => ({
    x: window.screenX, y: window.screenY,
    w: window.innerWidth, h: window.innerHeight,
    dpr: window.devicePixelRatio,
    screenW: window.screen.width, screenH: window.screen.height,
  }));
}

async function waitForFullscreen() {
  // Chromium reports the fullscreen window one pixel short of an Xvfb screen (1919x1079 on
  // 1920x1080); on macOS the native fullscreen transition animates for ~1s and the window
  // ends up at the display size minus any camera housing. Wait until the size has been
  // stable for a second and fills the screen width.
  let last = null, stableSince = Date.now();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const g = await windowGeometry();
    const same = last && g.w === last.w && g.h === last.h && g.x === last.x && g.y === last.y;
    if (!same) { last = g; stableSince = Date.now(); }
    if (same && Date.now() - stableSince >= 1000 && g.w >= g.screenW - 2) return g;
    await sleep(250);
  }
  throw new Error(`window never settled fullscreen: ${JSON.stringify(last)}`);
}

async function waitForCaptureStart(progressFile) {
  // ffmpeg -progress appends a block every ~0.5s with frame=N and out_time_us=T. Once a
  // frame has been written, the capture origin is now minus T, which keeps the scene marks
  // aligned with the video regardless of how long ffmpeg took to start up.
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const text = fs.readFileSync(progressFile, 'utf8');
      const frames = [...text.matchAll(/frame=\s*(\d+)/g)];
      const times = [...text.matchAll(/out_time_us=\s*(\d+)/g)];
      const lastFrame = frames.length ? Number(frames[frames.length - 1][1]) : 0;
      const lastUs = times.length ? Number(times[times.length - 1][1]) : NaN;
      if (lastFrame > 0 && Number.isFinite(lastUs)) return Date.now() - lastUs / 1000;
    } catch { /* not written yet */ }
    await sleep(50);
  }
  throw new Error('ffmpeg did not report any captured frame within 20s; check the ffmpeg output above');
}

function stopFfmpeg() {
  return new Promise((resolve) => {
    if (!ffmpeg || ffmpeg.exitCode !== null) return resolve();
    const hard = setTimeout(() => ffmpeg.kill('SIGINT'), 5000);
    ffmpeg.on('exit', () => { clearTimeout(hard); resolve(); });
    try { ffmpeg.stdin.write('q'); ffmpeg.stdin.end(); } catch { ffmpeg.kill('SIGINT'); }
  });
}
// Never leave a grabber running if the script dies mid-take.
process.on('exit', () => { if (ffmpeg && ffmpeg.exitCode === null) ffmpeg.kill('SIGINT'); });
process.on('uncaughtException', (err) => { console.error(err); process.exit(1); });
process.on('unhandledRejection', (err) => { console.error(err); process.exit(1); });

if (CAPTURE === 'screen') {
  if (GRABBER === 'x11grab' && !process.env.DISPLAY) throw new Error('DEMO_CAPTURE=screen on Linux needs DISPLAY (use scripts/demo/record-x11.sh)');
  capturePath = path.join(OUT, 'capture.mp4');
  // --kiosk is not honoured for Playwright-launched windows, so go fullscreen through CDP.
  const cdp = await context.newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } });
  const g = await waitForFullscreen();
  await warmUp(); // at the real window size, and long enough for the fullscreen bubble to fade
  if (GRABBER === 'avfoundation') {
    // The viewport is whatever the display gives us; keep cursor targets inside it.
    W = g.w; H = g.h;
  }
  const even = (n) => Math.round(n / 2) * 2;
  let args;
  if (GRABBER === 'x11grab') {
    args = [
      '-f', 'x11grab', '-framerate', String(FPS), '-video_size', `${W}x${H}`, '-draw_mouse', '0', '-i', process.env.DISPLAY,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16', '-pix_fmt', 'yuv420p',
    ];
  } else {
    // avfoundation grabs the whole display at device pixels (2x on Retina); crop to the
    // browser window (which sits below the camera housing on notched MacBooks) and, unless
    // DEMO_NATIVE_SCALE=1, scale back to CSS pixels so the output matches the viewport.
    const crop = `crop=${even(g.w * g.dpr)}:${even(g.h * g.dpr)}:${even(g.x * g.dpr)}:${even(g.y * g.dpr)}`;
    const scale = process.env.DEMO_NATIVE_SCALE === '1' ? '' : `,scale=${even(g.w)}:${even(g.h)}:flags=lanczos`;
    const encoder = process.env.DEMO_ENCODER === 'libx264'
      ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16']
      : ['-c:v', 'h264_videotoolbox', '-b:v', '40M', '-realtime', '1'];
    args = [
      '-f', 'avfoundation', '-framerate', String(FPS), '-capture_cursor', '0', '-i', `${detectMacScreenDevice()}:none`,
      '-vf', crop + scale, ...encoder, '-pix_fmt', 'yuv420p',
    ];
    captureInfo = { crop, dpr: g.dpr, nativeScale: process.env.DEMO_NATIVE_SCALE === '1' };
  }
  console.log(`capturing ${GRABBER} ${W}x${H}@${FPS} (dpr ${g.dpr}) -> ${capturePath}`);
  const progressFile = path.join(OUT, 'ffmpeg-progress.txt');
  ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-progress', progressFile, ...args, capturePath], { stdio: ['pipe', 'ignore', 'inherit'] });
  ffmpeg.on('exit', (code) => { if (code && code !== 255) console.error(`ffmpeg exited with ${code}`); });
  t0 = await waitForCaptureStart(progressFile);
  await sleep(800); // let the grabber settle before the first scene
} else {
  await warmUp(); // recorded, but the encode trims to the first scene mark
}
await page.goto(APP_URL);
await page.getByRole('button', { name: 'Browse your library' }).waitFor();
// Playwright's "visible" precedes the pixels on screen: wait for web fonts and two
// composited frames, plus a margin on screen captures where software rendering lags.
await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
await sleep(CAPTURE === 'screen' ? 1200 : 200);
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
  await click(page, img, { ms: 750, settle: 900, gap: CALM });
  const chip = page.getByRole('radio', { name, exact: true }).or(page.getByRole('button', { name, exact: true })).first();
  await click(page, chip, { ms: 600, settle: 600, gap: CALM });
  mark(`style ${name}`);
  await click(page, page.getByRole('button', { name: 'Close menu' }), { ms: 600, settle: 700, gap: CALM });
  await glide(page, W * (0.2 + Math.random() * 0.1), H * 0.5, 900, CALM);
  await sleep(hold);
}
// Grid before Wave so zen mode (and the README GIF cut) runs on the smooth Wave band,
// which compresses far better as GIF than the moving dot grid.
await switchStyle('Comet', 3200);
await switchStyle('Grid', 3200);
await switchStyle('Wave', 3200);

// 4. Zen mode
await click(page, page.locator('button[title="Zen Mode OFF"]'), { ms: 900, settle: 300, gap: CALM });
mark('zen on');
await glide(page, W - 4, H * 0.42, 500, CALM); // park cursor at the right edge, clear of the art and bottom bar
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
await stopFfmpeg();
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ videoPath, capture: CAPTURE, grabber: CAPTURE === 'screen' ? GRABBER : null, fps: CAPTURE === 'screen' ? FPS : 25, width: W, height: H, ...captureInfo, marks }, null, 2));
console.log('video:', videoPath);
