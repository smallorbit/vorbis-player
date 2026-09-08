import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import { openPlaylist, trackName } from '../fixtures/player';

/**
 * useLikeTrack flips isLiked optimistically and only re-reads isTrackSaved when
 * the track changes, so a spec that clicks like and checks the icon proves the
 * optimistic path alone — it passes even when the adapter write is dropped
 * (verified by mutation). The round-trip test below navigates away and back so
 * the read-back effect runs against the provider's liked set.
 */

const playlist = requirePlaylist(spotifySnapshot, 'spotify');
const likedIds = new Set(spotifySnapshot.likedTrackIds);

// The specs open the playlist at its head, so it is the FIRST track that must
// start out unliked for the opening click to mean "like".
const firstStartsUnliked = !likedIds.has(playlist.trackIds[0]!);

const LIKE = { name: 'Add to Liked Songs' };
const UNLIKE = { name: 'Remove from Liked Songs' };

test.describe('Liked tracks', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!firstStartsUnliked, "The fixture playlist's first track is already liked.");
    await openPlaylist(page, playlist.id);
  });

  test('liking a track flips the control to its liked state', async ({ page }) => {
    // #given - the current track is not liked
    const like = page.getByRole('button', LIKE);
    await expect(like).toBeVisible({ timeout: 15_000 });

    // #when - the user likes it
    await like.click();

    // #then - the control reads back as liked from the catalog adapter
    await expect(page.getByRole('button', UNLIKE)).toBeVisible({ timeout: 10_000 });
  });

  test('unliking restores the unliked state', async ({ page }) => {
    // #given - a track the user has just liked
    await page.getByRole('button', LIKE).click();
    await expect(page.getByRole('button', UNLIKE)).toBeVisible({ timeout: 10_000 });

    // #when - the user unlikes it
    await page.getByRole('button', UNLIKE).click();

    // #then - the control returns to its unliked state
    await expect(page.getByRole('button', LIKE)).toBeVisible({ timeout: 10_000 });
  });

  test('liked state is per-track, not sticky across a track change', async ({ page }) => {
    // #given - the first track is liked
    const before = await trackName(page).textContent();
    await page.getByRole('button', LIKE).click();
    await expect(page.getByRole('button', UNLIKE)).toBeVisible({ timeout: 10_000 });

    // #when - the user moves to the next track
    await page.getByRole('button', { name: 'Next track' }).click();
    await expect(trackName(page)).not.toHaveText(before ?? '', { timeout: 10_000 });

    // #then - the control reflects the new track, not the previous one's state
    const nextId = playlist.trackIds[1]!;
    const expected = likedIds.has(nextId) ? UNLIKE : LIKE;
    await expect(page.getByRole('button', expected)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Liked tracks — persistence', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!firstStartsUnliked, "The fixture playlist's first track is already liked.");
    await openPlaylist(page, playlist.id);
  });

  test('a like survives navigating away and back', async ({ page }) => {
    // #given - the first track is liked
    const first = await trackName(page).textContent();
    await page.getByRole('button', LIKE).click();
    await expect(page.getByRole('button', UNLIKE)).toBeVisible({ timeout: 10_000 });

    // #when - the user leaves the track and returns, forcing a re-read
    await page.getByRole('button', { name: 'Next track' }).click();
    await expect(trackName(page)).not.toHaveText(first ?? '', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Previous track' }).click();
    await expect(trackName(page)).toHaveText(first ?? '', { timeout: 10_000 });

    // #then - the like was actually written through, not just painted locally
    await expect(page.getByRole('button', UNLIKE)).toBeVisible({ timeout: 10_000 });
  });
});
