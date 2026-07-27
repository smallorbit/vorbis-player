import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queueStore } from '@/stores/queueStore';
import type { MediaTrack } from '@/types/domain';

function makeTrack(id: string, provider: 'spotify' | 'dropbox' = 'spotify'): MediaTrack {
  return {
    id,
    provider,
    playbackRef: { provider, ref: `ref-${id}` },
    name: `Track ${id}`,
    artists: 'Artist',
    album: 'Album',
    durationMs: 1000,
    genres: [],
  };
}

const t = (ids: string[]) => ids.map((id) => makeTrack(id));
const idsOf = (tracks: MediaTrack[]) => tracks.map((track) => track.id);

describe('queueStore', () => {
  beforeEach(() => {
    queueStore.__resetForTests();
  });

  describe('replaceQueue / loadQueue', () => {
    it('replaceQueue sets tracks verbatim with defaulted originalTracks and index', () => {
      // #when
      queueStore.replaceQueue(t(['a', 'b', 'c']), { currentIndex: 2 });

      // #then
      const snap = queueStore.getSnapshot();
      expect(idsOf(snap.tracks)).toEqual(['a', 'b', 'c']);
      expect(idsOf(snap.originalTracks)).toEqual(['a', 'b', 'c']);
      expect(snap.currentIndex).toBe(2);
    });

    it('loadQueue keeps collection order when shuffle is off', () => {
      // #when
      queueStore.loadQueue(t(['a', 'b', 'c']));

      // #then
      const snap = queueStore.getSnapshot();
      expect(idsOf(snap.tracks)).toEqual(['a', 'b', 'c']);
      expect(snap.currentIndex).toBe(0);
    });

    it('loadQueue with forceShuffle keeps originalTracks in collection order', () => {
      // #when
      queueStore.loadQueue(t(['a', 'b', 'c', 'd', 'e']), { forceShuffle: true });

      // #then — same membership, original order preserved for restore
      const snap = queueStore.getSnapshot();
      expect(idsOf(snap.tracks).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
      expect(idsOf(snap.originalTracks)).toEqual(['a', 'b', 'c', 'd', 'e']);
    });
  });

  describe('addTracks — the single append/dedupe/shuffle invariant (F24)', () => {
    it('appends to the end, deduping against the existing queue', () => {
      // #given
      queueStore.replaceQueue(t(['a', 'b']));

      // #when — one dup, two new
      const { added } = queueStore.addTracks(t(['b', 'c', 'd']), { position: 'end' });

      // #then
      expect(added).toBe(2);
      expect(idsOf(queueStore.getTracks())).toEqual(['a', 'b', 'c', 'd']);
      expect(idsOf(queueStore.getSnapshot().originalTracks)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('returns added: 0 and mutates nothing when every track is a duplicate', () => {
      // #given
      queueStore.replaceQueue(t(['a', 'b']));
      const before = queueStore.getSnapshot();

      // #when
      const { added } = queueStore.addTracks(t(['a', 'b']), { position: 'next' });

      // #then
      expect(added).toBe(0);
      expect(queueStore.getSnapshot()).toBe(before);
    });

    it('inserts after the current track for position: next', () => {
      // #given
      queueStore.replaceQueue(t(['a', 'b', 'c']), { currentIndex: 1 });

      // #when
      queueStore.addTracks(t(['x', 'y']), { position: 'next' });

      // #then
      expect(idsOf(queueStore.getTracks())).toEqual(['a', 'b', 'x', 'y', 'c']);
      expect(queueStore.getCurrentIndex()).toBe(1);
    });

    it('populates an empty queue regardless of position', () => {
      // #when
      const { added } = queueStore.addTracks(t(['x', 'y']), { position: 'next' });

      // #then
      expect(added).toBe(2);
      expect(idsOf(queueStore.getTracks())).toEqual(['x', 'y']);
      expect(queueStore.getCurrentIndex()).toBe(0);
    });

    it('while shuffle is ON, appends only the new tracks to originalTracks (restore order intact)', () => {
      // #given — original order a,b,c ; play order shuffled to c,a,b
      queueStore.replaceQueue(t(['a', 'b', 'c']));
      queueStore.toggleShuffle();
      const playOrderBefore = idsOf(queueStore.getTracks());

      // #when — insert-next two new tracks
      queueStore.addTracks(t(['x', 'y']), { position: 'next' });

      // #then — originalTracks is the true unshuffled order + new tracks at the end
      const snap = queueStore.getSnapshot();
      expect(idsOf(snap.originalTracks)).toEqual(['a', 'b', 'c', 'x', 'y']);
      // and the play order got the insertion after the current track
      const insertAt = queueStore.getCurrentIndex() + 1;
      expect(idsOf(snap.tracks).slice(insertAt, insertAt + 2)).toEqual(['x', 'y']);
      expect(idsOf(snap.tracks)).toHaveLength(5);
      expect(playOrderBefore).toHaveLength(3);
    });
  });

  describe('removeTrackAt', () => {
    it('removes by index and decrements currentIndex when removing before it', () => {
      // #given
      queueStore.replaceQueue(t(['a', 'b', 'c']), { currentIndex: 2 });

      // #when
      const removed = queueStore.removeTrackAt(0);

      // #then
      expect(removed?.id).toBe('a');
      expect(idsOf(queueStore.getTracks())).toEqual(['b', 'c']);
      expect(queueStore.getCurrentIndex()).toBe(1);
      expect(idsOf(queueStore.getSnapshot().originalTracks)).toEqual(['b', 'c']);
    });

    it('keeps currentIndex when removing after it and returns null out of bounds', () => {
      // #given
      queueStore.replaceQueue(t(['a', 'b', 'c']), { currentIndex: 0 });

      // #when / #then
      expect(queueStore.removeTrackAt(2)?.id).toBe('c');
      expect(queueStore.getCurrentIndex()).toBe(0);
      expect(queueStore.removeTrackAt(99)).toBeNull();
      expect(queueStore.removeTrackAt(-1)).toBeNull();
    });
  });

  describe('removeTracksByProvider', () => {
    it('follows the playing track when it survives', () => {
      // #given — playing c (index 2); a and b are dropbox
      queueStore.replaceQueue([
        makeTrack('a', 'dropbox'),
        makeTrack('b', 'dropbox'),
        makeTrack('c', 'spotify'),
        makeTrack('d', 'dropbox'),
      ], { currentIndex: 2 });

      // #when
      const { remaining } = queueStore.removeTracksByProvider('dropbox');

      // #then — c is now index 0
      expect(remaining).toBe(1);
      expect(idsOf(queueStore.getTracks())).toEqual(['c']);
      expect(queueStore.getCurrentIndex()).toBe(0);
    });

    it('resets to index 0 when the playing track is removed', () => {
      // #given — playing b (dropbox)
      queueStore.replaceQueue([
        makeTrack('a', 'spotify'),
        makeTrack('b', 'dropbox'),
        makeTrack('c', 'spotify'),
      ], { currentIndex: 1 });

      // #when
      queueStore.removeTracksByProvider('dropbox');

      // #then
      expect(idsOf(queueStore.getTracks())).toEqual(['a', 'c']);
      expect(queueStore.getCurrentIndex()).toBe(0);
    });

    it('clears everything when no tracks survive', () => {
      // #given
      queueStore.replaceQueue([makeTrack('a', 'dropbox')], { currentIndex: 0 });

      // #when
      const { remaining } = queueStore.removeTracksByProvider('dropbox');

      // #then
      expect(remaining).toBe(0);
      expect(queueStore.getTracks()).toEqual([]);
    });
  });

  describe('reorderTrack', () => {
    it('moves a track and follows the playing track', () => {
      // #given — playing b
      queueStore.replaceQueue(t(['a', 'b', 'c']), { currentIndex: 1 });

      // #when — move a to the end
      queueStore.reorderTrack(0, 2);

      // #then
      expect(idsOf(queueStore.getTracks())).toEqual(['b', 'c', 'a']);
      expect(queueStore.getCurrentIndex()).toBe(0);
      // originalTracks tracks the manual order while shuffle is off
      expect(idsOf(queueStore.getSnapshot().originalTracks)).toEqual(['b', 'c', 'a']);
    });

    it('leaves originalTracks untouched while shuffle is on', () => {
      // #given
      queueStore.replaceQueue(t(['a', 'b', 'c']));
      queueStore.toggleShuffle();
      const originalBefore = idsOf(queueStore.getSnapshot().originalTracks);

      // #when
      queueStore.reorderTrack(0, 2);

      // #then
      expect(idsOf(queueStore.getSnapshot().originalTracks)).toEqual(originalBefore);
    });

    it('ignores out-of-bounds and no-op moves', () => {
      // #given
      queueStore.replaceQueue(t(['a', 'b']));
      const before = queueStore.getSnapshot();

      // #when / #then
      queueStore.reorderTrack(0, 0);
      queueStore.reorderTrack(-1, 1);
      queueStore.reorderTrack(0, 5);
      expect(queueStore.getSnapshot()).toBe(before);
    });
  });

  describe('shuffle toggle', () => {
    it('enabling keeps the playing track first; disabling restores original order and index', () => {
      // #given — playing b
      queueStore.replaceQueue(t(['a', 'b', 'c', 'd']), { currentIndex: 1 });

      // #when
      queueStore.toggleShuffle();

      // #then — current track pinned first, flag on
      let snap = queueStore.getSnapshot();
      expect(snap.shuffle).toBe(true);
      expect(snap.tracks[0]?.id).toBe('b');
      expect(snap.currentIndex).toBe(0);
      expect(idsOf(snap.originalTracks)).toEqual(['a', 'b', 'c', 'd']);

      // #when — toggle back off
      queueStore.toggleShuffle();

      // #then — original order restored, index follows the playing track
      snap = queueStore.getSnapshot();
      expect(snap.shuffle).toBe(false);
      expect(idsOf(snap.tracks)).toEqual(['a', 'b', 'c', 'd']);
      expect(snap.currentIndex).toBe(1);
    });

    it('restore-on-unshuffle uses live track objects, not stale originals', () => {
      // #given — shuffle on, then a track is enriched (e.g. artwork resolved)
      queueStore.replaceQueue(t(['a', 'b', 'c']));
      queueStore.toggleShuffle();
      queueStore.mapTracks((track) => (track.id === 'b' ? { ...track, image: 'art.jpg' } : track));

      // #when
      queueStore.toggleShuffle();

      // #then — restored order keeps the enriched object
      const restored = queueStore.getTracks().find((track) => track.id === 'b');
      expect(restored?.image).toBe('art.jpg');
    });

    it('is a no-op when nothing is loaded', () => {
      // #when
      queueStore.toggleShuffle();

      // #then
      expect(queueStore.getSnapshot().shuffle).toBe(false);
    });
  });

  describe('index sync and enrichment', () => {
    it('syncIndexToTrackId points the index at the matching track', () => {
      // #given
      queueStore.replaceQueue(t(['a', 'b', 'c']));

      // #when / #then
      expect(queueStore.syncIndexToTrackId('c')).toBe(2);
      expect(queueStore.getCurrentIndex()).toBe(2);
      expect(queueStore.syncIndexToTrackId('nope')).toBe(-1);
      expect(queueStore.getCurrentIndex()).toBe(2);
    });

    it('mapTracks notifies only when a track actually changed', () => {
      // #given
      queueStore.replaceQueue(t(['a', 'b']));
      const listener = vi.fn();
      queueStore.subscribe(listener);

      // #when — identity mapper
      queueStore.mapTracks((track) => track);

      // #then
      expect(listener).not.toHaveBeenCalled();

      // #when — real change
      queueStore.mapTracks((track) => (track.id === 'a' ? { ...track, image: 'x' } : track));

      // #then
      expect(listener).toHaveBeenCalledTimes(1);
      expect(queueStore.getTracks()[0]?.image).toBe('x');
    });

    it('getCurrentTrack derives from tracks and currentIndex', () => {
      // #given
      expect(queueStore.getCurrentTrack()).toBeNull();
      queueStore.replaceQueue(t(['a', 'b']), { currentIndex: 1 });

      // #then
      expect(queueStore.getCurrentTrack()?.id).toBe('b');
    });
  });

  describe('subscribe', () => {
    it('notifies on mutation and stops after unsubscribe', () => {
      // #given
      const listener = vi.fn();
      const unsubscribe = queueStore.subscribe(listener);

      // #when
      queueStore.replaceQueue(t(['a']));
      unsubscribe();
      queueStore.clear();

      // #then
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
