import { test } from '../fixtures';
import { navigateToPlayer, enterZenMode, captureScreenshot } from '../helpers';

test.describe('Zen Mode', () => {
  test('capture zen mode', async ({ capturePage }, testInfo) => {
    await navigateToPlayer(capturePage);
    await enterZenMode(capturePage);
    await captureScreenshot(capturePage, 'zen-mode', testInfo);
  });
});
