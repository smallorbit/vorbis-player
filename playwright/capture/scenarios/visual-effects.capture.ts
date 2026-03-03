import { test } from '../fixtures';
import { navigateToPlayer, captureScreenshot, animationSettle } from '../helpers';

test.describe('Visual Effects', () => {
  test('capture glow effect', async ({ capturePage }, testInfo) => {
    await navigateToPlayer(capturePage);
    await capturePage.keyboard.press('g');
    await animationSettle(capturePage, 2500);
    await captureScreenshot(capturePage, 'visual-glow', testInfo);
  });

  test('capture background visualizer', async ({ capturePage }, testInfo) => {
    await navigateToPlayer(capturePage);
    await capturePage.keyboard.press('v');
    await animationSettle(capturePage, 2500);
    await captureScreenshot(capturePage, 'visual-visualizer', testInfo);
  });

  test('capture translucence effect', async ({ capturePage }, testInfo) => {
    await navigateToPlayer(capturePage);
    await capturePage.keyboard.press('t');
    await animationSettle(capturePage, 2500);
    await captureScreenshot(capturePage, 'visual-translucence', testInfo);
  });
});
