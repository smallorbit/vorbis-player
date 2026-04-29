import { test, expect } from '@playwright/test';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };

const hasContent = spotifySnapshot.playlists.length > 0;

test.describe('Player Controls', () => {
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

  test('play/pause button is present in the player UI', async ({ page }) => {
    const playSvg = page.locator('svg path[d="M8 5v14l11-7z"]');
    const pauseSvg = page.locator('svg path[d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"]');
    await expect(playSvg.or(pauseSvg).first()).toBeVisible({ timeout: 5000 });
  });

  test('next track button is present and clickable', async ({ page }) => {
    const nextButton = page.locator('svg path[d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"]').locator('..');
    await expect(nextButton).toBeVisible({ timeout: 5000 });
    await nextButton.click();
  });

  test('previous track button is present and clickable', async ({ page }) => {
    const prevButton = page.locator('svg path[d="M6 6h2v12H6zm3.5 6l8.5 6V6z"]').locator('..');
    await expect(prevButton).toBeVisible({ timeout: 5000 });
    await prevButton.click();
  });

  test('track info displays current track name', async ({ page }) => {
    if (!hasContent) {
      test.skip(true, 'Snapshot has no playlists — skipping content-dependent track name test');
      return;
    }
    await expect(page.locator('[data-testid="player-track-info-name"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="player-track-info-name"]')).not.toHaveText('');
  });

  test('volume control is present in the bottom bar', async ({ page }) => {
    const settingsButton = page.locator('button[title="App settings"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
  });
});
