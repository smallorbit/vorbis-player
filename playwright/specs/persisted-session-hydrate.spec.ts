import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };

/**
 * Regression coverage for #1394 / #1478 — the persisted-session hydrate must
 * not flash a 0:00 / <duration> frame on the seek bar.
 *
 * The mock provider (#1477 / PR #1491) accepts `?mock-session=<base64-json>`
 * where the JSON is `{ trackId, positionMs }`. We seed ~45s into a fixture
 * track and, via an init script installed before any app code runs, watch
 * every mutation on the Radix seek-timeline slider thumb. The thumb mounts
 * disabled with `aria-valuemax="1"` (placeholder for `duration <= 0`) and
 * `aria-valuenow="0"`; the moment hydrate lands, both attributes update in
 * the same batch to the real duration and position.
 *
 * The assertion: the first frame where `aria-valuemax > 1` (real duration
 * present) must already carry `aria-valuenow ≈ 45000`. If the hydrate-flicker
 * regression returns — duration applied before position, or subscription
 * resetting position to 0 after hydrate consumes it — the first real-duration
 * frame would carry `aria-valuenow = 0` and the spec fails.
 */

const SEEK_TIMELINE_LABEL = 'Seek timeline';

const FIRST_REAL_FRAME_FLAG = '__vorbisFirstRealSeekFrame__' as const;

const SEED_POSITION_MS = 45_000;

/**
 * Pick a deterministic, mid-track fixture track:
 * - Must exist in the committed spotify-snapshot.json
 * - Duration > 60_000ms so SEED_POSITION_MS sits mid-track
 * - Selected by sorting all track ids ascending and taking the first that
 *   clears the duration floor. Deterministic across snapshot regenerations
 *   that preserve the same id set.
 */
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

interface FirstRealFrame {
  ariaValueNow: string | null;
  ariaValueMax: string | null;
  capturedAt: number;
}

test.describe('Persisted-session hydrate (no 0:00 flicker)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !seedTrack,
      'Spec requires a fixture track with durationMs > 60_000. Run `npm run snapshot:spotify` to populate playwright/fixtures/data/spotify-snapshot.json.',
    );

    // #given — install a MutationObserver before any page script runs. It
    // tracks every mount and attribute change on the seek-timeline slider
    // thumb (role="slider"), and snapshots the FIRST frame where the slider
    // carries a real duration (aria-valuemax > 1). That is the frame the
    // user first sees a meaningful timeline; if the flicker regresses, the
    // captured aria-valuenow will be 0 instead of ~45000.
    await page.addInitScript(
      ([flagName, labelText]: [string, string]) => {
        const isSeekSlider = (node: Element): boolean => {
          if (node.getAttribute('role') !== 'slider') return false;
          let cursor: Element | null = node;
          while (cursor) {
            if (cursor.getAttribute('aria-label') === labelText) return true;
            cursor = cursor.parentElement;
          }
          return false;
        };

        const tryCapture = (node: Element): void => {
          if (!isSeekSlider(node)) return;
          const win = window as unknown as Record<string, unknown>;
          if (win[flagName]) return;
          const valueMax = node.getAttribute('aria-valuemax');
          const parsedMax = valueMax !== null ? Number(valueMax) : NaN;
          // Skip the disabled placeholder frame (aria-valuemax="1") — that
          // exists by design while `duration <= 0` and is not the frame the
          // user sees a meaningful timeline.
          if (!Number.isFinite(parsedMax) || parsedMax <= 1) return;
          win[flagName] = {
            ariaValueNow: node.getAttribute('aria-valuenow'),
            ariaValueMax: valueMax,
            capturedAt: performance.now(),
          };
        };

        const scanSubtree = (root: Node): void => {
          if (root.nodeType !== Node.ELEMENT_NODE) return;
          const el = root as Element;
          tryCapture(el);
          el.querySelectorAll('[role="slider"]').forEach(tryCapture);
        };

        const observer = new MutationObserver((records) => {
          for (const record of records) {
            if (record.type === 'childList') {
              record.addedNodes.forEach(scanSubtree);
            } else if (record.type === 'attributes' && record.target.nodeType === Node.ELEMENT_NODE) {
              tryCapture(record.target as Element);
            }
          }
        });

        const start = (): void => {
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['role', 'aria-valuenow', 'aria-valuemax', 'aria-label'],
          });
        };
        if (document.documentElement) start();
        else document.addEventListener('DOMContentLoaded', start, { once: true });
      },
      [FIRST_REAL_FRAME_FLAG, SEEK_TIMELINE_LABEL],
    );
  });

  test('seek bar paints with the restored position on its first real-duration frame', async ({ page }) => {
    if (!seedTrack) return; // beforeEach already skipped.

    // #given — seed a session 45s into a known fixture track. mockProvider's
    // seedSessionFromUrlParam runs during the module's top-level eager import
    // (see src/main.tsx + src/providers/mock/mockProvider.ts), so the
    // SessionSnapshot is in localStorage before React mounts.
    const seed = encodeSeed(seedTrack.id, SEED_POSITION_MS);

    // #when — navigate.
    await page.goto(`/?mock-session=${seed}`);

    // #then — wait for the slider thumb to be attached, then read the first
    // real-duration frame captured by the init script. We don't poll for the
    // captured snapshot — the locator wait gives the observer a fair chance,
    // and toHaveAttribute below would catch any post-flicker settlement we
    // missed. The captured snapshot itself is asserted directly.
    const sliderLocator = page.locator(`[aria-label="${SEEK_TIMELINE_LABEL}"] [role="slider"]`);
    await sliderLocator.waitFor({ state: 'attached', timeout: 15_000 });

    // Give the observer one frame to record the first real-duration mutation.
    // toHaveAttribute auto-waits and is the project's idiomatic "settled
    // state" check; we use it on aria-valuemax (the real-duration signal) so
    // we only read the captured snapshot once the meaningful frame has
    // definitely been observed.
    await expect(sliderLocator).not.toHaveAttribute('aria-valuemax', '1', { timeout: 5_000 });

    const capture = await page.evaluate((flag) => {
      const win = window as unknown as Record<string, FirstRealFrame | undefined>;
      return win[flag] ?? null;
    }, FIRST_REAL_FRAME_FLAG);

    expect(capture, 'observer did not record a real-duration frame for the seek slider').not.toBeNull();
    if (!capture) return;

    const valueNow = capture.ariaValueNow !== null ? Number(capture.ariaValueNow) : NaN;
    const valueMax = capture.ariaValueMax !== null ? Number(capture.ariaValueMax) : NaN;

    expect(valueMax, 'aria-valuemax (duration) must be > 0 on the first real-duration frame').toBeGreaterThan(0);

    // Core assertion: the moment the seek bar first paints with a real
    // duration, the position must already reflect the seeded ~45_000ms. If
    // hydrate-flicker regresses (position resets to 0 before being consumed,
    // or hint isn't synchronous with duration application), this is where
    // the spec fails — captured aria-valuenow will be "0", not "~45000".
    expect(
      valueNow,
      'aria-valuenow must reflect the seeded position on the first real-duration frame (catches 0:00 flicker)',
    ).toBeGreaterThanOrEqual(SEED_POSITION_MS - 2_000);
    expect(
      valueNow,
      'aria-valuenow must not exceed the seeded position by more than a few seconds',
    ).toBeLessThanOrEqual(SEED_POSITION_MS + 5_000);
  });
});
