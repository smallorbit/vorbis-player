import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };

/**
 * Re-prime after re-authentication
 *
 * See openspec/changes/reload-track-after-provider-reauth/. When a provider
 * transitions from `not authenticated` to `authenticated` while the queue's
 * current track belongs to that provider, the playback engine re-primes the
 * current track at the persisted SessionSnapshot.playbackPosition (or 0 if
 * the snapshot's trackId does not match).
 *
 * The spec seeds a non-zero playback position via the existing
 * `?mock-session=` URL param (which writes SessionSnapshot.playbackPosition
 * to localStorage), waits for `useSessionPersistence` to debounce-save the
 * post-hydrate snapshot so the in-memory state and on-disk snapshot agree,
 * then expires the spotify mock auth adapter and restores it. The seek bar
 * SHALL return to ~45_000ms after the re-prime, not snap back to 0.
 */

const SEEK_TIMELINE_LABEL = 'Seek timeline';
const SEED_POSITION_MS = 45_000;
// useSessionPersistence DEBOUNCE_MS=1000; wait a hair longer to be safe.
const SESSION_DEBOUNCE_SETTLE_MS = 1_500;

type SnapshotTrack = (typeof spotifySnapshot)['tracks'][keyof (typeof spotifySnapshot)['tracks']];

function pickSeedTrack(): SnapshotTrack | null {
  const entries = Object.entries(spotifySnapshot.tracks as Record<string, SnapshotTrack>);
  const sorted = entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [, track] of sorted) {
    if (track.durationMs > 60_000) return track;
  }
  return null;
}

const seedTrack = pickSeedTrack();

function encodeSeed(trackId: string, positionMs: number): string {
  const json = JSON.stringify({ trackId, positionMs });
  return Buffer.from(json, 'utf8').toString('base64');
}

test.describe('Provider re-authentication — re-prime current track at saved position', () => {
  test.beforeEach(() => {
    test.skip(
      !seedTrack,
      'Spec requires a fixture track with durationMs > 60_000. Run `npm run snapshot:spotify`.',
    );
  });

  test('seek bar updates from zeroed placeholder to seeded position after re-auth', async ({ page }) => {
    if (!seedTrack) return;

    // #given — seed a session 45s into a spotify fixture track. mockProvider's
    // seedSessionFromUrlParam writes the full SessionSnapshot to localStorage
    // before React mounts, so the hydrate path primes the seek bar at 45s.
    const seed = encodeSeed(seedTrack.id, SEED_POSITION_MS);
    await page.goto(`/?mock-session=${seed}`);

    const sliderLocator = page.locator(`[aria-label="${SEEK_TIMELINE_LABEL}"] [role="slider"]`);
    await sliderLocator.waitFor({ state: 'attached', timeout: 15_000 });

    // Wait for the hydrate path to settle so the slider reflects the seeded
    // duration (not the disabled aria-valuemax=1 placeholder).
    await expect(sliderLocator).not.toHaveAttribute('aria-valuemax', '1', { timeout: 10_000 });

    // useSessionPersistence debounces saves by 1s — wait long enough that the
    // post-hydrate snapshot (with playbackPosition=45000) is committed to
    // localStorage. The re-prime handler reads via loadSession(), so the
    // on-disk value must reflect the in-memory state before we re-auth.
    await page.waitForTimeout(SESSION_DEBOUNCE_SETTLE_MS);

    // #when — expire the spotify mock auth adapter, then restore it. The
    // ProviderContext diff detects spotify transitioning `unauthed → authed`
    // and dispatches PROVIDER_RECONNECTED_EVENT; useProviderPlayback's
    // listener re-primes the current track at SessionSnapshot.playbackPosition.
    await page.evaluate(async () => {
      await window.__mockTest!.expireAuth('spotify');
    });

    // Yield once so React processes the AUTH_STATE_CHANGED_EVENT and the
    // ProviderContext effect commits previousConnectedRef = { dropbox } before
    // the restore flips it back — otherwise the diff sees no `false` baseline
    // for spotify and the restoration is a no-op.
    await page.waitForTimeout(50);

    await page.evaluate(async () => {
      await window.__mockTest!.restoreAuth('spotify');
    });

    // #then — aria-valuemax remains > 1 (real duration painted) and
    // aria-valuenow is within ±2s of the seeded position (the re-prime
    // restored the cursor to where the user left off, not 0:00).
    await expect(sliderLocator).not.toHaveAttribute('aria-valuemax', '1', { timeout: 5_000 });

    const valueMaxAttr = await sliderLocator.getAttribute('aria-valuemax');
    const valueNowAttr = await sliderLocator.getAttribute('aria-valuenow');
    const valueMax = valueMaxAttr !== null ? Number(valueMaxAttr) : NaN;
    const valueNow = valueNowAttr !== null ? Number(valueNowAttr) : NaN;

    expect(valueMax, 'aria-valuemax must reflect real duration after re-prime').toBeGreaterThan(1);
    expect(
      valueNow,
      'aria-valuenow must restore to the seeded playback position after re-auth re-prime',
    ).toBeGreaterThanOrEqual(SEED_POSITION_MS - 2_000);
    expect(
      valueNow,
      'aria-valuenow must not exceed the seeded position by more than a few seconds',
    ).toBeLessThanOrEqual(SEED_POSITION_MS + 5_000);
  });
});
