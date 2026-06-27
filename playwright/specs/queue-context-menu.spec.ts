import { test, expect } from '@playwright/test';

// Repro / regression guard for the queue-item context-menu (#1633 popover migration).
// Desktop: right-click a queue row should open the menu.
test('queue item context menu opens on right-click', async ({ page }) => {
  await page.goto('/?provider=mock');

  // Enter the player by loading a playlist (populates the queue + starts playback).
  await page.getByRole('button', { name: 'Browse your library' }).click();
  await page.locator('[data-testid="library-home"]').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('[data-testid^="library-card-playlist-"]').first().click();
  await page.locator('[data-testid="player-track-info-name"]').waitFor({ state: 'visible', timeout: 15_000 });

  // Open the queue drawer.
  const queueBtn = page.locator('button[aria-label="Show Queue"]');
  await queueBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await queueBtn.click();

  // Right-click the second queue row (a non-playing track).
  const row = page.locator('[data-testid="queue-track-row"]').nth(1);
  await row.waitFor({ state: 'visible', timeout: 10_000 });
  await row.click({ button: 'right' });

  // #then - the queue context menu opens...
  const menu = page.locator('[data-testid="queue-context-menu"]');
  await expect(menu).toBeVisible({ timeout: 5_000 });

  // ...and lands INSIDE the viewport. The regression (#1633) rendered the menu
  // far off-screen because its position:fixed anchor sat inside the queue
  // drawer's transform:ed container. toBeVisible() alone does NOT catch that —
  // an off-screen element is still "visible" to Playwright — so assert the
  // bounding box is within the viewport.
  const box = await menu.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
});
