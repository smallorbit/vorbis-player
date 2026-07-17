import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };

const hasContent = spotifySnapshot.playlists.length > 0;

// Transport controls expose stable aria-labels ("Previous track", "Play"/"Pause",
// "Next track") — assert those and the behavior behind them, not SVG path data.
test.describe('Player Controls', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasContent,
      'Specs require populated snapshots. Run `npm run snapshot:spotify -- --list` to enumerate your library, populate `snapshot.config.json`, then `npm run snapshot:spotify`. See #1372 §10 ("Curating fixtures").',
    );
    await page.goto('/');
    await page.locator('[data-testid="library-home"]').waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator('[data-testid^="library-card-playlist-"]').first().click();
    await page.locator('[data-testid="player-track-info-name"]').waitFor({ state: 'visible', timeout: 15_000 });
  });

  test('play/pause button toggles playing state', async ({ page }) => {
    // The play/pause control's aria-label reflects the state: "Pause" while
    // playing, "Play" while paused. Clicking it must flip that state.
    const playPause = page.getByRole('button', { name: /^(Play|Pause)$/ });
    await expect(playPause).toBeVisible({ timeout: 5000 });

    const before = await playPause.getAttribute('aria-label');
    await playPause.click();
    await expect(playPause).not.toHaveAttribute('aria-label', before!, { timeout: 5000 });

    // ...and toggling back returns to the original state.
    await playPause.click();
    await expect(playPause).toHaveAttribute('aria-label', before!, { timeout: 5000 });
  });

  test('next track button advances to a different track', async ({ page }) => {
    const trackName = page.locator('[data-testid="player-track-info-name"]');
    const before = await trackName.textContent();

    await page.getByRole('button', { name: 'Next track' }).click();

    // The displayed track name must change — not merely that the button was clickable.
    await expect(trackName).not.toHaveText(before ?? '', { timeout: 5000 });
  });

  test('previous track returns to the prior track', async ({ page }) => {
    const trackName = page.locator('[data-testid="player-track-info-name"]');
    const first = await trackName.textContent();

    // Advance, then go back — the round-trip must land on the original track.
    await page.getByRole('button', { name: 'Next track' }).click();
    await expect(trackName).not.toHaveText(first ?? '', { timeout: 5000 });

    await page.getByRole('button', { name: 'Previous track' }).click();
    await expect(trackName).toHaveText(first ?? '', { timeout: 5000 });
  });

  test('track info displays a non-empty current track name', async ({ page }) => {
    const trackName = page.locator('[data-testid="player-track-info-name"]');
    await expect(trackName).toBeVisible({ timeout: 5000 });
    await expect(trackName).not.toHaveText('');
  });

  test('volume control opens its popover on click', async ({ page }) => {
    // The bottom bar renders a real volume control: a button (aria-label="Volume")
    // whose aria-pressed reflects the open state of its slider popover. (The prior
    // version of this test asserted the App Settings button instead — it never
    // touched volume at all.)
    const volumeButton = page.locator('button[aria-label="Volume"]');
    await expect(volumeButton).toBeVisible({ timeout: 5000 });
    await expect(volumeButton).toHaveAttribute('aria-pressed', 'false');

    await volumeButton.click();
    await expect(volumeButton).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });
  });
});
