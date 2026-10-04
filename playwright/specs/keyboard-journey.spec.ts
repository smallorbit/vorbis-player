import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import { trackName } from '../fixtures/player';

/**
 * WS6 exit criterion: a keyboard-only user can browse, play, queue, reorder,
 * and remove. No mouse calls in this spec — every step reaches its control
 * with Tab and activates it with Enter/Space, so a focus-order or activation
 * regression anywhere on the path fails here.
 */

const playlist = requirePlaylist(spotifySnapshot, 'spotify');
const MAX_TAB_STOPS = 200;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function isFocused(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => el === document.activeElement).catch(() => false);
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < MAX_TAB_STOPS; i++) {
    if (await isFocused(target)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab never reached ${target.toString()}`);
}

/** The drawer stays mounted off-screen when closed; `inert` is its closed state. */
async function expectQueueClosed(dialog: Locator): Promise<void> {
  await expect(dialog).toHaveAttribute('inert', '', { timeout: 5_000 });
}

/**
 * dnd-kit's KeyboardSensor attaches its document keydown listener in a
 * `setTimeout(0)` after pickup, and Chrome runs queued input ahead of timers,
 * so arrows pressed back-to-back with the pickup Space are dropped. A timer
 * scheduled now runs after dnd-kit's, so awaiting it guarantees the listener.
 */
async function flushPendingTimers(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
}

/**
 * dnd-kit announces "Draggable item A was moved over droppable area B". The
 * first such announcement (B === A) means collision rects are measured, so an
 * arrow key can move the item; only B !== A proves it moved.
 */
async function dragOverTarget(page: Page): Promise<'none' | 'self' | 'other'> {
  const text = (await page.locator('[id^="DndLiveRegion"]').textContent()) ?? '';
  const match = /Draggable item (\S+) was moved over droppable area (\S+?)\.?$/.exec(text.trim());
  if (!match) return 'none';
  return match[1] === match[2] ? 'self' : 'other';
}

function queueDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: /Up Next|Radio/ });
}

/** Track names in queue order, read from each row's Actions trigger (present in every mode). */
async function queueTrackNames(page: Page): Promise<string[]> {
  return queueDialog(page)
    .locator('[data-testid="queue-track-row"] button[aria-label^="Actions for "]')
    .evaluateAll((els) =>
      els.map((el) => (el.getAttribute('aria-label') ?? '').replace(/^Actions for /, '')),
    );
}

test.describe('Keyboard-only journey', () => {
  test('browse, play, queue, reorder, and remove without a pointer', async ({ page }) => {
    // #given - the library, reached and activated by keyboard alone
    await page.goto('/');
    await page.locator('[data-testid="library-home"]').waitFor({ state: 'visible', timeout: 30_000 });
    await tabTo(page, page.locator(`[data-testid="library-card-playlist-${playlist.id}"]`));
    await page.keyboard.press('Enter');
    await trackName(page).waitFor({ state: 'visible', timeout: 15_000 });

    // #when - open the queue from its bottom-bar button
    const showQueue = page.getByRole('button', { name: 'Show Queue' });
    await tabTo(page, showQueue);
    await page.keyboard.press('Enter');

    // #then - the queue is a dialog and focus moved into it
    const dialog = queueDialog(page);
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.locator('[data-testid="queue-track-row"]').first()).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

    // #when - select the second track
    const initial = await queueTrackNames(page);
    expect(initial.length).toBeGreaterThan(3);
    const second = initial[1] ?? '';
    await tabTo(page, dialog.getByRole('button', { name: new RegExp(`^${escapeRegExp(second)}, `) }));
    await page.keyboard.press('Enter');

    // #then - it plays, the queue closes, and focus returns to the opener
    await expect(trackName(page)).toHaveText(second, { timeout: 10_000 });
    await expectQueueClosed(dialog);
    await expect(showQueue).toBeFocused();

    // #when - reopen, enter edit mode, and move the third track down one place
    await page.keyboard.press('Enter');
    await expect(dialog).not.toHaveAttribute('inert', { timeout: 10_000 });
    await tabTo(page, dialog.getByRole('button', { name: 'Edit', exact: true }));
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('button', { name: 'Done', exact: true })).toBeVisible({ timeout: 5_000 });

    const third = initial[2] ?? '';
    const reorderHandle = dialog.getByRole('button', { name: `Reorder ${third}`, exact: true });
    await tabTo(page, reorderHandle);
    await page.keyboard.press('Space');
    await expect(reorderHandle).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
    await expect.poll(() => dragOverTarget(page), { timeout: 5_000 }).toBe('self');
    await flushPendingTimers(page);
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => dragOverTarget(page), { timeout: 5_000 }).toBe('other');
    await page.keyboard.press('Space');

    // #then - the third and fourth tracks swapped
    const reordered = [...initial];
    const [moved] = reordered.splice(2, 1);
    reordered.splice(3, 0, moved ?? '');
    await expect.poll(() => queueTrackNames(page), { timeout: 5_000 }).toEqual(reordered);

    // #when - remove the track that is now fourth
    await tabTo(page, dialog.getByRole('button', { name: `Remove ${third}`, exact: true }));
    await page.keyboard.press('Enter');

    // #then - it is gone and nothing else moved
    await expect
      .poll(() => queueTrackNames(page), { timeout: 5_000 })
      .toEqual(reordered.filter((name) => name !== third));

    // #when - Escape out of the queue
    await page.keyboard.press('Escape');

    // #then - the dialog closes and focus is back on the opener
    await expectQueueClosed(dialog);
    await expect(showQueue).toBeFocused();
  });
});
