import { test } from '../fixtures';
import { waitForPlayerReady, focusPage, animationSettle } from '../helpers';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const OUTPUT_DIR = path.resolve(import.meta.dirname, '..', 'output', 'videos');
const TARGET_FPS = 60;

interface VideoScenario {
  name: string;
  run: (page: import('@playwright/test').Page) => Promise<void>;
}

async function recordWithScreencast(
  page: import('@playwright/test').Page,
  scenario: VideoScenario,
  testInfo: import('@playwright/test').TestInfo
): Promise<string> {
  const projectName = testInfo.project.name;
  const framesDir = path.join(OUTPUT_DIR, '.frames', `${projectName}-${scenario.name}`);
  fs.mkdirSync(framesDir, { recursive: true });

  const cdp = await page.context().newCDPSession(page);

  let frameIndex = 0;
  const framePromises: Promise<void>[] = [];

  cdp.on('Page.screencastFrame', (params: { data: string; sessionId: number; metadata: unknown }) => {
    const framePath = path.join(framesDir, `frame-${String(frameIndex).padStart(5, '0')}.png`);
    frameIndex++;
    const buf = Buffer.from(params.data, 'base64');
    framePromises.push(
      fs.promises.writeFile(framePath, buf)
        .then(() => cdp.send('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {}))
    );
  });

  const viewport = testInfo.project.use.viewport as { width: number; height: number } | undefined;
  const dpr = (testInfo.project.use.deviceScaleFactor as number | undefined) ?? 2;
  const width = (viewport?.width ?? 1440) * dpr;
  const height = (viewport?.height ?? 900) * dpr;

  await cdp.send('Page.startScreencast', {
    format: 'png',
    quality: 100,
    maxWidth: width,
    maxHeight: height,
    everyNthFrame: 1,
  });

  await scenario.run(page);

  await cdp.send('Page.stopScreencast');
  await Promise.all(framePromises);
  await cdp.detach();

  const outputPath = path.join(OUTPUT_DIR, `${scenario.name}-${projectName}.mp4`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  execFileSync('ffmpeg', [
    '-y',
    '-framerate', String(TARGET_FPS),
    '-i', path.join(framesDir, 'frame-%05d.png'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'slow',
    '-crf', '16',
    outputPath,
  ]);

  fs.rmSync(framesDir, { recursive: true, force: true });
  return outputPath;
}

const scenarios: VideoScenario[] = [
  {
    name: 'zen-mode-transition',
    async run(page) {
      await page.waitForTimeout(1000);
      const zenButton = page.locator('button[title="Zen Mode OFF"]');
      await zenButton.click();
      await page.waitForTimeout(2500);
      await page.waitForTimeout(1500);
      const zenButtonOn = page.locator('button[title="Zen Mode ON"]');
      if (await zenButtonOn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await zenButtonOn.click();
        await page.waitForTimeout(1000);
      }
    },
  },
  {
    name: 'library-drawer-open',
    async run(page) {
      await page.waitForTimeout(1000);
      await page.keyboard.press('l');
      await page.waitForTimeout(2000);
      await page.keyboard.press('l');
      await page.waitForTimeout(1000);
    },
  },
  {
    name: 'album-art-flip',
    async run(page) {
      await page.waitForTimeout(1000);
      const albumArt = page.locator('img[alt]').first();
      if (await albumArt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await albumArt.click();
        await page.waitForTimeout(1500);
        await albumArt.click();
      }
      await page.waitForTimeout(1500);
    },
  },
  {
    name: 'playlist-drawer-open',
    async run(page) {
      await page.waitForTimeout(1000);
      await page.keyboard.press('p');
      await page.waitForTimeout(2000);
      await page.keyboard.press('p');
      await page.waitForTimeout(1000);
    },
  },
  {
    name: 'visual-effects-toggle',
    async run(page) {
      await page.waitForTimeout(1000);
      await page.keyboard.press('g');
      await page.waitForTimeout(2000);
      await page.keyboard.press('v');
      await page.waitForTimeout(2000);
      await page.keyboard.press('g');
      await page.waitForTimeout(300);
      await page.keyboard.press('v');
      await page.waitForTimeout(700);
    },
  },
];

test.describe('Video Captures', () => {
  test.describe.configure({ mode: 'serial' });

  for (const scenario of scenarios) {
    test(`record ${scenario.name}`, async ({ capturePage }, testInfo) => {
      await waitForPlayerReady(capturePage);
      await focusPage(capturePage);
      await capturePage.keyboard.press('Escape');
      await animationSettle(capturePage, 300);

      await recordWithScreencast(capturePage, scenario, testInfo);
    });
  }
});
