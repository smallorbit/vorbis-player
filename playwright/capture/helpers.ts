import { type Page, type TestInfo } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const OUTPUT_DIR = path.resolve(import.meta.dirname, 'output');

export async function waitForPlayerReady(page: Page): Promise<void> {
  await page.locator('button[title^="Zen Mode"]').waitFor({ state: 'visible', timeout: 15_000 });
}

export async function focusPage(page: Page): Promise<void> {
  await page.mouse.click(1, 1);
  await page.waitForTimeout(100);
}

export async function navigateToPlayer(page: Page): Promise<void> {
  await waitForPlayerReady(page);
  await focusPage(page);
  await page.keyboard.press('Escape');
  await animationSettle(page, 300);
}

export async function openLibraryDrawer(page: Page): Promise<void> {
  await page.keyboard.press('l');
  await animationSettle(page, 600);
}

export async function enterZenMode(page: Page): Promise<void> {
  const zenButton = page.locator('button[title="Zen Mode OFF"]');
  await zenButton.click();
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[title="Zen Mode ON"]');
    return btn !== null;
  }, { timeout: 5000 });
  await animationSettle(page, 1500);
}

export async function animationSettle(page: Page, ms = 600): Promise<void> {
  await page.waitForTimeout(ms);
}

export async function captureScreenshot(
  page: Page,
  name: string,
  testInfo: TestInfo
): Promise<string> {
  const projectName = testInfo.project.name;
  const dir = path.join(OUTPUT_DIR, projectName);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filePath, animations: 'allow' });
  return filePath;
}
