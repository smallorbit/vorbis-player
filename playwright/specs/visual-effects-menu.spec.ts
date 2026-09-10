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

/**
 * Regression guard for the clipped effects menu.
 *
 * BacksideRoot is overflow:hidden and Content was justify-content:center, so
 * whenever the menu was taller than the square card the overflow split evenly
 * and the top half was clipped outside it. At 1280x720 that put the accent
 * swatches at y=6 and the glow switch at y=41 against a card starting at y=64:
 * rendered, reported "visible", and impossible to see or click.
 */
test.describe('Visual effects menu — nothing clipped above the card', () => {
  test.beforeEach(async ({ page }) => {
    await openPlaylist(page, playlist.id);
    await flipToEffectsMenu(page);
  });

  test('no control renders above the top of the card', async ({ page }) => {
    // #given - the flipped menu and the card that clips it
    const cardTop = await page.evaluate(() => {
      const sw = document.querySelector('[aria-label="Toggle glow"]');
      let content: Element | null = sw;
      while (content && getComputedStyle(content).zIndex !== '1') content = content.parentElement;
      return content?.getBoundingClientRect().top ?? null;
    });
    expect(cardTop).not.toBeNull();

    // #when - each interactive control is measured
    const controls = page.locator(
      '[aria-label^="Choose color"], [aria-label="Pick color from album art"], [aria-label^="Toggle "]',
    );
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);

    // #then - none of them sits above the clip boundary
    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      const label = await controls.nth(i).getAttribute('aria-label');
      expect(box, `${label} has no box`).not.toBeNull();
      expect(box!.y, `${label} is clipped above the card`).toBeGreaterThanOrEqual(cardTop!);
    }
  });

  test('the glow switch is reachable and toggles', async ({ page }) => {
    // #given - the glow switch, previously clipped outside the card
    const glow = page.getByRole('switch', { name: 'Toggle glow' });
    const before = await glow.getAttribute('aria-checked');

    // #when - the user clicks it, hit-testing included
    await glow.click();

    // #then - it actually flips, so the click landed on the switch
    await expect(glow).not.toHaveAttribute('aria-checked', before ?? '', { timeout: 5_000 });
  });

  test('an accent swatch is reachable', async ({ page }) => {
    // #given - the accent row, which sat furthest above the clip boundary
    const swatch = page.locator('[aria-label^="Choose color"]').first();

    // #when / #then - it can be clicked rather than timing out on actionability
    await swatch.click({ timeout: 5_000 });
    await expect(swatch).toBeVisible();
  });
});
