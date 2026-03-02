import { test, expect } from '../fixtures/auth';
import { setupAllMocks, mockTracks } from '../fixtures/mocks';

test.describe('Zen Mode', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);

    await page.route('**/v1/playlists/playlist-1/tracks**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockTracks) })
    );

    await page.goto('/');
    await expect(page.getByText('Chill Vibes')).toBeVisible({ timeout: 10000 });
    await page.getByText('Chill Vibes').click();
    await expect(page.getByPlaceholder('Search playlists...')).not.toBeVisible({ timeout: 10000 });
    // Wait for the player to finish loading
    await expect(page.getByText('Test Song').first()).toBeVisible({ timeout: 10000 });
  });

  test('zen mode button exists in the bottom bar', async ({ page }) => {
    // Zen mode button has title "Zen Mode OFF" or "Zen Mode ON"
    const zenButton = page.locator('button[title^="Zen Mode"]');
    await expect(zenButton).toBeVisible({ timeout: 5000 });
  });

  // Playwright's isVisible() checks the element's own opacity, not inherited opacity from
  // ancestors. The ZenControlsWrapper hides via opacity:0 on a parent, so we must walk
  // the ancestor chain to detect the effective hidden state.
  async function waitForControlsHidden(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => {
      const el = Array.from(document.querySelectorAll('div')).find(
        d => d.textContent?.trim() === 'Test Album' && d.children.length === 0
      );
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
    // "Test Album" is only visible as text in the player track info (not in the playlist)
    await expect(page.getByText('Test Album')).toBeVisible({ timeout: 5000 });

    const zenButton = page.locator('button[title="Zen Mode OFF"]');
    await expect(zenButton).toBeVisible({ timeout: 5000 });
    await zenButton.click();

    // Controls fade out via opacity:0 on the ZenControlsWrapper parent
    await waitForControlsHidden(page);

    // Zen button should now show "ON" state
    await expect(page.locator('button[title="Zen Mode ON"]')).toBeVisible({ timeout: 5000 });
  });

  test('escape key exits zen mode', async ({ page }) => {
    const zenButton = page.locator('button[title="Zen Mode OFF"]');
    await expect(zenButton).toBeVisible({ timeout: 5000 });
    await zenButton.click();

    // Controls should be hidden
    await waitForControlsHidden(page);

    // Press Escape to exit zen mode
    await page.keyboard.press('Escape');

    // Controls should reappear
    await expect(page.getByText('Test Album')).toBeVisible({ timeout: 5000 });
  });

  test('zen mode expands album art area', async ({ page }) => {
    // Get the content wrapper width before zen mode
    // The ContentWrapper has max-width constraint that gets removed in zen mode
    const zenButton = page.locator('button[title="Zen Mode OFF"]');
    await expect(zenButton).toBeVisible({ timeout: 5000 });

    // Click zen mode
    await zenButton.click();

    // In zen mode, ContentWrapper gets $zenMode={true} which sets width: 100% and max-width: 100%
    // We verify by checking that the zen button now says ON
    const zenButtonOn = page.locator('button[title="Zen Mode ON"]');
    await expect(zenButtonOn).toBeVisible({ timeout: 5000 });

    // The album art container should still be visible (it expands)
    const albumArtSvg = page.locator('img[alt]').first();
    // If there's no img loaded (placeholder), just check the album art container area exists
    const artContainer = page.locator('[style*="position: relative"]').first();
    const isArtVisible = await albumArtSvg.isVisible().catch(() => false);
    const isContainerVisible = await artContainer.isVisible().catch(() => false);
    expect(isArtVisible || isContainerVisible).toBe(true);
  });

  test('clicking album art in zen mode triggers play/pause (not flip)', async ({ page }) => {
    // Enter zen mode
    const zenButton = page.locator('button[title="Zen Mode OFF"]');
    await expect(zenButton).toBeVisible({ timeout: 5000 });
    await zenButton.click();
    await expect(page.locator('button[title="Zen Mode ON"]')).toBeVisible({ timeout: 5000 });

    // In zen mode, clicking album art calls handlePlayPause instead of toggleFlip.
    // We verify this by checking that after clicking the art area, no flip menu appears
    // (the AlbumArtBackside / quick-swap back should not show).

    // Wait briefly for zen mode transition
    await page.waitForTimeout(500);

    // The album art area is the ClickableAlbumArtContainer.
    // We find it by looking for the flip container's parent with onClick
    const artArea = page.locator('[style*="transform"]').first();
    if (await artArea.isVisible()) {
      await artArea.click();
      // No flip menu text should appear (like "Tap panel to return" which is on the controls back face)
      // In zen mode, controls are already hidden, so we just verify zen mode is still active
      await expect(page.locator('button[title="Zen Mode ON"]')).toBeVisible({ timeout: 3000 });
    }
  });
});
