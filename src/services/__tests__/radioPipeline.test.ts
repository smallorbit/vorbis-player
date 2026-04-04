import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MediaTrack } from '@/types/domain';
import type { CatalogProvider } from '@/types/providers';
import type { RadioResult, RadioProgress } from '@/types/radio';
import { runRadioPipeline } from '@/services/radioPipeline';
import { makeMediaTrack, makeProviderDescriptor } from '@/test/fixtures';

function makeRadioResult(overrides?: Partial<RadioResult>): RadioResult {
  return {
    queue: [],
    seedDescription: 'Similar to Test Artist - Test Track',
    matchStats: { lastfmCandidates: 0, matched: 0, byMbid: 0, byName: 0 },
    unmatchedSuggestions: [],
    ...overrides,
  };
}

function makeCatalogProvider(tracks: MediaTrack[], likedTracks?: MediaTrack[]): CatalogProvider {
  return {
    providerId: 'spotify',
    listCollections: vi.fn().mockResolvedValue([]),
    listTracks: vi.fn().mockImplementation((ref: { kind: string }) => {
      if (ref.kind === 'liked') return Promise.resolve(likedTracks ?? []);
      return Promise.resolve(tracks);
    }),
  };
}

describe('runRadioPipeline', () => {
  let onProgress: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onProgress = vi.fn();
  });

  describe('early returns', () => {
    it('returns null when generateQueue resolves to null', async () => {
      // #given
      const seedTrack = makeMediaTrack({ id: 'seed-1', name: 'Test Track', artists: 'Test Artist' });
      const catalogProvider = makeCatalogProvider([seedTrack]);
      const generateQueue = vi.fn().mockResolvedValue(null);

      // #when
      const result = await runRadioPipeline({
        seedTrack,
        catalogProvider,
        searchProviders: [],
        onProgress,
        generateQueue,
      });

      // #then
      expect(result).toBeNull();
    });

    it('returns null when generateQueue returns an empty queue', async () => {
      // #given
      const seedTrack = makeMediaTrack({ id: 'seed-1', name: 'Test Track', artists: 'Test Artist' });
      const catalogProvider = makeCatalogProvider([seedTrack]);
      const generateQueue = vi.fn().mockResolvedValue(makeRadioResult({ queue: [] }));

      // #when
      const result = await runRadioPipeline({
        seedTrack,
        catalogProvider,
        searchProviders: [],
        onProgress,
        generateQueue,
      });

      // #then
      expect(result).toBeNull();
    });
  });

  describe('queue construction', () => {
    it('pins the seed track at index 0 in the returned queue', async () => {
      // #given
      const seedTrack = makeMediaTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead' });
      const rec1 = makeMediaTrack({ id: 'rec-1', name: 'Karma Police', artists: 'Radiohead' });
      const rec2 = makeMediaTrack({ id: 'rec-2', name: 'Lucky', artists: 'Radiohead' });
      const catalogProvider = makeCatalogProvider([rec1, rec2]);
      const generateQueue = vi.fn().mockResolvedValue(
        makeRadioResult({ queue: [rec1, rec2] }),
      );

      // #when
      const result = await runRadioPipeline({
        seedTrack,
        catalogProvider,
        searchProviders: [],
        onProgress,
        generateQueue,
      });

      // #then
      expect(result).not.toBeNull();
      expect(result!.queue[0]).toBe(seedTrack);
    });

    it('deduplicates the seed track from recommendations by id', async () => {
      // #given
      const seedTrack = makeMediaTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead' });
      const seedDuplicate = makeMediaTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead' });
      const rec = makeMediaTrack({ id: 'rec-1', name: 'Karma Police', artists: 'Radiohead' });
      const catalogProvider = makeCatalogProvider([rec]);
      const generateQueue = vi.fn().mockResolvedValue(
        makeRadioResult({ queue: [seedDuplicate, rec] }),
      );

      // #when
      const result = await runRadioPipeline({
        seedTrack,
        catalogProvider,
        searchProviders: [],
        onProgress,
        generateQueue,
      });

      // #then
      expect(result).not.toBeNull();
      const queueIds = result!.queue.map((t) => t.id);
      expect(queueIds.filter((id) => id === 'seed-1')).toHaveLength(1);
    });

    it('deduplicates the seed track by normalized artists||name when id differs', async () => {
      // #given
      const seedTrack = makeMediaTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead' });
      const sameTrackDifferentId = makeMediaTrack({ id: 'different-id', name: 'Creep', artists: 'Radiohead' });
      const rec = makeMediaTrack({ id: 'rec-1', name: 'Karma Police', artists: 'Radiohead' });
      const catalogProvider = makeCatalogProvider([rec]);
      const generateQueue = vi.fn().mockResolvedValue(
        makeRadioResult({ queue: [sameTrackDifferentId, rec] }),
      );

      // #when
      const result = await runRadioPipeline({
        seedTrack,
        catalogProvider,
        searchProviders: [],
        onProgress,
        generateQueue,
      });

      // #then
      expect(result).not.toBeNull();
      const queueNames = result!.queue.map((t) => t.name);
      expect(queueNames.filter((name) => name === 'Creep')).toHaveLength(1);
      expect(result!.queue[0]).toBe(seedTrack);
    });
  });

  describe('catalog fallback', () => {
    it('falls back to kind:liked catalog when kind:folder returns empty array', async () => {
      // #given
      const seedTrack = makeMediaTrack({ id: 'seed-1', name: 'Test Track', artists: 'Test Artist' });
      const likedTrack = makeMediaTrack({ id: 'liked-1', name: 'Liked Track', artists: 'Other Artist' });
      const catalogProvider = makeCatalogProvider([], [likedTrack]);
      const generateQueue = vi.fn().mockResolvedValue(
        makeRadioResult({ queue: [likedTrack] }),
      );

      // #when
      await runRadioPipeline({
        seedTrack,
        catalogProvider,
        searchProviders: [],
        onProgress,
        generateQueue,
      });

      // #then
      const listTracksMock = vi.mocked(catalogProvider.listTracks);
      expect(listTracksMock).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'liked' }),
      );
      expect(generateQueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([likedTrack]),
      );
    });
  });

  describe('search resolution', () => {
    it('resolves unmatched suggestions via searchProviders and adds non-duplicate tracks', async () => {
      // #given
      const seedTrack = makeMediaTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead' });
      const catalogTrack = makeMediaTrack({ id: 'rec-1', name: 'Karma Police', artists: 'Radiohead' });
      const resolvedTrack = makeMediaTrack({ id: 'resolved-1', name: 'Missing Song', artists: 'Missing Artist' });
      const catalogProvider = makeCatalogProvider([catalogTrack]);

      const searchProvider = makeProviderDescriptor({
        capabilities: { hasSaveTrack: false, hasExternalLink: false, hasLikedCollection: false, hasTrackSearch: true },
        auth: {
          providerId: 'spotify',
          isAuthenticated: vi.fn().mockReturnValue(true),
          getAccessToken: vi.fn(),
          beginLogin: vi.fn(),
          handleCallback: vi.fn(),
          logout: vi.fn(),
        },
        catalog: {
          providerId: 'spotify',
          listCollections: vi.fn().mockResolvedValue([]),
          listTracks: vi.fn().mockResolvedValue([]),
          searchTrack: vi.fn().mockResolvedValue(resolvedTrack),
        },
      });

      const generateQueue = vi.fn().mockResolvedValue(
        makeRadioResult({
          queue: [catalogTrack],
          unmatchedSuggestions: [{ name: 'Missing Song', artist: 'Missing Artist', matchScore: 0.5 }],
        }),
      );

      // #when
      const result = await runRadioPipeline({
        seedTrack,
        catalogProvider,
        searchProviders: [searchProvider],
        onProgress,
        generateQueue,
      });

      // #then
      expect(result).not.toBeNull();
      expect(result!.queue.some((t) => t.id === 'resolved-1')).toBe(true);
    });

    it('does not add resolved tracks that duplicate existing queue entries by artists||name', async () => {
      // #given
      const seedTrack = makeMediaTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead' });
      const catalogTrack = makeMediaTrack({ id: 'rec-1', name: 'Karma Police', artists: 'Radiohead' });
      const duplicateResolved = makeMediaTrack({ id: 'resolved-dup', name: 'Karma Police', artists: 'Radiohead' });
      const catalogProvider = makeCatalogProvider([catalogTrack]);

      const searchProvider = makeProviderDescriptor({
        capabilities: { hasSaveTrack: false, hasExternalLink: false, hasLikedCollection: false, hasTrackSearch: true },
        auth: {
          providerId: 'spotify',
          isAuthenticated: vi.fn().mockReturnValue(true),
          getAccessToken: vi.fn(),
          beginLogin: vi.fn(),
          handleCallback: vi.fn(),
          logout: vi.fn(),
        },
        catalog: {
          providerId: 'spotify',
          listCollections: vi.fn().mockResolvedValue([]),
          listTracks: vi.fn().mockResolvedValue([]),
          searchTrack: vi.fn().mockResolvedValue(duplicateResolved),
        },
      });

      const generateQueue = vi.fn().mockResolvedValue(
        makeRadioResult({
          queue: [catalogTrack],
          unmatchedSuggestions: [{ name: 'Karma Police', artist: 'Radiohead', matchScore: 0.5 }],
        }),
      );

      // #when
      const result = await runRadioPipeline({
        seedTrack,
        catalogProvider,
        searchProviders: [searchProvider],
        onProgress,
        generateQueue,
      });

      // #then
      expect(result).not.toBeNull();
      const karmaPoliceEntries = result!.queue.filter((t) => t.name === 'Karma Police');
      expect(karmaPoliceEntries).toHaveLength(1);
    });
  });

  describe('onProgress lifecycle', () => {
    it('calls onProgress in order: fetching-catalog → generating → resolving → done when unmatched exist', async () => {
      // #given
      const seedTrack = makeMediaTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead' });
      const rec = makeMediaTrack({ id: 'rec-1', name: 'Karma Police', artists: 'Radiohead' });
      const catalogProvider = makeCatalogProvider([rec]);

      const searchProvider = makeProviderDescriptor({
        capabilities: { hasSaveTrack: false, hasExternalLink: false, hasLikedCollection: false, hasTrackSearch: true },
        auth: {
          providerId: 'spotify',
          isAuthenticated: vi.fn().mockReturnValue(true),
          getAccessToken: vi.fn(),
          beginLogin: vi.fn(),
          handleCallback: vi.fn(),
          logout: vi.fn(),
        },
        catalog: {
          providerId: 'spotify',
          listCollections: vi.fn().mockResolvedValue([]),
          listTracks: vi.fn().mockResolvedValue([]),
          searchTrack: vi.fn().mockResolvedValue(null),
        },
      });

      const generateQueue = vi.fn().mockResolvedValue(
        makeRadioResult({
          queue: [rec],
          unmatchedSuggestions: [{ name: 'Missing', artist: 'Nobody', matchScore: 0.3 }],
        }),
      );

      // #when
      await runRadioPipeline({
        seedTrack,
        catalogProvider,
        searchProviders: [searchProvider],
        onProgress,
        generateQueue,
      });

      // #then
      const phases = onProgress.mock.calls.map((call: [RadioProgress]) => call[0]?.phase);
      expect(phases).toEqual(['fetching-catalog', 'generating', 'resolving', 'done']);
    });

    it('skips the resolving phase when unmatchedSuggestions is empty', async () => {
      // #given
      const seedTrack = makeMediaTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead' });
      const rec = makeMediaTrack({ id: 'rec-1', name: 'Karma Police', artists: 'Radiohead' });
      const catalogProvider = makeCatalogProvider([rec]);
      const generateQueue = vi.fn().mockResolvedValue(
        makeRadioResult({
          queue: [rec],
          unmatchedSuggestions: [],
        }),
      );

      // #when
      await runRadioPipeline({
        seedTrack,
        catalogProvider,
        searchProviders: [],
        onProgress,
        generateQueue,
      });

      // #then
      const phases = onProgress.mock.calls.map((call: [RadioProgress]) => call[0]?.phase);
      expect(phases).not.toContain('resolving');
      expect(phases).toContain('done');
    });
  });

  describe('stats', () => {
    it('correctly calculates catalogMatches, searchResolved, and total', async () => {
      // #given
      const seedTrack = makeMediaTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead' });
      const catalogTrack1 = makeMediaTrack({ id: 'rec-1', name: 'Karma Police', artists: 'Radiohead' });
      const catalogTrack2 = makeMediaTrack({ id: 'rec-2', name: 'Lucky', artists: 'Radiohead' });
      const resolvedTrack = makeMediaTrack({ id: 'resolved-1', name: 'Missing Song', artists: 'Missing Artist' });
      const catalogProvider = makeCatalogProvider([catalogTrack1, catalogTrack2]);

      const searchProvider = makeProviderDescriptor({
        capabilities: { hasSaveTrack: false, hasExternalLink: false, hasLikedCollection: false, hasTrackSearch: true },
        auth: {
          providerId: 'spotify',
          isAuthenticated: vi.fn().mockReturnValue(true),
          getAccessToken: vi.fn(),
          beginLogin: vi.fn(),
          handleCallback: vi.fn(),
          logout: vi.fn(),
        },
        catalog: {
          providerId: 'spotify',
          listCollections: vi.fn().mockResolvedValue([]),
          listTracks: vi.fn().mockResolvedValue([]),
          searchTrack: vi.fn().mockResolvedValue(resolvedTrack),
        },
      });

      const generateQueue = vi.fn().mockResolvedValue(
        makeRadioResult({
          queue: [catalogTrack1, catalogTrack2],
          matchStats: { lastfmCandidates: 3, matched: 2, byMbid: 0, byName: 2 },
          unmatchedSuggestions: [{ name: 'Missing Song', artist: 'Missing Artist', matchScore: 0.5 }],
        }),
      );

      // #when
      const result = await runRadioPipeline({
        seedTrack,
        catalogProvider,
        searchProviders: [searchProvider],
        onProgress,
        generateQueue,
      });

      // #then
      expect(result).not.toBeNull();
      expect(result!.stats.catalogMatches).toBe(2);
      expect(result!.stats.searchResolved).toBe(1);
      expect(result!.stats.total).toBe(result!.queue.length);
    });

    it('reports zero stats when no match data is available', async () => {
      // #given
      const seedTrack = makeMediaTrack({ id: 'seed-1', name: 'Creep', artists: 'Radiohead' });
      const rec = makeMediaTrack({ id: 'rec-1', name: 'Karma Police', artists: 'Radiohead' });
      const catalogProvider = makeCatalogProvider([rec]);
      const generateQueue = vi.fn().mockResolvedValue(
        makeRadioResult({
          queue: [rec],
          matchStats: { lastfmCandidates: 1, matched: 1, byMbid: 0, byName: 1 },
        }),
      );

      // #when
      const result = await runRadioPipeline({
        seedTrack,
        catalogProvider,
        searchProviders: [],
        onProgress,
        generateQueue,
      });

      // #then
      expect(result).not.toBeNull();
      expect(result!.stats.catalogMatches).toBe(1);
      expect(result!.stats.searchResolved).toBe(0);
    });
  });
});
