import { test } from '../fixtures';
import { navigateToPlayer, openPlaylistDrawer, captureScreenshot } from '../helpers';

test.describe('Playlist Drawer', () => {
  test('capture playlist drawer', async ({ capturePage }, testInfo) => {
    await navigateToPlayer(capturePage);
    await openPlaylistDrawer(capturePage);
    await captureScreenshot(capturePage, 'playlist-drawer', testInfo);
  });
});
