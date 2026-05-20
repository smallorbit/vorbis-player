/**
 * Auto-advance on natural track end (Requirement 4 — openspec/specs/playback-engine/spec.md)
 *
 * Covers the "natural-end signal" branch: driving provider transitions from
 * playing to paused at position zero. The mock adapter's audio.loop=true
 * prevents this from happening via real audio playback, so we use
 * window.__mockTest.simulateNaturalEnd() to emit the synthetic signal
 * deterministically.
 *
 * See issue #1564 for context.
 */
import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };

type SnapshotTrack = (typeof spotifySnapshot)['tracks'][string];

const SEEK_TIMELINE_LABEL = 'Seek timeline';

function pickTwoDistinctTracks(): [SnapshotTrack, SnapshotTrack] | null {
  // Prefer albums — they reliably contain multiple in-order tracks
  for (const album of spotifySnapshot.albums) {
    if (album.trackIds.length >= 2) {
      const t1 = (spotifySnapshot.tracks as Record<string, SnapshotTrack>)[album.trackIds[0]];
      const t2 = (spotifySnapshot.tracks as Record<string, SnapshotTrack>)[album.trackIds[1]];
      if (t1 && t2 && t1.name !== t2.name) return [t1, t2];
    }
  }
  // Fall back to playlists
  for (const playlist of spotifySnapshot.playlists) {
    if (playlist.trackIds.length >= 2) {
      const t1 = (spotifySnapshot.tracks as Record<string, SnapshotTrack>)[playlist.trackIds[0]];
      const t2 = (spotifySnapshot.tracks as Record<string, SnapshotTrack>)[playlist.trackIds[1]];
      if (t1 && t2 && t1.name !== t2.name) return [t1, t2];
    }
  }
  return null;
}

function encodeSeed(trackId: string, positionMs: number): string {
  const json = JSON.stringify({ trackId, positionMs });
  return Buffer.from(json, 'utf8').toString('base64');
}

const twoTracks = pickTwoDistinctTracks();

test.describe('Auto-Advance on Track End — natural-end signal', () => {
  test.beforeEach(() => {
    test.skip(
      !twoTracks,
      'Spec requires at least 2 distinct tracks in the spotify snapshot. Run `npm run snapshot:spotify`.',
    );
  });

  test('natural-end signal advances queue to the next track', async ({ page }) => {
    if (!twoTracks) return;
    const [track1, track2] = twoTracks;

    // #given — seed the player at track1 position 0 so the hydrate flow
    // primes the adapter with currentTrack=track1 before we expand the queue.
    const seed = encodeSeed(track1.id, 0);
    await page.goto(`/?mock-session=${seed}`);

    // Wait for the player to hydrate (seek slider signals the adapter is primed)
    const sliderLocator = page.locator(`[aria-label="${SEEK_TIMELINE_LABEL}"] [role="slider"]`);
    await sliderLocator.waitFor({ state: 'attached', timeout: 15_000 });

    // Expand the queue so track2 is at index 1
    await page.evaluate(async (ids: string[]) => {
      await window.__mockTest!.setQueue(ids);
    }, [track1.id, track2.id]);

    // Ensure the adapter's currentTrack is track1 (needed for simulateNaturalEnd)
    await page.evaluate(async (trackId: string) => {
      await window.__mockTest!.setPlaybackState({ trackId, positionMs: 0, isPlaying: true });
    }, track1.id);

    // Allow React state to settle before asserting and triggering advance
    await page.waitForTimeout(200);

    const trackNameLocator = page.locator('[data-testid="player-track-info-name"]').first();
    await expect(trackNameLocator).toHaveText(track1.name, { timeout: 5_000 });

    // #when — emit a synthetic natural-end signal on the spotify adapter
    await page.evaluate(async () => {
      await window.__mockTest!.simulateNaturalEnd('spotify');
    });

    // #then — the engine auto-advances to track2 (AUTO_ADVANCE_DELAY_MS = 100 ms)
    await expect(trackNameLocator).toHaveText(track2.name, { timeout: 5_000 });
  });
});
