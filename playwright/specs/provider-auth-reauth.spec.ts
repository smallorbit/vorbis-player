import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requireLongTrack } from '../fixtures/require-snapshot';

/**
 * Re-prime after re-authentication
 *
 * See openspec/changes/reload-track-after-provider-reauth/. When a provider
 * transitions from `not authenticated` to `authenticated` while the queue's
 * current track belongs to that provider, the playback engine re-primes the
 * current track at SessionSnapshot.playbackPosition when the snapshot matches,
 * otherwise at the live PlaybackStore cursor (hydrate clears the session after
 * restore, so the store fallback is what keeps mid-track position across
 * re-auth).
 *
 * The spec seeds a non-zero playback position via `?mock-session=`, waits for
 * the hydrate path to paint the seek bar, then expires and restores the
 * spotify mock auth adapter. The seek bar SHALL stay near 45_000ms after the
 * re-prime, not snap back to 0.
 */

const SEEK_TIMELINE_LABEL = 'Seek timeline';
const SEED_POSITION_MS = 45_000;

const seedTrack = requireLongTrack(spotifySnapshot, 'spotify');

function encodeSeed(trackId: string, positionMs: number): string {
  const json = JSON.stringify({ trackId, positionMs });
  return Buffer.from(json, 'utf8').toString('base64');
}

test.describe('Provider re-authentication — re-prime current track at saved position', () => {
  test('seek bar updates from zeroed placeholder to seeded position after re-auth', async ({ page }) => {
    // #given — seed a session 45s into a spotify fixture track. mockProvider's
    // seedSessionFromUrlParam writes the full SessionSnapshot to localStorage
    // before React mounts, so the hydrate path primes the seek bar at 45s.
    const seed = encodeSeed(seedTrack.id, SEED_POSITION_MS);
    await page.goto(`/?mock-session=${seed}`);

    const sliderLocator = page.locator(`[aria-label="${SEEK_TIMELINE_LABEL}"] [role="slider"]`);
    await sliderLocator.waitFor({ state: 'attached', timeout: 15_000 });

    // Wait for the hydrate path to settle so the slider reflects the seeded
    // duration (not the disabled aria-valuemax=1 placeholder) and the live
    // PlaybackStore cursor is at the seeded position.
    await expect(sliderLocator).not.toHaveAttribute('aria-valuemax', '1', { timeout: 10_000 });
    await expect
      .poll(async () => Number(await sliderLocator.getAttribute('aria-valuenow')), { timeout: 5_000 })
      .toBeGreaterThanOrEqual(SEED_POSITION_MS - 2_000);

    // #when — expire the spotify mock auth adapter, then restore it. The
    // ProviderContext diff detects spotify transitioning `unauthed → authed`
    // and dispatches PROVIDER_RECONNECTED_EVENT; useProviderPlayback's
    // listener re-primes at the live PlaybackStore cursor (session was cleared
    // by hydrate's resetLastSession).
    await page.evaluate(async () => {
      const api = window.__mockTest;
      if (!api) throw new Error('window.__mockTest is not installed');
      await api.expireAuth('spotify');
    });

    // Wait until the adapter reports unauthenticated AND React has had a
    // frame to commit previousConnectedRef — a fixed 50ms yield was racing
    // the effect and sometimes skipped PROVIDER_RECONNECTED_EVENT (false green).
    await page.waitForFunction(
      () => window.__mockTest?.isAuthenticated('spotify') === false,
      undefined,
      { timeout: 5_000 },
    );
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );

    await page.evaluate(async () => {
      const api = window.__mockTest;
      if (!api) throw new Error('window.__mockTest is not installed');
      await api.restoreAuth('spotify');
    });

    // #then — aria-valuemax remains > 1 (real duration painted) and
    // aria-valuenow stays near the seeded position (re-prime kept the cursor).
    await expect(sliderLocator).not.toHaveAttribute('aria-valuemax', '1', { timeout: 5_000 });
    await expect
      .poll(async () => Number(await sliderLocator.getAttribute('aria-valuenow')), {
        timeout: 5_000,
        message: 'aria-valuenow must restore to the seeded playback position after re-auth re-prime',
      })
      .toBeGreaterThanOrEqual(SEED_POSITION_MS - 2_000);

    const valueMaxAttr = await sliderLocator.getAttribute('aria-valuemax');
    const valueNowAttr = await sliderLocator.getAttribute('aria-valuenow');
    const valueMax = valueMaxAttr !== null ? Number(valueMaxAttr) : NaN;
    const valueNow = valueNowAttr !== null ? Number(valueNowAttr) : NaN;

    expect(valueMax, 'aria-valuemax must reflect real duration after re-prime').toBeGreaterThan(1);
    expect(
      valueNow,
      'aria-valuenow must not exceed the seeded position by more than a few seconds',
    ).toBeLessThanOrEqual(SEED_POSITION_MS + 5_000);
  });
});
