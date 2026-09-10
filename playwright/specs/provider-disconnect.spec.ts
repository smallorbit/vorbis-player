import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import { openPlaylist } from '../fixtures/player';

/**
 * auth-system, "Disconnect Confirmation and Cleanup": turning a provider off
 * while its tracks are queued must confirm first, because it stops playback and
 * drops those tracks. Only the dialog component was unit-tested; the flow that
 * reaches it was not.
 */

const playlist = requirePlaylist(spotifySnapshot, 'spotify');

async function openSettings(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'App settings' }).click();
  await expect(page.getByRole('switch', { name: /^(Disable|Enable) Spotify$/ }))
    .toBeVisible({ timeout: 10_000 });
}

test.describe('Provider disconnect', () => {
  test.beforeEach(async ({ page }) => {
    await openPlaylist(page, playlist.id);
  });

  test('music sources shows the connected provider', async ({ page }) => {
    // #given / #when - the user opens settings with Spotify connected
    await openSettings(page);

    // #then - Spotify reads as connected and its toggle offers to disable it
    await expect(page.getByRole('switch', { name: 'Disable Spotify' })).toBeVisible();
    await expect(page.getByText('Connected').first()).toBeVisible();
  });

  test('disabling a provider with queued tracks asks for confirmation first', async ({ page }) => {
    // #given - settings open while a Spotify playlist is queued
    await openSettings(page);

    // #when - the user turns Spotify off
    await page.getByRole('switch', { name: 'Disable Spotify' }).click();

    // #then - the destructive action is gated behind a confirmation naming the cost.
    // The confirmation replaces the settings dialog's content rather than
    // stacking, so the assertion is on what the one dialog now says.
    const confirm = page.getByRole('button', { name: 'Disconnect' });
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/remove \d+ queued tracks/)).toBeVisible();
  });

  test('cancelling the confirmation leaves the provider connected', async ({ page }) => {
    // #given - the confirmation dialog is open
    await openSettings(page);
    await page.getByRole('switch', { name: 'Disable Spotify' }).click();
    await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible({ timeout: 10_000 });

    // #when - the user backs out
    await page.getByRole('button', { name: 'Cancel' }).click();

    // #then - the confirmation is gone and Spotify is still connected
    await expect(page.getByRole('button', { name: 'Disconnect' })).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByRole('switch', { name: 'Disable Spotify' })).toBeVisible();
  });

  test('confirming disconnects the provider', async ({ page }) => {
    // #given - the confirmation dialog is open
    await openSettings(page);
    await page.getByRole('switch', { name: 'Disable Spotify' }).click();
    const confirm = page.getByRole('button', { name: 'Disconnect' });
    await expect(confirm).toBeVisible({ timeout: 10_000 });

    // #when - the user confirms
    await confirm.click();

    // #then - the toggle flips to offering re-enablement
    await expect(page.getByRole('switch', { name: 'Enable Spotify' }))
      .toBeVisible({ timeout: 10_000 });
  });
});
