import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MediaTrack } from '@/types/domain';
import type { RadioSeed } from '@/types/radio';

vi.mock('@/services/lastfm', () => ({
  getSimilarTracks: vi.fn(),
  getSimilarArtists: vi.fn(),
  getArtistTopTracks: vi.fn(),
  getAlbumTracks: vi.fn(),
}));

function makeRadioTrack(name: string, artist: string, extra?: Partial<MediaTrack>): MediaTrack {
  return {
    id: `${artist}-${name}`.toLowerCase().replace(/\s+/g, '-'),
    provider: 'dropbox',
    playbackRef: { provider: 'dropbox', ref: `/${artist}/${name}.mp3` },
    name,
    artists: artist,
    album: 'Test Album',
    durationMs: 240000,
    ...extra,
  };
}

describe('RadioService', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function freshRadioService() {
    const { generateRadioQueue } = await import('@/services/radioService');
    const lastfm = await import('@/services/lastfm');
    return { generateRadioQueue, lastfm };
  }

  describe('generateRadioQueue — track seed', () => {
    it('uses the primary artist for Last.fm track lookups', async () => {
      const { generateRadioQueue, lastfm } = await freshRadioService();

      const catalog = [
        makeRadioTrack('Karma Police', 'Radiohead'),
        makeRadioTrack('Lucky', 'Radiohead'),
        makeRadioTrack('No Surprises', 'Radiohead'),
        makeRadioTrack('Exit Music', 'Radiohead'),
        makeRadioTrack('Airbag', 'Radiohead'),
      ];

      vi.mocked(lastfm.getSimilarTracks).mockResolvedValue([
        { name: 'Karma Police', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.9 },
        { name: 'Lucky', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.8 },
        { name: 'No Surprises', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.7 },
        { name: 'Exit Music', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.65 },
        { name: 'Airbag', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.6 },
      ]);
      vi.mocked(lastfm.getSimilarArtists).mockResolvedValue([]);

      const seed: RadioSeed = { type: 'track', artist: 'Radiohead, Thom Yorke', track: 'Creep' };
      await generateRadioQueue(seed, catalog);

      expect(lastfm.getSimilarTracks).toHaveBeenCalledWith('Radiohead', 'Creep', 25);
    });

    it('matches Last.fm similar tracks against catalog', async () => {
      const { generateRadioQueue, lastfm } = await freshRadioService();

      const catalog = [
        makeRadioTrack('Karma Police', 'Radiohead'),
        makeRadioTrack('Lucky', 'Radiohead'),
        makeRadioTrack('Paranoid Android', 'Radiohead'),
        makeRadioTrack('No Surprises', 'Radiohead'),
        makeRadioTrack('Exit Music', 'Radiohead'),
        makeRadioTrack('Unrelated', 'Other Artist'),
      ];

      vi.mocked(lastfm.getSimilarTracks).mockResolvedValue([
        { name: 'Karma Police', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.95 },
        { name: 'Lucky', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.85 },
        { name: 'Paranoid Android', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.80 },
        { name: 'No Surprises', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.75 },
        { name: 'Exit Music', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.70 },
        { name: 'Unknown Song', artist: 'Unknown', trackMbid: null, artistMbid: null, matchScore: 0.60 },
      ]);

      const seed: RadioSeed = { type: 'track', artist: 'Radiohead', track: 'Creep' };
      const result = await generateRadioQueue(seed, catalog);

      expect(result.queue.length).toBeGreaterThanOrEqual(5);
      expect(result.queue.every((t) => t.name !== 'Creep')).toBe(true);
      expect(result.seedDescription).toContain('Creep');
      expect(result.seedDescription).toContain('Radiohead');
      expect(result.matchStats.lastfmCandidates).toBe(6);
    });

    it('excludes the seed track from the queue', async () => {
      const { generateRadioQueue, lastfm } = await freshRadioService();

      const catalog = [
        makeRadioTrack('Creep', 'Radiohead'),
        makeRadioTrack('Karma Police', 'Radiohead'),
        makeRadioTrack('Lucky', 'Radiohead'),
        makeRadioTrack('No Surprises', 'Radiohead'),
        makeRadioTrack('Exit Music', 'Radiohead'),
        makeRadioTrack('Airbag', 'Radiohead'),
      ];

      vi.mocked(lastfm.getSimilarTracks).mockResolvedValue([
        { name: 'Creep', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 1.0 },
        { name: 'Karma Police', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.9 },
        { name: 'Lucky', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.8 },
        { name: 'No Surprises', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.75 },
        { name: 'Exit Music', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.7 },
        { name: 'Airbag', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.65 },
      ]);

      const seed: RadioSeed = { type: 'track', artist: 'Radiohead', track: 'Creep' };
      const result = await generateRadioQueue(seed, catalog);

      expect(result.queue.find((t) => t.name === 'Creep')).toBeUndefined();
    });

    it('collects unmatched suggestions', async () => {
      const { generateRadioQueue, lastfm } = await freshRadioService();

      const catalog = [
        makeRadioTrack('Lucky', 'Radiohead'),
        makeRadioTrack('No Surprises', 'Radiohead'),
        makeRadioTrack('Exit Music', 'Radiohead'),
        makeRadioTrack('Airbag', 'Radiohead'),
        makeRadioTrack('Let Down', 'Radiohead'),
      ];

      vi.mocked(lastfm.getSimilarTracks).mockResolvedValue([
        { name: 'Lucky', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.9 },
        { name: 'No Surprises', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.85 },
        { name: 'Exit Music', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.8 },
        { name: 'Airbag', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.75 },
        { name: 'Let Down', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.7 },
        { name: 'Missing Song', artist: 'Missing Artist', trackMbid: null, artistMbid: null, matchScore: 0.5 },
      ]);

      const seed: RadioSeed = { type: 'track', artist: 'Radiohead', track: 'Creep' };
      const result = await generateRadioQueue(seed, catalog);

      expect(result.unmatchedSuggestions).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Missing Song', artist: 'Missing Artist' })]),
      );
    });

    it('falls back to similar artists when few track matches', async () => {
      const { generateRadioQueue, lastfm } = await freshRadioService();

      const catalog = [
        makeRadioTrack('Hysteria', 'Muse'),
        makeRadioTrack('Starlight', 'Muse'),
        makeRadioTrack('Time Is Running Out', 'Muse'),
      ];

      vi.mocked(lastfm.getSimilarTracks).mockResolvedValue([
        { name: 'NonExistent1', artist: 'Nobody', trackMbid: null, artistMbid: null, matchScore: 0.9 },
      ]);
      vi.mocked(lastfm.getSimilarArtists).mockResolvedValue([
        { name: 'Muse', mbid: null, matchScore: 0.8 },
      ]);

      const seed: RadioSeed = { type: 'track', artist: 'Radiohead', track: 'Creep' };
      const result = await generateRadioQueue(seed, catalog);

      expect(result.queue.length).toBeGreaterThan(0);
      expect(result.queue.some((t) => t.artists === 'Muse')).toBe(true);
    });

    it('deduplicates tracks in the queue', async () => {
      const { generateRadioQueue, lastfm } = await freshRadioService();

      const catalog = [
        makeRadioTrack('Karma Police', 'Radiohead'),
        makeRadioTrack('Lucky', 'Radiohead'),
        makeRadioTrack('No Surprises', 'Radiohead'),
        makeRadioTrack('Exit Music', 'Radiohead'),
        makeRadioTrack('Airbag', 'Radiohead'),
      ];

      vi.mocked(lastfm.getSimilarTracks).mockResolvedValue([
        { name: 'Karma Police', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.9 },
        { name: 'Karma Police', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.85 },
        { name: 'Lucky', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.8 },
        { name: 'No Surprises', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.75 },
        { name: 'Exit Music', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.7 },
        { name: 'Airbag', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.65 },
      ]);

      const seed: RadioSeed = { type: 'track', artist: 'Radiohead', track: 'Creep' };
      const result = await generateRadioQueue(seed, catalog);

      const ids = result.queue.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('sorts queue by Last.fm match score descending', async () => {
      const { generateRadioQueue, lastfm } = await freshRadioService();

      const catalog = [
        makeRadioTrack('A', 'Radiohead'),
        makeRadioTrack('B', 'Radiohead'),
        makeRadioTrack('C', 'Radiohead'),
        makeRadioTrack('D', 'Radiohead'),
        makeRadioTrack('E', 'Radiohead'),
      ];

      vi.mocked(lastfm.getSimilarTracks).mockResolvedValue([
        { name: 'C', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.5 },
        { name: 'A', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.9 },
        { name: 'B', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.7 },
        { name: 'D', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.6 },
        { name: 'E', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.55 },
      ]);

      const seed: RadioSeed = { type: 'track', artist: 'Radiohead', track: 'Creep' };
      const result = await generateRadioQueue(seed, catalog);

      expect(result.queue[0].name).toBe('A');
      expect(result.queue[1].name).toBe('B');
      expect(result.queue[2].name).toBe('D');
    });
  });

  describe('generateRadioQueue — artist seed', () => {
    it('matches tracks from similar artists', async () => {
      const { generateRadioQueue, lastfm } = await freshRadioService();

      const catalog = [
        makeRadioTrack('Hysteria', 'Muse'),
        makeRadioTrack('Starlight', 'Muse'),
        makeRadioTrack('Creep', 'Radiohead'),
      ];

      vi.mocked(lastfm.getSimilarArtists).mockResolvedValue([
        { name: 'Muse', mbid: null, matchScore: 0.8 },
      ]);

      const seed: RadioSeed = { type: 'artist', artist: 'Radiohead' };
      const result = await generateRadioQueue(seed, catalog);

      expect(result.queue.some((t) => t.artists === 'Muse')).toBe(true);
      expect(result.queue.some((t) => t.artists === 'Radiohead')).toBe(true);
      expect(result.seedDescription).toContain('Radiohead');
    });
  });

  describe('generateRadioQueue — album seed', () => {
    it('uses the primary artist for Last.fm album-track lookups', async () => {
      const { generateRadioQueue, lastfm } = await freshRadioService();

      const catalog = [
        makeRadioTrack('Lucky', 'Radiohead'),
        makeRadioTrack('Karma Police', 'Radiohead'),
      ];

      vi.mocked(lastfm.getSimilarTracks).mockResolvedValue([
        { name: 'Lucky', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.9 },
      ]);

      const seed: RadioSeed = {
        type: 'album',
        artist: 'Radiohead',
        album: 'The Bends',
        tracks: [{ artist: 'Radiohead, Thom Yorke', name: 'Fake Plastic Trees' }],
      };
      await generateRadioQueue(seed, catalog);

      expect(lastfm.getSimilarTracks).toHaveBeenCalledWith('Radiohead', 'Fake Plastic Trees', 25);
    });

    it('matches similar tracks from album tracks', async () => {
      const { generateRadioQueue, lastfm } = await freshRadioService();

      const catalog = [
        makeRadioTrack('Lucky', 'Radiohead'),
        makeRadioTrack('Karma Police', 'Radiohead'),
      ];

      vi.mocked(lastfm.getSimilarTracks).mockResolvedValue([
        { name: 'Lucky', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.9 },
        { name: 'Karma Police', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.8 },
      ]);

      const seed: RadioSeed = {
        type: 'album',
        artist: 'Radiohead',
        album: 'The Bends',
        tracks: [
          { artist: 'Radiohead', name: 'Fake Plastic Trees' },
          { artist: 'Radiohead', name: 'High and Dry' },
        ],
      };
      const result = await generateRadioQueue(seed, catalog);

      expect(result.queue.length).toBeGreaterThan(0);
      expect(result.seedDescription).toContain('The Bends');
      expect(result.seedDescription).toContain('Radiohead');
    });

    it('excludes tracks from the seed album', async () => {
      const { generateRadioQueue, lastfm } = await freshRadioService();

      const catalog = [
        makeRadioTrack('Lucky', 'Radiohead', { album: 'OK Computer' }),
        makeRadioTrack('Karma Police', 'Radiohead', { album: 'OK Computer' }),
        makeRadioTrack('Creep', 'Radiohead', { album: 'Pablo Honey' }),
      ];

      vi.mocked(lastfm.getSimilarTracks).mockResolvedValue([
        { name: 'Lucky', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.9 },
        { name: 'Karma Police', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.8 },
        { name: 'Creep', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.7 },
      ]);

      const seed: RadioSeed = {
        type: 'album',
        artist: 'Radiohead',
        album: 'OK Computer',
        tracks: [{ artist: 'Radiohead', name: 'Airbag' }],
      };
      const result = await generateRadioQueue(seed, catalog);

      expect(result.queue.every((t) => t.album !== 'OK Computer')).toBe(true);
    });
  });

  describe('matchStats', () => {
    it('reports accurate match statistics', async () => {
      const { generateRadioQueue, lastfm } = await freshRadioService();

      const catalog = [
        makeRadioTrack('Karma Police', 'Radiohead', { musicbrainzRecordingId: 'kp-mbid' }),
        makeRadioTrack('Lucky', 'Radiohead'),
        makeRadioTrack('No Surprises', 'Radiohead'),
        makeRadioTrack('Exit Music', 'Radiohead'),
        makeRadioTrack('Airbag', 'Radiohead'),
      ];

      vi.mocked(lastfm.getSimilarTracks).mockResolvedValue([
        { name: 'Karma Police', artist: 'Radiohead', trackMbid: 'kp-mbid', artistMbid: null, matchScore: 0.95 },
        { name: 'Lucky', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.85 },
        { name: 'No Surprises', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.8 },
        { name: 'Exit Music', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.75 },
        { name: 'Airbag', artist: 'Radiohead', trackMbid: null, artistMbid: null, matchScore: 0.7 },
        { name: 'Missing', artist: 'Nobody', trackMbid: null, artistMbid: null, matchScore: 0.5 },
      ]);

      const seed: RadioSeed = { type: 'track', artist: 'Radiohead', track: 'Creep' };
      const result = await generateRadioQueue(seed, catalog);

      expect(result.matchStats.lastfmCandidates).toBe(6);
      expect(result.matchStats.matched).toBe(5);
      expect(result.matchStats.byMbid).toBe(1);
      expect(result.matchStats.byName).toBe(4);
    });
  });
});
