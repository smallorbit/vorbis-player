import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import dropboxSnapshot from '../fixtures/data/dropbox-snapshot.json' with { type: 'json' };

/**
 * CmdK library search (#1685 WS1 exit criterion).
 *
 * The palette searches the shared IndexedDB library cache, which is keyed by
 * (provider, id) and populated by every provider's catalog path — so search is
 * cross-provider by construction. Track lists enter the cache when a
 * collection is opened (write-through on listTracks), so each test opens a
 * collection first and then searches for one of its tracks.
 */

interface SnapshotTrack {
  name: string;
}

interface SnapshotCollection {
  id: string;
  name: string;
  trackIds: string[];
}

interface ProviderSnapshot {
  tracks: Record<string, SnapshotTrack>;
  playlists: SnapshotCollection[];
  albums: SnapshotCollection[];
}

function firstCollectionWithTrack(snapshot: ProviderSnapshot): {
  kind: 'playlist' | 'album';
  collection: SnapshotCollection;
  trackName: string;
} | null {
  const candidates: Array<{ kind: 'playlist' | 'album'; collection: SnapshotCollection }> = [
    ...snapshot.playlists.map((collection) => ({ kind: 'playlist' as const, collection })),
    ...snapshot.albums.map((collection) => ({ kind: 'album' as const, collection })),
  ];
  for (const candidate of candidates) {
    const trackId = candidate.collection.trackIds[0];
    const trackName = trackId ? snapshot.tracks[trackId]?.name : undefined;
    if (trackName) return { ...candidate, trackName };
  }
  return null;
}

const spotifyTarget = firstCollectionWithTrack(spotifySnapshot as unknown as ProviderSnapshot);
const dropboxTarget = firstCollectionWithTrack(dropboxSnapshot as unknown as ProviderSnapshot);

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
    test.skip(
      !spotifyTarget,
      'Specs require populated snapshots. Run `npm run snapshot:spotify` after curating `snapshot.config.json`.',
    );
    if (!spotifyTarget) return;

    await openCollectionAndReturnToPlayer(page, spotifyTarget.kind, spotifyTarget.collection.id);
    await searchInCmdK(page, spotifyTarget.trackName);

    await expect(
      page.locator('[data-testid="cmdk-item-track"]', { hasText: spotifyTarget.trackName }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('returns Dropbox tracks — search is cross-provider', async ({ page }) => {
    test.skip(
      !dropboxTarget,
      'Dropbox snapshot is empty. Run `npm run snapshot:dropbox` after curating `snapshot.config.json` to exercise the cross-provider search path.',
    );
    if (!dropboxTarget) return;

    await openCollectionAndReturnToPlayer(page, dropboxTarget.kind, dropboxTarget.collection.id);
    await searchInCmdK(page, dropboxTarget.trackName);

    await expect(
      page.locator('[data-testid="cmdk-item-track"]', { hasText: dropboxTarget.trackName }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
