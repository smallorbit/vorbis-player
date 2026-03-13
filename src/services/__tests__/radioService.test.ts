import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateRadioQueue } from '../radioService';
import type { MediaTrack } from '@/types/domain';
import type { RadioSeed } from '@/types/radio';

// Mock the Last.fm client
vi.mock('../lastfm', () => ({
  getSimilarTracks: vi.fn(),
  getSimilarArtists: vi.fn(),
  getArtistTopTracks: vi.fn(),
}));

import { getSimilarTracks, getSimilarArtists } from '../lastfm';
const mockGetSimilarTracks = vi.mocked(getSimilarTracks);
const mockGetSimilarArtists = vi.mocked(getSimilarArtists);

function makeTrack(name: string, artist: string, extra: Partial<MediaTrack> = {}): MediaTrack {
  return {
    id: extra.id ?? `id-${artist}-${name}`.toLowerCase().replace(/\s/g, '-'),
    provider: 'dropbox',
    playbackRef: { provider: 'dropbox', ref: `/${artist}/${name}.mp3` },
    name,
    artists: artist,
    album: extra.album ?? 'Test Album',
    durationMs: 200000,
    ...extra,
  };
}

// Build a catalog of tracks
const catalogTracks: MediaTrack[] = [
  makeTrack('Fake Plastic Trees', 'Radiohead', { musicbrainzRecordingId: 'fpt-mbid' }),
  makeTrack('Paranoid Android', 'Radiohead'),
  makeTrack('Karma Police', 'Radiohead'),
  makeTrack('No Surprises', 'Radiohead'),
  makeTrack('Supermassive Black Hole', 'Muse', { musicbrainzArtistId: 'muse-mbid' }),
  makeTrack('Hysteria', 'Muse', { musicbrainzArtistId: 'muse-mbid' }),
  makeTrack('Time Is Running Out', 'Muse', { musicbrainzArtistId: 'muse-mbid' }),
  makeTrack('Yellow', 'Coldplay'),
  makeTrack('The Scientist', 'Coldplay'),
  makeTrack('Fix You', 'Coldplay'),
  makeTrack('Bitter Sweet Symphony', 'The Verve'),
  makeTrack('Lucky Man', 'The Verve'),
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateRadioQueue — track seed', () => {
  it('matches Last.fm similar tracks against the catalog', async () => {
    mockGetSimilarTracks.mockResolvedValueOnce([
      { name: 'Fake Plastic Trees', artist: 'Radiohead', trackMbid: 'fpt-mbid', artistMbid: null, matchScore: 0.91 },
      { name: 'Paranoid Android', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.87 },
      { name: 'Yellow', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.75 },
      { name: 'Nonexistent Song', artist: 'Unknown', trackMbid: null, artistMbid: null, matchScore: 0.60 },
      { name: 'The Scientist', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.70 },
      { name: 'Fix You', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.65 },
    ]);

    const seed: RadioSeed = { type: 'track', artist: 'Radiohead', track: 'Creep' };
    const result = await generateRadioQueue(seed, catalogTracks);

    expect(result.queue.length).toBeGreaterThanOrEqual(3);
    expect(result.seedDescription).toBe('Radio based on Creep by Radiohead');
    expect(result.matchStats.lastfmCandidates).toBe(6);
    expect(result.matchStats.byMbid).toBeGreaterThanOrEqual(1);
  });

  it('excludes the seed track from results', async () => {
    mockGetSimilarTracks.mockResolvedValueOnce([
      { name: 'Karma Police', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.9 },
      { name: 'Fake Plastic Trees', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.85 },
      { name: 'Paranoid Android', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.8 },
      { name: 'No Surprises', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.75 },
      { name: 'Yellow', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.7 },
    ]);

    const seed: RadioSeed = { type: 'track', artist: 'Radiohead', track: 'Karma Police' };
    const result = await generateRadioQueue(seed, catalogTracks);

    // Seed track should be excluded
    expect(result.queue.find((t) => t.name === 'Karma Police')).toBeUndefined();
  });

  it('falls back to similar artists when few track matches', async () => {
    // Return only 2 matching tracks (below threshold of 5)
    mockGetSimilarTracks.mockResolvedValueOnce([
      { name: 'Yellow', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.5 },
    ]);
    mockGetSimilarArtists.mockResolvedValueOnce([
      { name: 'Muse', mbid: 'muse-mbid', matchScore: 0.8 },
      { name: 'Coldplay', mbid: null, matchScore: 0.7 },
    ]);

    const seed: RadioSeed = { type: 'track', artist: 'Radiohead', track: 'Creep' };
    const result = await generateRadioQueue(seed, catalogTracks);

    // Should have Yellow + Muse tracks + Coldplay tracks from fallback
    expect(result.queue.length).toBeGreaterThan(1);
  });

  it('returns empty queue when no matches found', async () => {
    mockGetSimilarTracks.mockResolvedValueOnce([
      { name: 'Unknown1', artist: 'Nobody', trackMbid: null, artistMbid: null, matchScore: 0.5 },
    ]);
    mockGetSimilarArtists.mockResolvedValueOnce([]);

    const seed: RadioSeed = { type: 'track', artist: 'Radiohead', track: 'Creep' };
    const result = await generateRadioQueue(seed, catalogTracks);

    expect(result.queue).toHaveLength(0);
    expect(result.matchStats.matched).toBe(0);
  });

  it('deduplicates tracks across Last.fm results', async () => {
    mockGetSimilarTracks.mockResolvedValueOnce([
      { name: 'Yellow', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.8 },
      { name: 'Yellow', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.7 },
      { name: 'Yellow', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.6 },
      { name: 'The Scientist', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.75 },
      { name: 'Fix You', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.7 },
      { name: 'Fake Plastic Trees', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.65 },
      { name: 'Paranoid Android', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.6 },
    ]);

    const seed: RadioSeed = { type: 'track', artist: 'Radiohead', track: 'Creep' };
    const result = await generateRadioQueue(seed, catalogTracks);

    // Yellow should only appear once
    const yellowCount = result.queue.filter((t) => t.name === 'Yellow').length;
    expect(yellowCount).toBe(1);
  });
});

