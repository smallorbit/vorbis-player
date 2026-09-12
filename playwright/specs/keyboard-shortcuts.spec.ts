import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import { openPlaylist, trackName, waitForZenControlsHidden } from '../fixtures/player';

/**
 * useKeyboardShortcuts has unit coverage of its handler map, but nothing
 * asserted that pressing a key in the running app reaches the feature it names.
 * docs/keyboard.md is the contract; these cover the transport and drawer keys
 * that a listener-registration regression would silently break.
 */

const playlist = requirePlaylist(spotifySnapshot, 'spotify');

test.describe('Keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await openPlaylist(page, playlist.id);
    await page.locator('button[aria-label="Pause"]').waitFor({ state: 'visible', timeout: 15_000 });
  });

  test('Space toggles play/pause', async ({ page }) => {
    // #given - a playing track
    const control = page.getByRole('button', { name: /^(Play|Pause)$/ });
    const before = await control.getAttribute('aria-label');

    // #when - the user presses Space
    await page.keyboard.press('Space');

    // #then - playback state flips, and flips back on a second press
    await expect(control).not.toHaveAttribute('aria-label', before!, { timeout: 5_000 });
    await page.keyboard.press('Space');
    await expect(control).toHaveAttribute('aria-label', before!, { timeout: 5_000 });
  });

  test('ArrowRight advances and ArrowLeft returns', async ({ page }) => {
    // #given - the first track of the queue
    const first = await trackName(page).textContent();

    // #when - the user presses ArrowRight
    await page.keyboard.press('ArrowRight');

    // #then - the track advances...
    await expect(trackName(page)).not.toHaveText(first ?? '', { timeout: 10_000 });

    // ...and ArrowLeft brings it back
    await page.keyboard.press('ArrowLeft');
    await expect(trackName(page)).toHaveText(first ?? '', { timeout: 10_000 });
  });

  test('Q opens the queue and Escape closes it', async ({ page }) => {
    // #given - the queue drawer has never been opened, so it is not yet rendered
    const rows = page.locator('[data-testid="queue-track-row"]');
    await expect(rows).toHaveCount(0);

    // #when - the user presses Q
    await page.keyboard.press('q');

    // #then - the drawer mounts inside the viewport...
    const viewportWidth = page.viewportSize()!.width;
    const rowLeft = async () => (await rows.first().boundingBox())?.x ?? null;
    await expect.poll(rowLeft, { timeout: 10_000 }).toBeLessThan(viewportWidth);

    // ...and Escape parks it off-screen. It stays mounted once opened and is
    // only translateX'd away, so counting rows would report a closed drawer as
    // open — position is the signal that means "closed".
    await page.keyboard.press('Escape');
    await expect.poll(rowLeft, { timeout: 10_000 }).toBeGreaterThanOrEqual(viewportWidth);
  });

  test('Z toggles zen mode on and back off', async ({ page }) => {
    // #given - the player outside zen mode
    await expect(page.locator('button[title="Zen Mode OFF"]')).toBeVisible({ timeout: 10_000 });

    // #when - the user presses Z
    await page.keyboard.press('z');

    // #then - zen mode engages...
    await expect(page.locator('button[title="Zen Mode ON"]')).toBeVisible({ timeout: 10_000 });
    await waitForZenControlsHidden(page);

    // ...and pressing Z again leaves it. Escape does NOT exit zen — it is
    // documented as "close all menus" and zen is not a menu; it reveals the
    // faded controls while zen stays on.
    await page.keyboard.press('z');
    await expect(page.locator('button[title="Zen Mode OFF"]')).toBeVisible({ timeout: 10_000 });
  });

  test('? opens the keyboard help', async ({ page }) => {
    // #when - the user asks for help
    await page.keyboard.press('?');

    // #then - the shortcut reference is shown
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible({ timeout: 10_000 });
  });
});
