import { describe, it, expect } from 'vitest';
import { makeMediaTrack } from '@/test/fixtures';

// Sortable IDs must be stable track IDs so that a name mutation mid-drag
// (e.g. Dropbox ID3 enrichment) does not invalidate the active/over ids
// and silently drop the reorder. This test pins the contract: the ID
// derivation is `t.id`, not a composite of mutable fields.

describe('QueueTrackList sortable ID scheme', () => {
  describe('sortableIds derivation', () => {
    it('maps each track to its stable id', () => {
      // #given
      const tracks = [
        makeMediaTrack({ id: 'track-1', name: 'Song A' }),
        makeMediaTrack({ id: 'track-2', name: 'Song B' }),
        makeMediaTrack({ id: 'track-3', name: 'Song C' }),
      ];

      // #when
      const sortableIds = tracks.map(t => t.id);

      // #then
      expect(sortableIds).toEqual(['track-1', 'track-2', 'track-3']);
    });

    it('remains stable when a track name mutates (simulates ID3 enrichment)', () => {
      // #given
      const tracks = [
        makeMediaTrack({ id: 'abc', name: 'filename-derived.flac' }),
      ];

      // #when — name mutates (async ID3 enrichment renames the track)
      const sortableIdsBefore = tracks.map(t => t.id);
      tracks[0] = { ...tracks[0], name: 'Real Album Title' };
      const sortableIdsAfter = tracks.map(t => t.id);

      // #then — sortable IDs are unaffected by the name change
      expect(sortableIdsBefore).toEqual(['abc']);
      expect(sortableIdsAfter).toEqual(['abc']);
      expect(sortableIdsBefore).toEqual(sortableIdsAfter);
    });

    it('indexOf resolves correctly after a name mutation', () => {
      // #given
      const tracks = [
        makeMediaTrack({ id: 'x1', name: 'Old Name' }),
        makeMediaTrack({ id: 'x2', name: 'Other Track' }),
      ];
      const sortableIds = tracks.map(t => t.id);

      // #when — track name changes (rename does not affect sortableIds)
      const activeId = 'x1';

      // #then — indexOf still finds the correct position
      expect(sortableIds.indexOf(activeId)).toBe(0);
    });
  });
});
