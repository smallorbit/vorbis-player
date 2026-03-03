import { test } from '../fixtures';
import { navigateToPlayer, captureScreenshot, animationSettle } from '../helpers';

test.describe('Album Art Flip', () => {
  test('capture album art back side', async ({ capturePage }, testInfo) => {
    await navigateToPlayer(capturePage);

    const albumArt = capturePage.locator('img[alt]').first();
    if (await albumArt.isVisible({ timeout: 5000 }).catch(() => false)) {
      await albumArt.click();
    } else {
      const artContainer = capturePage.locator('[style*="transform"]').first();
      await artContainer.click();
    }

    await animationSettle(capturePage, 700);
    await captureScreenshot(capturePage, 'album-art-flip', testInfo);
  });
});
