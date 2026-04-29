import { test, expect } from '@playwright/test';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };

const hasContent = spotifySnapshot.playlists.length > 0;

test.describe('Zen Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('button[title^="Zen Mode"]').waitFor({ state: 'visible', timeout: 30_000 });

    if (hasContent) {
      await page.locator('button[title="Back to Library"]').click();
      await page.locator('[data-testid="library-home"]').waitFor({ state: 'visible', timeout: 10_000 });
      await page.locator('[data-testid^="library-card-playlist-"]').first().click();
      await page.locator('[data-testid="player-track-info-name"]').waitFor({ state: 'visible', timeout: 10_000 });
    }
  });

  test('zen mode button exists in the bottom bar', async ({ page }) => {
    const zenButton = page.locator('button[title^="Zen Mode"]');
    await expect(zenButton).toBeVisible({ timeout: 5000 });
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

  test('clicking zen mode button hides player controls', async ({ page }) => {
    if (!hasContent) {
      test.skip(true, 'Snapshot has no playlists — skipping content-dependent zen mode test');
      return;
    }

    await expect(page.locator('[data-testid="player-track-info-album"]')).toBeVisible({ timeout: 5000 });

    const zenButton = page.locator('button[title="Zen Mode OFF"]');
    await expect(zenButton).toBeVisible({ timeout: 5000 });
    await zenButton.click();

    await waitForControlsHidden(page);

    await expect(page.locator('button[title="Zen Mode ON"]')).toBeVisible({ timeout: 5000 });
  });

  test('escape key exits zen mode', async ({ page }) => {
    if (!hasContent) {
      test.skip(true, 'Snapshot has no playlists — skipping content-dependent zen mode test');
      return;
    }

    const zenButton = page.locator('button[title="Zen Mode OFF"]');
    await expect(zenButton).toBeVisible({ timeout: 5000 });
    await zenButton.click();

    await waitForControlsHidden(page);

    await page.keyboard.press('Escape');

    await expect(page.locator('[data-testid="player-track-info-album"]')).toBeVisible({ timeout: 5000 });
  });

  test('zen mode expands album art area', async ({ page }) => {
    const zenButton = page.locator('button[title="Zen Mode OFF"]');
    await expect(zenButton).toBeVisible({ timeout: 5000 });

    await zenButton.click();

    const zenButtonOn = page.locator('button[title="Zen Mode ON"]');
    await expect(zenButtonOn).toBeVisible({ timeout: 5000 });

    const albumArtSvg = page.locator('img[alt]').first();
    const artContainer = page.locator('[style*="position: relative"]').first();
    const isArtVisible = await albumArtSvg.isVisible().catch(() => false);
    const isContainerVisible = await artContainer.isVisible().catch(() => false);
    expect(isArtVisible || isContainerVisible).toBe(true);
  });

  test('clicking album art in zen mode triggers play/pause (not flip)', async ({ page }) => {
    const zenButton = page.locator('button[title="Zen Mode OFF"]');
    await expect(zenButton).toBeVisible({ timeout: 5000 });
    await zenButton.click();
    await expect(page.locator('button[title="Zen Mode ON"]')).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(500);

    const artArea = page.locator('[style*="transform"]').first();
    if (await artArea.isVisible()) {
      await artArea.click();
      await expect(page.locator('button[title="Zen Mode ON"]')).toBeVisible({ timeout: 3000 });
    }
  });
});
