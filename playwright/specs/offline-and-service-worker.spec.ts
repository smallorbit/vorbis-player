import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import { openPlaylist } from '../fixtures/player';
import { expectNoAxeViolations } from '../fixtures/axe';

const playlist = requirePlaylist(spotifySnapshot, 'spotify');

test.describe('Offline handling @responsive', () => {
  test('shows an offline toast, then confirms reconnection', async ({ page, context }) => {
    await openPlaylist(page, playlist.id);

    await context.setOffline(true);
    const offlineToast = page.getByText("You're offline. Library sync is paused until you reconnect.");
    await expect(offlineToast).toBeVisible({ timeout: 5_000 });
    await expectNoAxeViolations(page, { include: '[data-sonner-toaster]' });

    await context.setOffline(false);
    await expect(page.getByText('Back online')).toBeVisible({ timeout: 5_000 });
    await expect(offlineToast).toBeHidden();
  });
});

test.describe('Service worker', () => {
  test('the generated worker activates with a build-manifest precache', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="library-home"]').waitFor({ state: 'visible', timeout: 30_000 });

    const cacheNames = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      return caches.keys();
    });

    expect(cacheNames.some((name) => name.startsWith('workbox-precache'))).toBe(true);
    expect(cacheNames.filter((name) => name.startsWith('vap-'))).toEqual([]);
  });
});
