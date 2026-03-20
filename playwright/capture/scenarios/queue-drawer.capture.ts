import { test } from '../fixtures';
import { navigateToPlayer, captureScreenshot, animationSettle } from '../helpers';

test.describe('Queue Drawer', () => {
  test('capture queue drawer', async ({ capturePage }, testInfo) => {
    await navigateToPlayer(capturePage);
    await capturePage.keyboard.press('q');
    await animationSettle(capturePage, 600);
    await captureScreenshot(capturePage, 'queue-drawer', testInfo);
  });
});
