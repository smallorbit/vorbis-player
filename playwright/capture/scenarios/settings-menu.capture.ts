import { test } from '../fixtures';
import { navigateToPlayer, openSettingsMenu, captureScreenshot } from '../helpers';

test.describe('Settings Menu', () => {
  test('capture settings menu', async ({ capturePage }, testInfo) => {
    await navigateToPlayer(capturePage);
    await openSettingsMenu(capturePage);
    await captureScreenshot(capturePage, 'settings-menu', testInfo);
  });
});
