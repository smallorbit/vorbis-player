import { describe, it, expect } from 'vitest';
import {
  normalizeForMatching,
  buildIndexes,
  matchTrack,
  findTracksByArtist,
} from '../catalogMatcher';
import type { MediaTrack } from '@/types/domain';
import type { LastFmSimilarTrack } from '@/types/radio';

function makeTrack(overrides: Partial<MediaTrack> & { name: string; artists: string }): MediaTrack {
  return {
    id: overrides.id ?? `track-${overrides.name}`,
    provider: 'dropbox',
    playbackRef: { provider: 'dropbox', ref: `/music/${overrides.name}.mp3` },
    album: overrides.album ?? 'Test Album',
    durationMs: 200000,
    ...overrides,
  };
}

describe('normalizeForMatching', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeForMatching('Björk')).toBe('bjork');
    expect(normalizeForMatching('Café')).toBe('cafe');
  });

  it('strips parentheticals', () => {
    expect(normalizeForMatching('Creep (Remastered)')).toBe('creep');
    expect(normalizeForMatching('Song (feat. Artist)')).toBe('song');
  });

  it('strips brackets', () => {
    expect(normalizeForMatching('Album [Deluxe Edition]')).toBe('album');
  });

  it('strips trailing suffixes', () => {
    expect(normalizeForMatching('Track - Single')).toBe('track');
    expect(normalizeForMatching('Track - EP')).toBe('track');
    expect(normalizeForMatching('Track - Remix')).toBe('track');
  });

  it('strips non-alphanumeric characters', () => {
    expect(normalizeForMatching("Don't Stop Me Now")).toBe('dontstopmenow');
    expect(normalizeForMatching('Rock & Roll')).toBe('rockroll');
  });

  it('handles empty string', () => {
    expect(normalizeForMatching('')).toBe('');
  });
});

describe('buildIndexes', () => {
  it('indexes tracks by recording MBID', () => {
    const track = makeTrack({
      name: 'Creep',
      artists: 'Radiohead',
      musicbrainzRecordingId: 'rec-123',
    });

    const indexes = buildIndexes([track]);
    expect(indexes.byRecordingMbid.get('rec-123')).toBe(track);
  });

  it('indexes tracks by artist MBID', () => {
    const t1 = makeTrack({
      id: 't1',
      name: 'Creep',
      artists: 'Radiohead',
      musicbrainzArtistId: 'artist-123',
    });
    const t2 = makeTrack({
      id: 't2',
      name: 'OK Computer',
      artists: 'Radiohead',
      musicbrainzArtistId: 'artist-123',
    });

    const indexes = buildIndexes([t1, t2]);
    expect(indexes.byArtistMbid.get('artist-123')).toHaveLength(2);
  });

  it('indexes tracks by normalized key', () => {
    const track = makeTrack({ name: 'Fake Plastic Trees', artists: 'Radiohead' });
    const indexes = buildIndexes([track]);

    const key = normalizeForMatching('Radiohead') + '||' + normalizeForMatching('Fake Plastic Trees');
    expect(indexes.byNormalizedKey.get(key)?.[0]).toBe(track);
  });

  it('indexes tracks by normalized artist', () => {
    const track = makeTrack({ name: 'Creep', artists: 'Radiohead' });
    const indexes = buildIndexes([track]);

    expect(indexes.byNormalizedArtist.get('radiohead')?.[0]).toBe(track);
  });
});

