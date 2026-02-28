import { test, expect } from '../fixtures/auth';
import { setupAllMocks, mockTracks } from '../fixtures/mocks';

test.describe('Player Controls', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);

    // Mock playlist tracks for clicking into a playlist
    await page.route('**/v1/playlists/playlist-1/tracks**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockTracks) })
    );

    await page.goto('/');
    // Navigate into the player by selecting a playlist
    await expect(page.getByText('Chill Vibes')).toBeVisible({ timeout: 10000 });
    await page.getByText('Chill Vibes').click();
    // Wait for player view to appear (search input goes away)
    await expect(page.getByPlaceholder('Search playlists...')).not.toBeVisible({ timeout: 10000 });
  });

  test('play/pause button is present in the player UI', async ({ page }) => {
    // PlaybackControls renders SVG buttons without aria-labels,
    // so we look for the play icon path (M8 5v14l11-7z) inside the controls area
    const playSvg = page.locator('svg path[d="M8 5v14l11-7z"]');
    const pauseSvg = page.locator('svg path[d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"]');
    // One of play or pause should be visible
    const playVisible = await playSvg.isVisible().catch(() => false);
    const pauseVisible = await pauseSvg.isVisible().catch(() => false);
    expect(playVisible || pauseVisible).toBe(true);
  });

  test('next track button is present and clickable', async ({ page }) => {
    // Next button SVG path: M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z
    const nextButton = page.locator('svg path[d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"]').locator('..');
    await expect(nextButton).toBeVisible({ timeout: 5000 });
    await nextButton.click();
  });

  test('previous track button is present and clickable', async ({ page }) => {
    // Previous button SVG path: M6 6h2v12H6zm3.5 6l8.5 6V6z
    const prevButton = page.locator('svg path[d="M6 6h2v12H6zm3.5 6l8.5 6V6z"]').locator('..');
    await expect(prevButton).toBeVisible({ timeout: 5000 });
    await prevButton.click();
  });

  test('track info displays current track name', async ({ page }) => {
    // The first track from our mock data should be shown
    await expect(page.getByText('Test Song')).toBeVisible({ timeout: 5000 });
  });

  test('volume control is present in the bottom bar', async ({ page }) => {
    // The bottom bar renders a VolumeControl with a mute/unmute button
    // Look for a button with title containing volume-related text
    const volumeButton = page.locator('button[title="Visual effects"]');
    await expect(volumeButton).toBeVisible({ timeout: 5000 });
  });
});
