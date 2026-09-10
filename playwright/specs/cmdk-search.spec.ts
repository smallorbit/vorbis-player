import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import dropboxSnapshot from '../fixtures/data/dropbox-snapshot.json' with { type: 'json' };
import { requireCollectionWithTrack } from '../fixtures/require-snapshot';

/**
 * CmdK library search (#1685 WS1 exit criterion).
 *
 * The palette searches the shared IndexedDB library cache, which is keyed by
 * (provider, id) and populated by every provider's catalog path — so search is
 * cross-provider by construction. Track lists enter the cache when a
 * collection is opened (write-through on listTracks), so each test opens a
 * collection first and then searches for one of its tracks.
 */

const spotifyTarget = requireCollectionWithTrack(spotifySnapshot, 'spotify');
const dropboxTarget = requireCollectionWithTrack(dropboxSnapshot, 'dropbox');

async function openCollectionAndReturnToPlayer(
  page: Page,
  kind: 'playlist' | 'album',
  collectionId: string,
): Promise<void> {
  await page.goto('/');
  await page.locator('[data-testid="library-home"]').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator(`[data-testid="library-card-${kind}-${collectionId}"]`).click();
  // Wait for the player to take over — proves the collection's tracks were
  // fetched (and therefore written through to the library cache).
  await expect(page.locator('[data-testid="library-home"]')).not.toBeVisible({ timeout: 10_000 });
  await expect(page.locator('button[title^="Zen Mode"]')).toBeVisible({ timeout: 10_000 });
}

async function searchInCmdK(page: Page, query: string): Promise<void> {
  await page.keyboard.press('Control+k');
  const input = page.getByPlaceholder('Start typing to search your library');
  await expect(input).toBeVisible({ timeout: 5_000 });
  await input.fill(query);
}

test.describe('CmdK library search', () => {
  test('returns tracks from an opened collection', async ({ page }) => {
    await openCollectionAndReturnToPlayer(page, spotifyTarget.kind, spotifyTarget.collection.id);
    await searchInCmdK(page, spotifyTarget.trackName);

    await expect(
      page.locator('[data-testid="cmdk-item-track"]', { hasText: spotifyTarget.trackName }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('returns Dropbox tracks — search is cross-provider', async ({ page }) => {
    await openCollectionAndReturnToPlayer(page, dropboxTarget.kind, dropboxTarget.collection.id);
    await searchInCmdK(page, dropboxTarget.trackName);

    await expect(
      page.locator('[data-testid="cmdk-item-track"]', { hasText: dropboxTarget.trackName }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
