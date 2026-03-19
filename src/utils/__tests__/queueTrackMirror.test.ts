import { describe, expect, it } from 'vitest';
import type { MediaTrack } from '@/types/domain';
import {
  appendMediaTracks,
  moveItemInArray,
  removeMediaTrackById,
  reorderMediaTracksToMatchTracks,
} from '../queueTrackMirror';

function m(id: string): MediaTrack {
  return {
    id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: `spotify:track:${id}` },
    name: id,
    artists: 'a',
    album: 'al',
    durationMs: 0,
  };
}

describe('reorderMediaTracksToMatchTracks', () => {
  it('returns null when media is empty', () => {
    expect(reorderMediaTracksToMatchTracks([{ id: 'a' }], [])).toBeNull();
  });

  it('returns null when lengths differ', () => {
    expect(reorderMediaTracksToMatchTracks([{ id: 'a' }], [m('a'), m('b')])).toBeNull();
  });

  it('returns null when a track id is missing from media', () => {
    expect(reorderMediaTracksToMatchTracks([{ id: 'a' }, { id: 'b' }], [m('a'), m('c')])).toBeNull();
  });

  it('reorders media to match tracks order', () => {
    const media = [m('x'), m('y'), m('z')];
    const tracks = [{ id: 'z' }, { id: 'x' }, { id: 'y' }];
    const out = reorderMediaTracksToMatchTracks(tracks, media);
    expect(out?.map((x) => x.id)).toEqual(['z', 'x', 'y']);
  });
});

describe('removeMediaTrackById', () => {
  it('removes by id', () => {
    expect(removeMediaTrackById([m('a'), m('b')], 'a').map((x) => x.id)).toEqual(['b']);
  });
});

describe('appendMediaTracks', () => {
  it('concatenates', () => {
    expect(appendMediaTracks([m('a')], [m('b')]).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('moveItemInArray', () => {
  it('moves item forward', () => {
    expect(moveItemInArray(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('moves item backward', () => {
    expect(moveItemInArray(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });
});
