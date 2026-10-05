import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import { openPlaylist, trackName } from '../fixtures/player';

const playlist = requirePlaylist(spotifySnapshot, 'spotify');

declare global {
  interface Window {
    __mediaSessionHandlers?: Map<string, MediaSessionActionHandler>;
  }
}

test.describe('Media Session @responsive', () => {
  test.beforeEach(async ({ page }) => {
    // The OS media controls cannot be pressed from a test, so record the
    // handlers the app registers and invoke them directly.
    await page.addInitScript(() => {
      const handlers = new Map<string, MediaSessionActionHandler>();
      window.__mediaSessionHandlers = handlers;
      const register = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
      navigator.mediaSession.setActionHandler = (action, handler) => {
        if (handler) handlers.set(action, handler);
        else handlers.delete(action);
        register(action, handler);
      };
    });
  });

  test('publishes the playing track to the OS media controls', async ({ page }) => {
    await openPlaylist(page, playlist.id);
    const name = await trackName(page).textContent();

    await expect.poll(() => page.evaluate(() => navigator.mediaSession.metadata?.title)).toBe(name?.trim());
    await expect.poll(() => page.evaluate(() => navigator.mediaSession.playbackState)).toBe('playing');
  });

  test('OS next/previous/pause/play drive the player', async ({ page }) => {
    await openPlaylist(page, playlist.id);
    const first = (await trackName(page).textContent())?.trim();
    const invoke = (action: MediaSessionAction) =>
      page.evaluate((a) => window.__mediaSessionHandlers?.get(a)?.({ action: a }), action);

    await invoke('nexttrack');
    await expect(trackName(page)).not.toHaveText(first ?? '', { timeout: 5_000 });
    await expect.poll(() => page.evaluate(() => navigator.mediaSession.metadata?.title)).not.toBe(first);

    await invoke('previoustrack');
    await expect(trackName(page)).toHaveText(first ?? '', { timeout: 5_000 });

    await invoke('pause');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 5_000 });
    await expect.poll(() => page.evaluate(() => navigator.mediaSession.playbackState)).toBe('paused');

    await invoke('play');
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 5_000 });
  });
});
