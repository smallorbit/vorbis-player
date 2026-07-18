import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };

const hasContent = spotifySnapshot.playlists.length > 0;

test.describe('Zen Mode', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasContent,
      'Specs require populated snapshots. Run `npm run snapshot:spotify -- --list` to enumerate your library, populate `snapshot.config.json`, then `npm run snapshot:spotify`. See #1372 §10 ("Curating fixtures").',
    );
    await page.goto('/');
    await page.locator('[data-testid="library-home"]').waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator('[data-testid^="library-card-playlist-"]').first().click();
    await page.locator('[data-testid="player-track-info-name"]').waitFor({ state: 'visible', timeout: 15_000 });
  });

  // Playwright's isVisible() checks the element's own opacity, not inherited opacity from
  // ancestors. The ZenControlsWrapper hides via opacity:0 on a parent, so we must walk
  // the ancestor chain to detect the effective hidden state.
  async function waitForControlsHidden(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="player-track-info-album"]');
      if (!el) return false;
      let anc: Element | null = el;
      while (anc) {
        if (parseFloat(window.getComputedStyle(anc).opacity) < 0.1) return true;
        anc = anc.parentElement;
      }
      return false;
    }, { timeout: 2000 });
  }

  test('zen mode button exists in the bottom bar', async ({ page }) => {
    const zenButton = page.locator('button[title^="Zen Mode"]');
    await expect(zenButton).toBeVisible({ timeout: 5000 });
  });

  test('clicking zen mode button hides player controls', async ({ page }) => {
    await expect(page.locator('[data-testid="player-track-info-album"]')).toBeVisible({ timeout: 5000 });

    const zenButton = page.locator('button[title="Zen Mode OFF"]');
    await expect(zenButton).toBeVisible({ timeout: 5000 });
    await zenButton.click();

    await waitForControlsHidden(page);

    await expect(page.locator('button[title="Zen Mode ON"]')).toBeVisible({ timeout: 5000 });
  });

  test('escape key exits zen mode', async ({ page }) => {
    const zenButton = page.locator('button[title="Zen Mode OFF"]');
    await expect(zenButton).toBeVisible({ timeout: 5000 });
    await zenButton.click();

    await waitForControlsHidden(page);

    await page.keyboard.press('Escape');

    await expect(page.locator('[data-testid="player-track-info-album"]')).toBeVisible({ timeout: 5000 });
  });

  test('zen mode enlarges the album art area', async ({ page }) => {
    // Measure the album art before entering zen, then after. Zen mode reclaims
    // the space freed by the hidden controls, so the art must grow — assert the
    // actual size increase, not merely that some element still exists.
    const art = page.locator('img[alt]').first();
    const before = await art.boundingBox();
    expect(before).not.toBeNull();

    await page.locator('button[title="Zen Mode OFF"]').click();
    await expect(page.locator('button[title="Zen Mode ON"]')).toBeVisible({ timeout: 5000 });

    await expect
      .poll(async () => {
        const box = await art.boundingBox();
        if (!box) return 0;
        return box.width * box.height;
      }, { timeout: 5000 })
      .toBeGreaterThan(before!.width * before!.height);
  });

  test('clicking album art in zen mode toggles play/pause without flipping', async ({ page }) => {
    await page.locator('button[title="Zen Mode OFF"]').click();
    await expect(page.locator('button[title="Zen Mode ON"]')).toBeVisible({ timeout: 5000 });

    // The zen center click-zone overlays the album art and toggles play/pause.
    const playPauseZone = page.locator('[data-testid="zen-playpause-zone"]');
    await expect(playPauseZone).toBeVisible({ timeout: 5000 });

    const before = await playPauseZone.getAttribute('aria-label'); // "Play" | "Pause"
    await playPauseZone.click();

    // Play/pause state must flip...
    await expect(playPauseZone).not.toHaveAttribute('aria-label', before!, { timeout: 5000 });

    // ...and the art must NOT have flipped to the menu: the zen click-zone is
    // rendered only while the art shows its front (visible && !isFlipped), so its
    // continued presence proves the click toggled playback rather than flipping.
    await expect(playPauseZone).toBeVisible();
  });
});
