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
    // "Shows library UI" must mean a *populated* library — the container alone
    // renders even when the catalog fails to load. Assert at least one real
    // collection tile is present so an empty-shell regression fails here.
    await expect(page.locator('[data-testid^="library-card-"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('renders playlist tiles bound to real snapshot data', async ({ page }) => {
    if (!hasPlaylists) {
      test.skip(true, 'Snapshot has no playlists — skipping playlist-render test');
      return;
    }
    const firstPlaylist = spotifySnapshot.playlists[0];
    if (!firstPlaylist) return;

    await navigateToLibrary(page);

    // Target the tile for a specific snapshot playlist by id and assert it
    // renders that playlist's real name. A presence-only check ("some card is
    // visible") would pass on an empty-shell/placeholder card that lost its
    // data binding; asserting the name proves the catalog data reached the DOM.
    const card = page.locator(`[data-testid="library-card-playlist-${firstPlaylist.id}"]`);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText(firstPlaylist.name);
  });

  test('clicking a playlist tile loads that playlist into the player', async ({ page }) => {
    if (!hasPlaylists) {
      test.skip(true, 'Snapshot has no playlists — skipping playlist-click test');
      return;
    }
    await navigateToLibrary(page);
    await page.locator('[data-testid^="library-card-playlist-"]').first().click();

    // Navigating away from the library is necessary but not sufficient — the
    // player view must actually load a track from the selected playlist. Assert
    // the transport chrome appears AND the now-playing track name is populated,
    // proving the click drove real playback state, not merely a route change.
    await expect(page.locator('[data-testid="library-home"]')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button[title^="Zen Mode"]')).toBeVisible({ timeout: 10_000 });
    const trackName = page.locator('[data-testid="player-track-info-name"]');
    await expect(trackName).toBeVisible({ timeout: 15_000 });
    await expect(trackName).not.toHaveText('');
  });

  test('renders album tiles bound to real snapshot data', async ({ page }) => {
    if (!hasAlbums) {
      test.skip(true, 'Snapshot has no albums — skipping album-render test');
      return;
    }
    const firstAlbum = spotifySnapshot.albums[0];
    if (!firstAlbum) return;

    await navigateToLibrary(page);

    // As above: assert the specific album tile renders its real name, not just
    // that a card element exists.
    const card = page.locator(`[data-testid="library-card-album-${firstAlbum.id}"]`);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText(firstAlbum.name);
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
