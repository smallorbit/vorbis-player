import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Locator for the player's current-track name — the readout every transport assertion reads. */
export function trackName(page: Page) {
  return page.locator('[data-testid="player-track-info-name"]');
}

/**
 * Enter the player by opening the first playlist in the library.
 * Leaves the app playing, with a queue of that playlist's tracks.
 */
export async function enterPlayerViaPlaylist(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('[data-testid="library-home"]').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('[data-testid^="library-card-playlist-"]').first().click();
  await trackName(page).waitFor({ state: 'visible', timeout: 15_000 });
}

/**
 * Open a specific playlist by id, loading its tracks as the queue.
 *
 * Deliberately not `window.__mockTest.setQueue`: that dispatches into
 * TrackContext only, so the queue drawer re-renders while usePlayerLogic still
 * closes over the previously loaded track list. Navigation then reads one length
 * and plays from another, which makes boundary assertions pass for the wrong
 * reason. Going through the real collection load keeps both in agreement.
 */
export async function openPlaylist(page: Page, playlistId: string): Promise<void> {
  await page.goto('/');
  await page.locator('[data-testid="library-home"]').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator(`[data-testid="library-card-playlist-${playlistId}"]`).click();
  await trackName(page).waitFor({ state: 'visible', timeout: 15_000 });
}

/**
 * Click "Next track" until `targetName` is current, asserting the readout changes
 * on each step. Uses the real transport path, so React's currentTrackIndex — the
 * state the boundary guard actually reads — ends up where the spec claims it is.
 */
export async function advanceTo(page: Page, targetName: string, maxSteps: number): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    if ((await trackName(page).textContent())?.trim() === targetName) return;
    const before = (await trackName(page).textContent()) ?? '';
    await page.getByRole('button', { name: 'Next track' }).click();
    await expect(trackName(page)).not.toHaveText(before, { timeout: 5_000 });
  }
  await expect(trackName(page)).toHaveText(targetName, { timeout: 5_000 });
}

/** Open the queue surface (QueueDrawer on desktop, QueueBottomSheet on mobile). */
export async function openQueue(page: Page): Promise<void> {
  const queueButton = page.locator('button[aria-label="Show Queue"]');
  await queueButton.waitFor({ state: 'visible', timeout: 15_000 });
  await queueButton.click();
  await expect(page.locator('[data-testid="queue-track-row"]').first()).toBeVisible({
    timeout: 10_000,
  });
}

/** The queue rows' visible track titles, in queue order. */
export async function queueOrder(page: Page): Promise<string[]> {
  const rows = page.locator('[data-testid="queue-track-row"]');
  const count = await rows.count();
  const titles: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await rows.nth(i).textContent();
    titles.push((text ?? '').trim());
  }
  return titles;
}

/**
 * Put the open queue into edit mode. Remove buttons and drag handles are only
 * rendered there — outside it, a drag is inert and the row exposes no Remove.
 */
export async function enableQueueEdit(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Edit$/ }).click();
  await expect(page.getByRole('button', { name: /^Done$/ })).toBeVisible({ timeout: 5_000 });
}

/** Drag the queue row at `fromIndex` onto the row at `toIndex`. */
export async function dragQueueRow(page: Page, fromIndex: number, toIndex: number): Promise<void> {
  const rows = page.locator('[data-testid="queue-track-row"]');
  const source = await rows.nth(fromIndex).boundingBox();
  const target = await rows.nth(toIndex).boundingBox();
  if (!source || !target) throw new Error('queue rows are not laid out');

  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  // PointerSensor activates at 8px; nudge first so dnd-kit starts a drag, not a click.
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2 - 20);
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await page.mouse.up();
}

/**
 * Wait for zen mode's fade to finish. Zen does not unmount the controls, it
 * fades an ancestor's opacity, so a spec that presses Escape immediately after
 * entering zen races the transition and the exit is dropped.
 */
export async function waitForZenControlsHidden(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="player-track-info-album"]');
    if (!el) return false;
    for (let anc: Element | null = el; anc; anc = anc.parentElement) {
      if (parseFloat(window.getComputedStyle(anc).opacity) < 0.1) return true;
    }
    return false;
  }, { timeout: 5_000 });
}
