import { test, expect } from '../fixtures/auth-state';
import spotifySnapshot from '../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import { requirePlaylist } from '../fixtures/require-snapshot';
import {
  dragQueueRow,
  enableQueueEdit,
  openPlaylist,
  openQueue,
  queueOrder,
} from '../fixtures/player';

/**
 * Queue mutation had no e2e coverage at all, and #1644 shipped three defects
 * here at once: a collection-load race, shuffled-add order corruption, and
 * drag-reorder id instability. These assert the user-visible outcome — the
 * order of the rows after the mutation — rather than the handler being called.
 */

const playlist = requirePlaylist(spotifySnapshot, 'spotify');

test.describe('Queue mutation', () => {
  test.beforeEach(async ({ page }) => {
    await openPlaylist(page, playlist.id);
    await openQueue(page);
    await enableQueueEdit(page);
  });

  test('removing a track drops it from the queue and keeps the rest in order', async ({ page }) => {
    // #given - the queue as loaded from the playlist
    const before = await queueOrder(page);
    expect(before.length).toBeGreaterThan(2);
    const removedIndex = 1;
    const removed = before[removedIndex]!;

    // #when - the user removes that row
    const rows = page.locator('[data-testid="queue-track-row"]');
    await rows.nth(removedIndex).getByRole('button', { name: /^Remove / }).first().click();

    // #then - the queue is exactly the original minus that track, order preserved
    await expect(rows).toHaveCount(before.length - 1, { timeout: 5_000 });
    const after = await queueOrder(page);
    expect(after).toEqual(before.filter((_, i) => i !== removedIndex));
    expect(after).not.toContain(removed);
  });

  test('drag-reordering moves the dragged track to its new position', async ({ page }) => {
    // #given - the queue as loaded from the playlist
    const before = await queueOrder(page);
    expect(before.length).toBeGreaterThan(2);

    // #when - the user drags row 2 above row 1
    await dragQueueRow(page, 2, 1);

    // #then - the two rows have swapped and nothing else moved
    const expected = [...before];
    const [moved] = expected.splice(2, 1);
    expected.splice(1, 0, moved!);
    await expect.poll(() => queueOrder(page), { timeout: 5_000 }).toEqual(expected);
  });
});
