import { test } from '../fixtures';
import { navigateToPlayer, captureScreenshot, animationSettle } from '../helpers';

test.describe('Player Main', () => {
  test('capture main player view', async ({ capturePage }, testInfo) => {
    await navigateToPlayer(capturePage);
    await animationSettle(capturePage, 1000);
    await captureScreenshot(capturePage, 'player-main', testInfo);
  });
});
