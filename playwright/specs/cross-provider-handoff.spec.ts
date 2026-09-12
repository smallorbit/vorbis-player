import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import dropboxSnapshot from '../fixtures/data/dropbox-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import { openPlaylist, openQueue, queueOrder, trackName } from '../fixtures/player';

/**
 * playback-engine, "Cross-Provider Handoff" and "Control Routing to Driving
 * Provider". This is the app's headline capability and had no e2e at all —
 * the committed Dropbox snapshot was empty, so every mixed-queue path resolved
 * to nothing and skipped.
 *
 * The mixed queue is built the way a user builds one: load a Spotify playlist,
 * then "Play Next" a Dropbox album from the library. Nothing here uses
 * __mockTest.setQueue, which leaves the engine's track list and the drawer's
 * disagreeing (see fixtures/player.ts).
 */

const playlist = requirePlaylist(spotifySnapshot, 'spotify');
const dropboxAlbum = dropboxSnapshot.albums[0]!;
const dropboxTrackNames = dropboxAlbum.trackIds.map(
  (id) => dropboxSnapshot.tracks[id as keyof typeof dropboxSnapshot.tracks]!.name,
);
const firstDropboxTrack = dropboxTrackNames[0]!;

/**
 * Both providers' playback state, straight from their adapters.
 *
 * The handoff requirement is "only one provider produces audio", and that is
 * invisible from the DOM — the player chrome only ever reflects the driving
 * provider, so a queue that advanced across a provider boundary looks identical
 * whether or not the outgoing provider is still playing. Deleting the pause in
 * pausePreviousProvider left every DOM-level assertion here green.
 */
async function providerPlayback(page: Page): Promise<{
  spotify: { isPlaying: boolean; trackId: string | null };
  dropbox: { isPlaying: boolean; trackId: string | null };
}> {
  return page.evaluate(async () => ({
    spotify: await window.__mockTest!.getPlaybackState('spotify'),
    dropbox: await window.__mockTest!.getPlaybackState('dropbox'),
  }));
}

async function queueDropboxAlbumNext(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Back to Library' }).click();
  await page.locator('[data-testid="library-home"]').waitFor({ state: 'visible', timeout: 15_000 });

  await page.locator(`[data-testid="library-card-album-${dropboxAlbum.id}"]`).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Play Next' }).click();

  // Back to the player: while a track plays the library shows a mini-player.
  await page.locator('[data-testid="mini-expand"]').click();
  await trackName(page).waitFor({ state: 'visible', timeout: 15_000 });
}

test.describe('Cross-provider handoff', () => {
  test.beforeEach(async ({ page }) => {
    await openPlaylist(page, playlist.id);
    await page.locator('button[aria-label="Pause"]').waitFor({ state: 'visible', timeout: 15_000 });
  });

  test('a Dropbox album can be queued into a Spotify queue', async ({ page }) => {
    // #given - a queue of Spotify tracks
    await openQueue(page);
    const spotifyOnly = await queueOrder(page);
    expect(spotifyOnly.some((row) => row.includes(firstDropboxTrack))).toBe(false);
    await page.keyboard.press('Escape');

    // #when - the user queues a Dropbox album next
    await queueDropboxAlbumNext(page);

    // #then - the queue now holds tracks from both providers
    await openQueue(page);
    const mixed = await queueOrder(page);
    expect(mixed.some((row) => row.includes(firstDropboxTrack))).toBe(true);
    expect(mixed.length).toBeGreaterThan(spotifyOnly.length);
  });

  test('advancing into a Dropbox track hands playback over', async ({ page }) => {
    // #given - a Spotify track playing ahead of a queued Dropbox album
    const spotifyTrack = (await trackName(page).textContent())?.trim();
    await queueDropboxAlbumNext(page);

    // #when - the user advances past the end of the Spotify track
    await page.getByRole('button', { name: 'Next track' }).click();

    // #then - the Dropbox track is now the one playing
    await expect(trackName(page)).toHaveText(firstDropboxTrack, { timeout: 15_000 });
    expect(spotifyTrack).not.toBe(firstDropboxTrack);

    // ...and playback continues, so the incoming provider took over rather than
    // both stalling
    await expect(page.locator('button[aria-label="Pause"]')).toBeVisible({ timeout: 15_000 });

    // ...and Spotify was paused as Dropbox took over: exactly one provider is
    // producing audio, which is the requirement the DOM cannot show.
    await expect.poll(async () => (await providerPlayback(page)).dropbox.isPlaying, {
      timeout: 15_000,
    }).toBe(true);
    const state = await providerPlayback(page);
    expect(state.spotify.isPlaying, 'outgoing provider was left playing').toBe(false);
  });

  test('transport controls follow the driving provider back across the boundary', async ({ page }) => {
    // #given - playback handed over to Dropbox
    const spotifyTrack = (await trackName(page).textContent())?.trim();
    await queueDropboxAlbumNext(page);
    await page.getByRole('button', { name: 'Next track' }).click();
    await expect(trackName(page)).toHaveText(firstDropboxTrack, { timeout: 15_000 });

    // #when - the user presses previous while Dropbox is driving
    await page.getByRole('button', { name: 'Previous track' }).click();

    // #then - control routes back to the Spotify track rather than stalling on
    // the provider that was driving a moment ago
    await expect(trackName(page)).toHaveText(spotifyTrack ?? '', { timeout: 15_000 });

    // ...and the handoff reverses cleanly: Dropbox stops, Spotify drives again.
    await expect.poll(async () => (await providerPlayback(page)).spotify.isPlaying, {
      timeout: 15_000,
    }).toBe(true);
    const state = await providerPlayback(page);
    expect(state.dropbox.isPlaying, 'outgoing provider was left playing').toBe(false);
  });
});
