import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import { openPlaylist } from '../fixtures/player';

/**
 * The visual-effects-menu capability had no e2e at all — the capture scenario
 * renders the flipped album art but asserts nothing.
 *
 * The menu is a CSS 3D card whose back face stays mounted in the DOM, so
 * presence and Playwright's toBeVisible() are both useless as signals: the
 * controls report "visible" before any flip. What actually changes is whether
 * they can receive a pointer, so these assert clickability instead.
 *
 * Only the ToggleGroup controls are covered. The glow and visualizer switches
 * sit under a z-index:2 layout layer at the top of the card and cannot be
 * clicked even after the flip — see the note in the PR; that needs a fix in the
 * component, not a workaround here.
 */

const playlist = requirePlaylist(spotifySnapshot, 'spotify');

function visualizerStyle(page: import('@playwright/test').Page) {
  return page.getByRole('group', { name: 'Visualizer style' });
}

async function flipToEffectsMenu(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('img[alt]').first().click();
  await expect(visualizerStyle(page).getByRole('radio', { name: 'Comet' })).toBeEnabled({
    timeout: 10_000,
  });
}

test.describe('Visual effects flip menu', () => {
  test.beforeEach(async ({ page }) => {
    await openPlaylist(page, playlist.id);
  });

  test('effects controls are unreachable until the album art is flipped', async ({ page }) => {
    // #given - the player showing the album art front face
    const comet = visualizerStyle(page).getByRole('radio', { name: 'Comet' });

    // #when - the user tries to use a control behind the art
    const blocked = await comet
      .click({ timeout: 3_000 })
      .then(() => false)
      .catch(() => true);

    // #then - the click cannot land; the front face is in the way
    expect(blocked).toBe(true);

    // ...and after flipping, the same control is reachable
    await flipToEffectsMenu(page);
    await expect(comet).toBeEnabled();
  });

  test('choosing a visualizer style marks that style active', async ({ page }) => {
    // #given - the effects menu, flipped into view
    await flipToEffectsMenu(page);
    const comet = visualizerStyle(page).getByRole('radio', { name: 'Comet' });
    await expect(comet).toHaveAttribute('aria-checked', 'false');

    // #when - the user picks a specific style
    await comet.click();

    // #then - that style becomes the active one
    await expect(comet).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 });
  });

  test('the chosen visualizer style survives a reload', async ({ page }) => {
    // #given - a style the user selected
    await flipToEffectsMenu(page);
    await visualizerStyle(page).getByRole('radio', { name: 'Comet' }).click();
    await expect(visualizerStyle(page).getByRole('radio', { name: 'Comet' }))
      .toHaveAttribute('aria-checked', 'true', { timeout: 5_000 });

    // #when - the user reloads and reopens the menu
    await page.reload();
    await page.locator('[data-testid="player-track-info-name"]').waitFor({ state: 'visible', timeout: 30_000 });
    await flipToEffectsMenu(page);

    // #then - the selection persisted
    await expect(visualizerStyle(page).getByRole('radio', { name: 'Comet' }))
      .toHaveAttribute('aria-checked', 'true', { timeout: 5_000 });
  });
});
