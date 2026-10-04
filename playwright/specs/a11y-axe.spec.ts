import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import { openPlaylist, openQueue } from '../fixtures/player';
import { expectNoAxeViolations } from '../fixtures/axe';

const playlist = requirePlaylist(spotifySnapshot, 'spotify');

test.describe('Accessibility — axe WCAG 2.1 AA @responsive', () => {
  test('library home', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="library-home"]').waitFor({ state: 'visible', timeout: 30_000 });

    await expectNoAxeViolations(page);
  });

  test('player', async ({ page }) => {
    await openPlaylist(page, playlist.id);

    await expectNoAxeViolations(page);
  });

  test('queue', async ({ page }) => {
    await openPlaylist(page, playlist.id);
    await openQueue(page);

    await expectNoAxeViolations(page, { include: '[role="dialog"]' });
  });

  test('app settings', async ({ page }) => {
    await openPlaylist(page, playlist.id);
    await page.getByRole('button', { name: 'App settings' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    await expectNoAxeViolations(page, { include: '[role="dialog"]' });
  });

  test('keyboard help', async ({ page }) => {
    await openPlaylist(page, playlist.id);
    await page.keyboard.press('Slash');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    await expectNoAxeViolations(page, { include: '[role="dialog"]' });
  });
});