describe('matchTrack', () => {
  const trackWithMbid = makeTrack({
    id: 'with-mbid',
    name: 'Fake Plastic Trees',
    artists: 'Radiohead',
    musicbrainzRecordingId: 'rec-abc',
  });
  const trackWithoutMbid = makeTrack({
    id: 'no-mbid',
    name: 'Paranoid Android',
    artists: 'Radiohead',
  });

  const indexes = buildIndexes([trackWithMbid, trackWithoutMbid]);

  it('matches by MBID when available', () => {
    const candidate: LastFmSimilarTrack = {
      name: 'Fake Plastic Trees',
      artist: 'Radiohead',
      artistMbid: null,
      trackMbid: 'rec-abc',
      matchScore: 0.91,
    };

    const result = matchTrack(candidate, indexes);
    expect(result).not.toBeNull();
    expect(result!.track.id).toBe('with-mbid');
    expect(result!.confidence).toBe('mbid');
    expect(result!.lastfmMatchScore).toBe(0.91);
  });

  it('falls back to name matching when no MBID', () => {
    const candidate: LastFmSimilarTrack = {
      name: 'Paranoid Android',
      artist: 'Radiohead',
      artistMbid: null,
      trackMbid: null,
      matchScore: 0.87,
    };

    const result = matchTrack(candidate, indexes);
    expect(result).not.toBeNull();
    expect(result!.track.id).toBe('no-mbid');
    expect(result!.confidence).toBe('name-exact');
  });

  it('matches with different casing and accents', () => {
    const accentedTrack = makeTrack({
      id: 'accented',
      name: 'Déjà Vu',
      artists: 'Iron Maiden',
    });
    const idx = buildIndexes([accentedTrack]);

    const candidate: LastFmSimilarTrack = {
      name: 'Deja Vu',
      artist: 'IRON MAIDEN',
      artistMbid: null,
      trackMbid: null,
      matchScore: 0.7,
    };

    const result = matchTrack(candidate, idx);
    expect(result).not.toBeNull();
    expect(result!.track.id).toBe('accented');
  });

  it('matches when catalog has parenthetical and candidate does not', () => {
    const remasteredTrack = makeTrack({
      id: 'remastered',
      name: 'Bohemian Rhapsody (Remastered)',
      artists: 'Queen',
    });
    const idx = buildIndexes([remasteredTrack]);

    const candidate: LastFmSimilarTrack = {
      name: 'Bohemian Rhapsody',
      artist: 'Queen',
      artistMbid: null,
      trackMbid: null,
      matchScore: 0.95,
    };

    const result = matchTrack(candidate, idx);
    expect(result).not.toBeNull();
    expect(result!.track.id).toBe('remastered');
  });

  it('returns null when no match found', () => {
    const candidate: LastFmSimilarTrack = {
      name: 'Nonexistent Song',
      artist: 'Unknown Artist',
      artistMbid: null,
      trackMbid: 'no-such-mbid',
      matchScore: 0.5,
    };

    const result = matchTrack(candidate, indexes);
    expect(result).toBeNull();
  });

  it('prefers MBID match over name match', () => {
    // Track has both MBID and name, MBID should win
    const candidate: LastFmSimilarTrack = {
      name: 'Fake Plastic Trees',
      artist: 'Radiohead',
      artistMbid: null,
      trackMbid: 'rec-abc',
      matchScore: 0.91,
    };

    const result = matchTrack(candidate, indexes);
    expect(result!.confidence).toBe('mbid');
  });
});

describe('findTracksByArtist', () => {
  const t1 = makeTrack({
    id: 't1',
    name: 'Creep',
    artists: 'Radiohead',
    musicbrainzArtistId: 'rh-mbid',
  });
  const t2 = makeTrack({
    id: 't2',
    name: 'OK Computer',
    artists: 'Radiohead',
    musicbrainzArtistId: 'rh-mbid',
  });
  const t3 = makeTrack({ id: 't3', name: 'Supermassive', artists: 'Muse' });

  const indexes = buildIndexes([t1, t2, t3]);

  it('finds by artist MBID', () => {
    const result = findTracksByArtist('Radiohead', 'rh-mbid', indexes);
    expect(result).toHaveLength(2);
  });

  it('falls back to name when no MBID', () => {
    const result = findTracksByArtist('Muse', null, indexes);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t3');
  });

  it('returns empty array when artist not found', () => {
    const result = findTracksByArtist('Nonexistent', null, indexes);
    expect(result).toEqual([]);
  });
});
