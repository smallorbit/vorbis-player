import { test, expect } from '../fixtures/auth';
import { setupSpotifyApiMocks, setupSpotifySdkMock, setupPlaybackApiMocks, mockTracks } from '../fixtures/mocks';

test.describe('Playlist Selection', () => {
  test.beforeEach(async ({ page }) => {
    await setupSpotifyApiMocks(page);
    await setupSpotifySdkMock(page);
    await setupPlaybackApiMocks(page);
  });

  test('shows playlist selection UI when authenticated', async ({ page }) => {
    await page.goto('/');
    // Should not show the "Connect Spotify" auth screen
    await expect(page.getByText('Connect Spotify')).not.toBeVisible({ timeout: 5000 });
    // Should show the playlist selection search input
    await expect(page.getByPlaceholder('Search playlists...')).toBeVisible({ timeout: 10000 });
  });

  test('renders playlists from mocked API response', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Chill Vibes')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Workout Mix')).toBeVisible();
  });

  test('clicking a playlist navigates to the player view', async ({ page }) => {
    // Mock playlist tracks endpoint for the specific playlist
    await page.route('**/v1/playlists/playlist-1/tracks**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockTracks) })
    );

    await page.goto('/');
    await expect(page.getByText('Chill Vibes')).toBeVisible({ timeout: 10000 });
    await page.getByText('Chill Vibes').click();

    // After selecting a playlist, the search input should disappear (player view replaces it)
    await expect(page.getByPlaceholder('Search playlists...')).not.toBeVisible({ timeout: 10000 });
  });

  test('search input filters the playlist list', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Chill Vibes')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Workout Mix')).toBeVisible();

    await page.getByPlaceholder('Search playlists...').fill('Chill');

    await expect(page.getByText('Chill Vibes')).toBeVisible();
    await expect(page.getByText('Workout Mix')).not.toBeVisible();
  });

  test('switching to Albums tab renders album items', async ({ page }) => {
    await page.goto('/');
    // Wait for playlists to load first
    await expect(page.getByText('Chill Vibes')).toBeVisible({ timeout: 10000 });

    // Click the Albums tab
    await page.getByRole('button', { name: /Albums/i }).click();

    // Album items should appear
    await expect(page.getByText('Test Album')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Another Album')).toBeVisible();
  });
});
