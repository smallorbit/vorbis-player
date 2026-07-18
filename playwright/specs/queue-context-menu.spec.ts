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
  //
  // Radix/floating-ui mounts the popover at a default position and repositions
  // it on the next frame, so a single boundingBox() snapshot can catch the
  // pre-settle placement (observed y=-262 ~25% of runs). Poll until the box has
  // settled inside the viewport — that settled position is what a user sees.
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  await expect
    .poll(async () => {
      const box = await menu.boundingBox();
      if (!box) return null;
      const inside =
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport!.width + 1 &&
        box.y + box.height <= viewport!.height + 1;
      return inside;
    }, { timeout: 5_000 })
    .toBe(true);
});