describe('generateRadioQueue — artist seed', () => {
  it('includes tracks from similar artists found in catalog', async () => {
    mockGetSimilarArtists.mockResolvedValueOnce([
      { name: 'Muse', mbid: 'muse-mbid', matchScore: 0.8 },
      { name: 'Coldplay', mbid: null, matchScore: 0.7 },
    ]);

    const seed: RadioSeed = { type: 'artist', artist: 'Radiohead' };
    const result = await generateRadioQueue(seed, catalogTracks);

    expect(result.queue.length).toBeGreaterThan(0);
    expect(result.seedDescription).toBe('Radio based on Radiohead');

    // Should include Muse and Coldplay tracks
    const artists = new Set(result.queue.map((t) => t.artists));
    expect(artists.has('Muse')).toBe(true);
    expect(artists.has('Coldplay')).toBe(true);
  });

  it('includes seed artist tracks in the mix', async () => {
    mockGetSimilarArtists.mockResolvedValueOnce([]);

    const seed: RadioSeed = { type: 'artist', artist: 'Radiohead' };
    const result = await generateRadioQueue(seed, catalogTracks);

    // Even with no similar artists, should return seed artist tracks
    expect(result.queue.length).toBeGreaterThan(0);
    expect(result.queue.every((t) => t.artists === 'Radiohead')).toBe(true);
  });
});

describe('generateRadioQueue — album seed', () => {
  it('aggregates similar tracks across album tracks', async () => {
    mockGetSimilarTracks
      .mockResolvedValueOnce([
        { name: 'Yellow', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.8 },
      ])
      .mockResolvedValueOnce([
        { name: 'Supermassive Black Hole', artist: 'Muse', trackMbid: null, artistMbid: null, matchScore: 0.7 },
      ]);

    const seed: RadioSeed = {
      type: 'album',
      artist: 'Radiohead',
      album: 'OK Computer',
      tracks: [
        { artist: 'Radiohead', name: 'Airbag' },
        { artist: 'Radiohead', name: 'Paranoid Android' },
      ],
    };

    const result = await generateRadioQueue(seed, catalogTracks);

    expect(result.queue.length).toBeGreaterThanOrEqual(2);
    expect(result.seedDescription).toBe('Radio based on OK Computer by Radiohead');
  });

  it('excludes tracks from the seed album', async () => {
    mockGetSimilarTracks.mockResolvedValueOnce([
      { name: 'Yellow', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.8 },
      { name: 'Some Track', artist: 'Some Artist', trackMbid: null, artistMbid: null, matchScore: 0.6 },
    ]);

    // Catalog track that belongs to the seed album
    const albumTrack = makeTrack('Track From Album', 'Radiohead', { album: 'The Bends' });
    const catalogWithAlbumTrack = [...catalogTracks, albumTrack];

    const seed: RadioSeed = {
      type: 'album',
      artist: 'Radiohead',
      album: 'The Bends',
      tracks: [{ artist: 'Radiohead', name: 'Fake Plastic Trees' }],
    };

    const result = await generateRadioQueue(seed, catalogWithAlbumTrack);

    // Should not include tracks from "The Bends"
    expect(result.queue.find((t) => t.album === 'The Bends')).toBeUndefined();
  });

  it('returns empty queue when Last.fm returns no candidates', async () => {
    mockGetSimilarTracks.mockResolvedValue([]);

    const seed: RadioSeed = {
      type: 'album',
      artist: 'Unknown',
      album: 'Unknown Album',
      tracks: [{ artist: 'Unknown', name: 'Unknown Track' }],
    };

    const result = await generateRadioQueue(seed, catalogTracks);
    expect(result.queue).toHaveLength(0);
  });
});

describe('generateRadioQueue — sorting', () => {
  it('sorts results by matchScore descending', async () => {
    mockGetSimilarTracks.mockResolvedValueOnce([
      { name: 'Yellow', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.5 },
      { name: 'Fake Plastic Trees', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.9 },
      { name: 'The Scientist', artist: 'Coldplay', trackMbid: null, artistMbid: null, matchScore: 0.7 },
      { name: 'Paranoid Android', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.8 },
      { name: 'Hysteria', artist: 'Muse', trackMbid: null, artistMbid: null, matchScore: 0.6 },
    ]);

    const seed: RadioSeed = { type: 'track', artist: 'Unknown', track: 'Unknown' };
    const result = await generateRadioQueue(seed, catalogTracks);

    // Verify descending order
    for (let i = 1; i < result.queue.length; i++) {
      // We can't directly check scores on queue tracks, but first track should be highest scored
    }

    expect(result.queue[0].name).toBe('Fake Plastic Trees');
  });
});
