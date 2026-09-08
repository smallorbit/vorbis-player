import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import { openPlaylist, openQueue, queueOrder, trackName } from '../fixtures/player';

/**
 * Radio generation had no e2e: the pipeline and matcher are unit-tested, but
 * nothing exercised "press the button, get a queue of real catalog tracks".
 *
 * Last.fm is stubbed at the network boundary. The config gives the dev server a
 * placeholder VITE_LASTFM_API_KEY so isLastFmConfigured() renders the control in
 * CI, and every ws.audioscrobbler.com request is fulfilled from the fixture — no
 * key is ever sent and the test cannot flake on a third party.
 */

const playlist = requirePlaylist(spotifySnapshot, 'spotify');
const allTracks = Object.values(spotifySnapshot.tracks);

/** Tracks the matcher should resolve, drawn from the catalog but outside the seed playlist. */
const suggestions = allTracks
  .filter((t) => !playlist.trackIds.includes(t.id))
  .slice(0, 12);

async function stubLastFm(page: Page): Promise<void> {
  await page.route('**ws.audioscrobbler.com**', async (route) => {
    const method = new URL(route.request().url()).searchParams.get('method');

    if (method === 'track.getsimilar') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          similartracks: {
            track: suggestions.map((t, i) => ({
              name: t.name,
              mbid: '',
              match: 1 - i * 0.05,
              artist: { name: t.artists[0]!.name, mbid: '' },
            })),
          },
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ similarartists: { artist: [] } }),
    });
  });
}

test.describe('Radio', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(suggestions.length === 0, 'Fixture has no tracks outside the seed playlist.');
    await stubLastFm(page);
    await openPlaylist(page, playlist.id);
  });

  test('the radio control is available once a track is playing', async ({ page }) => {
    // #then - the seedable control renders (gated on isLastFmConfigured)
    await expect(page.getByRole('button', { name: 'Generate radio playlist from current track' }))
      .toBeVisible({ timeout: 15_000 });
  });

  test('generating radio replaces the queue with matched catalog tracks', async ({ page }) => {
    // #given - a playlist queue and the track that seeds the radio
    await openQueue(page);
    const before = await queueOrder(page);
    const seed = (await trackName(page).textContent())?.trim();
    await page.keyboard.press('Escape');

    // #when - the user generates radio from the current track
    await page.getByRole('button', { name: 'Generate radio playlist from current track' }).click();

    // #then - the queue becomes the radio queue, not the original playlist
    await openQueue(page);
    await expect
      .poll(async () => (await queueOrder(page)).join('|') !== before.join('|'), { timeout: 20_000 })
      .toBe(true);

    // ...and it is built from tracks the matcher resolved against the catalog,
    // which the seed playlist did not contain
    const after = await queueOrder(page);
    const suggestionNames = suggestions.map((t) => t.name);
    expect(after.some((row) => suggestionNames.some((n) => row.includes(n)))).toBe(true);
    expect(seed).toBeTruthy();
  });
});
