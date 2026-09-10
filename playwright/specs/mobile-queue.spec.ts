import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import { openPlaylist, openQueue } from '../fixtures/player';

/**
 * Below 700px (usePlayerSizing's isMobile) DrawerOrchestrator mounts
 * QueueBottomSheet instead of QueueDrawer — a different component with its own
 * markup, dismissal affordance and touch reorder path. The suite ran desktop-only,
 * so none of it was asserted; the capture scenarios render mobile but assert nothing.
 */

const playlist = requirePlaylist(spotifySnapshot, 'spotify');

test.describe('Mobile queue surface @mobile-only', () => {
  test.beforeEach(async ({ page }) => {
    await openPlaylist(page, playlist.id);
    await openQueue(page);
  });

  test('opens the bottom sheet, not the desktop drawer', async ({ page }) => {
    // #given / #when - the queue was opened at a mobile viewport
    // #then - the bottom sheet's modal dialog is what mounted
    await expect(page.getByRole('dialog', { name: 'Up Next' })).toBeVisible({ timeout: 10_000 });

    // ...and the desktop drawer's close button is absent
    await expect(page.getByRole('button', { name: 'Close Up Next drawer' })).toHaveCount(0);
  });

  test('renders the loaded queue in the sheet', async ({ page }) => {
    // #then - the sheet is populated from the same queue the player loaded
    const rows = page.locator('[data-testid="queue-track-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    expect(await rows.count()).toBe(playlist.trackIds.length);
  });

  test('tapping the swipe handle dismisses the sheet', async ({ page }) => {
    // #given - the sheet is open
    const sheet = page.getByRole('dialog', { name: 'Up Next' });
    await expect(sheet).toBeVisible({ timeout: 10_000 });

    // #when - the user taps the grab handle
    await page.getByRole('button', { name: 'Swipe down or tap to close' }).click();

    // #then - the sheet slides fully below the viewport and unmounts its rows.
    // toBeVisible() cannot express this: the sheet stays in the DOM at full size,
    // just translated off-screen, so Playwright still reports it as visible.
    const viewportHeight = page.viewportSize()!.height;
    await expect
      .poll(async () => (await sheet.boundingBox())?.y ?? null, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(viewportHeight);
    await expect(page.locator('[data-testid="queue-track-row"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="player-track-info-name"]')).toBeVisible();
  });
});
