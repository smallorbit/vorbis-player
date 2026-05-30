import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };

const hasContent = spotifySnapshot.playlists.length > 0;

test.describe('Auto-advance: natural-end signal', () => {
  test('advances to next track when provider transitions to paused at position zero', async ({ page }) => {
    // #given
    //
    // WHY THIS TEST SKIPS IN STOCK CI:
    // The committed `playwright/fixtures/data/spotify-snapshot.json` ships with an
    // empty `playlists` array so that no personal data is included in the repo.
    // `hasContent` is therefore `false` and `test.skip` fires before any browser
    // interaction — the test always passes silently (as "skipped") in CI.
    //
    // TO ENABLE THIS TEST:
    // 1. Start the dev server: `npm run dev`
    // 2. Enumerate your library: `npm run snapshot:spotify -- --list`
    //    (opens Chromium, log in once, press Enter — prints playlist IDs)
    // 3. Edit `playwright/fixtures/data/snapshot.config.json` with your chosen IDs
    // 4. Generate the snapshot: `npm run snapshot:spotify`
    // 5. Re-run: `npm run test:e2e`
    //
    // See #1564 and CLAUDE.md §"Curating fixtures" for full instructions.
    test.skip(
      !hasContent,
      'Specs require populated snapshots. Run `npm run snapshot:spotify -- --list` to enumerate your library, populate `snapshot.config.json`, then `npm run snapshot:spotify`. See #1564.',
    );

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
