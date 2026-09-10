import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requireCollections } from '../fixtures/require-snapshot';

requireCollections(spotifySnapshot, 'spotify');

test.describe('Auto-advance: natural-end signal', () => {
  test('advances to next track when provider transitions to paused at position zero', async ({ page }) => {
    // #given
    await page.goto('/');
    await page.locator('[data-testid="library-home"]').waitFor({ state: 'visible', timeout: 30_000 });

    // Load a playlist so the queue has ≥ 2 tracks and playback starts
    await page.locator('[data-testid^="library-card-playlist-"]').first().click();
    await page.locator('[data-testid="player-track-info-name"]').waitFor({ state: 'visible', timeout: 10_000 });

    // Wait until the adapter has emitted isPlaying: true so that wasPlayingRef is
    // set to true before triggerNaturalEnd fires. The Pause aria-label is only
    // present when the player is actively playing.
    await page.locator('button[aria-label="Pause"]').waitFor({ state: 'visible', timeout: 10_000 });

    // Capture the currently playing track name
    const firstTrackName = await page.locator('[data-testid="player-track-info-name"]').textContent();

    // #when — trigger the natural-end signal (paused @ position 0 with stale lastPlayTime)
    await page.evaluate(() => window.__mockTest!.triggerNaturalEnd('spotify'));

    // #then — the player advances to the next track (track name changes)
    await expect(page.locator('[data-testid="player-track-info-name"]')).not.toHaveText(firstTrackName ?? '', { timeout: 10_000 });
  });
});
