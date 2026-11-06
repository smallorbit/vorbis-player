import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import { openPlaylist, openQueue } from '../fixtures/player';

const playlist = requirePlaylist(spotifySnapshot, 'spotify');

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

test.describe('Content Security Policy @responsive', () => {
  test('preview serves the vercel.json policy, enforced', async ({ page }) => {
    const response = await page.goto('/');
    const policy = response?.headers()['content-security-policy'] ?? '';

    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toMatch(/script-src 'self' https:\/\/sdk\.scdn\.co(;|$)/);
    for (const origin of [
      'https://api.spotify.com',
      'https://accounts.spotify.com',
      'https://api.dropboxapi.com',
      'https://content.dropboxapi.com',
      'https://ws.audioscrobbler.com',
    ]) {
      expect(policy).toContain(origin);
    }
  });

  test('connect-src covers every cross-origin image and script host', async ({ page }) => {
    // The service worker is served this same policy, and everything it
    // proxies goes through fetch() — governed by connect-src, not by
    // img-src/script-src. Violations there never reach the page, so the
    // lists must be kept aligned explicitly.
    const response = await page.goto('/');
    const policy = response?.headers()['content-security-policy'] ?? '';
    const directive = (name: string): string[] =>
      policy
        .split(';')
        .map((part) => part.trim().split(/\s+/))
        .find(([key]) => key === name)
        ?.slice(1) ?? [];

    const connectSources = directive('connect-src');
    const crossOriginFetchedHosts = [...directive('img-src'), ...directive('script-src')].filter(
      (source) => source.startsWith('https://'),
    );
    const isCovered = (host: string): boolean =>
      connectSources.includes(host) ||
      connectSources.some(
        (source) => source.startsWith('https://*.') && host.endsWith(source.slice('https://*'.length)),
      );

    expect(crossOriginFetchedHosts.filter((host) => !isCovered(host))).toEqual([]);
  });

  test('browsing, skipping tracks, and opening the queue raise no violations', async ({ page }) => {
    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        window.__cspViolations?.push(`${event.effectiveDirective} ${event.blockedURI}`);
      });
    });

    await openPlaylist(page, playlist.id);
    await page.getByRole('button', { name: 'Next track' }).click();
    await openQueue(page);

    const violations = await page.evaluate(() => window.__cspViolations ?? []);
    expect(violations).toEqual([]);
  });
});
