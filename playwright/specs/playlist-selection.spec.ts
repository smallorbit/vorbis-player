import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };

const hasPlaylists = spotifySnapshot.playlists.length > 0;
const hasAlbums = spotifySnapshot.albums.length > 0;
const hasContent = hasPlaylists || hasAlbums;

async function navigateToLibrary(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('[data-testid="library-home"]').waitFor({ state: 'visible', timeout: 30_000 });
}

test.describe('Playlist Selection', () => {
  test('shows library UI when authenticated', async ({ page }) => {
    test.skip(
      !hasContent,
      'Specs require populated snapshots. Run `npm run snapshot:spotify -- --list` to enumerate your library, populate `snapshot.config.json`, then `npm run snapshot:spotify`. See #1372 §10 ("Curating fixtures").',
    );
    await navigateToLibrary(page);
    await expect(page.getByText('Connect Spotify')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="library-home"]')).toBeVisible({ timeout: 5000 });
  });

  test('renders playlist tiles when snapshot has playlists', async ({ page }) => {
    if (!hasPlaylists) {
      test.skip(true, 'Snapshot has no playlists — skipping playlist-render test');
      return;
    }
    await navigateToLibrary(page);
    await expect(page.locator('[data-testid^="library-card-playlist-"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a playlist tile navigates to the player view', async ({ page }) => {
    if (!hasPlaylists) {
      test.skip(true, 'Snapshot has no playlists — skipping playlist-click test');
      return;
    }
    await navigateToLibrary(page);
    await page.locator('[data-testid^="library-card-playlist-"]').first().click();
    await expect(page.locator('[data-testid="library-home"]')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button[title^="Zen Mode"]')).toBeVisible({ timeout: 10_000 });
  });

  test('renders album tiles when snapshot has albums', async ({ page }) => {
    if (!hasAlbums) {
      test.skip(true, 'Snapshot has no albums — skipping album-render test');
      return;
    }
    await navigateToLibrary(page);
    await expect(page.locator('[data-testid^="library-card-album-"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('library section renders without auth errors', async ({ page }) => {
    test.skip(
      !hasContent,
      'Specs require populated snapshots. Run `npm run snapshot:spotify -- --list` to enumerate your library, populate `snapshot.config.json`, then `npm run snapshot:spotify`. See #1372 §10 ("Curating fixtures").',
    );
    await navigateToLibrary(page);
    await expect(page.locator('[data-testid="library-home"]')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Connect Spotify')).not.toBeVisible();
    await expect(page.getByText('Connect Dropbox')).not.toBeVisible();
  });
});
