import { test } from '../fixtures';
import { navigateToPlayer, openLibraryDrawer, captureScreenshot, animationSettle } from '../helpers';

test.describe('Library Drawer', () => {
  test('capture library drawer - playlists', async ({ capturePage }, testInfo) => {
    await navigateToPlayer(capturePage);
    await openLibraryDrawer(capturePage);
    await captureScreenshot(capturePage, 'library-drawer-playlists', testInfo);
  });

  test('capture library drawer - albums tab', async ({ capturePage }, testInfo) => {
    await navigateToPlayer(capturePage);
    await openLibraryDrawer(capturePage);

    const albumsTab = capturePage.getByRole('tab', { name: /albums/i });
    if (await albumsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await albumsTab.click();
      await animationSettle(capturePage, 400);
    }

    await captureScreenshot(capturePage, 'library-drawer-albums', testInfo);
  });
});
