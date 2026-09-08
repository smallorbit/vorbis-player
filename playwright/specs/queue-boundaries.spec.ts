import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import { advanceTo, openPlaylist, trackName } from '../fixtures/player';

/**
 * Manual next/previous must treat the queue as finite (playback-engine spec,
 * "Manual Navigation Queue Boundaries"). This shipped broken twice — #1627 fixed
 * wrapping and #1646 had to fix it again — because the only transport coverage
 * exercised next/prev mid-queue, where wrapping is invisible.
 */

const playlist = requirePlaylist(spotifySnapshot, 'spotify');
const names = playlist.trackIds.map(
  (id) => spotifySnapshot.tracks[id as keyof typeof spotifySnapshot.tracks].name,
);
const firstName = names[0]!;
const lastName = names[names.length - 1]!;

test.describe('Queue boundaries — manual next/previous do not wrap', () => {
  test.beforeEach(async ({ page }) => {
    await openPlaylist(page, playlist.id);
    await expect(trackName(page)).toHaveText(firstName, { timeout: 15_000 });
  });

  test('next on the last track is a no-op', async ({ page }) => {
    // #given - the queue is walked to its last track through the real transport
    await advanceTo(page, lastName, names.length);

    // #when - the user invokes next at the queue's end
    await page.getByRole('button', { name: 'Next track' }).click();

    // #then - the current track is unchanged; it must not wrap to the first track
    await expect(trackName(page)).not.toHaveText(firstName, { timeout: 5_000 });
    await expect(trackName(page)).toHaveText(lastName);
  });

  test('previous on the first track restarts it instead of wrapping', async ({ page }) => {
    // #given - the first track of the queue is current (loaded by beforeEach)
    // #when - the user invokes previous at the queue's start
    await page.getByRole('button', { name: 'Previous track' }).click();

    // #then - the first track stays current; it must not wrap to the last track
    await expect(trackName(page)).not.toHaveText(lastName, { timeout: 5_000 });
    await expect(trackName(page)).toHaveText(firstName);
  });
});
