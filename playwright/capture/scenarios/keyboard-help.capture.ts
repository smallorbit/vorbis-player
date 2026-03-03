import { test } from '../fixtures';
import { navigateToPlayer, captureScreenshot, captureElementScreenshot, animationSettle } from '../helpers';

test.describe('Keyboard Help', () => {
  test('capture keyboard shortcuts modal', async ({ capturePage }, testInfo) => {
    await navigateToPlayer(capturePage);
    await capturePage.keyboard.press('?');
    await animationSettle(capturePage, 400);

    const modal = capturePage.locator('[role="dialog"]');
    if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
      await captureElementScreenshot(capturePage, modal, 'keyboard-help-modal', testInfo);
    }

    await captureScreenshot(capturePage, 'keyboard-help', testInfo);
  });
});
