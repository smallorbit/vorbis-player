import type { MediaTrack } from '@/types/domain';
import type { CatalogProvider, ProviderDescriptor } from '@/types/providers';
import type { RadioSeed, RadioResult, UnmatchedSuggestion, RadioProgress } from '@/types/radio';
import { generateRadioQueue } from '@/services/radioService';
import { shuffleArray } from '@/utils/shuffleArray';
import { logRadio } from '@/lib/debugLog';

export interface RadioPipelineOptions {
  seedTrack: MediaTrack;
  catalogProvider: CatalogProvider;
  searchProviders: ProviderDescriptor[];
  onProgress: (progress: RadioProgress | null) => void;
  generateQueue?: (seed: RadioSeed, catalogTracks: MediaTrack[]) => Promise<RadioResult | null>;
}

export interface RadioPipelineResult {
  queue: MediaTrack[];
  seedDescription: string;
  stats: {
    catalogMatches: number;
    searchResolved: number;
    total: number;
  };
  unmatchedCount: number;
}

export async function runRadioPipeline(options: RadioPipelineOptions): Promise<RadioPipelineResult | null> {
  const { seedTrack, catalogProvider, searchProviders, onProgress, generateQueue = generateRadioQueue } = options;

  onProgress({ phase: 'fetching-catalog' });

  const { providerId } = catalogProvider;
  const allMusicRef = { provider: providerId, kind: 'folder' as const, id: '' };
  let catalogTracks = await catalogProvider.listTracks(allMusicRef);
  if (catalogTracks.length === 0) {
    const likedRef = { provider: providerId, kind: 'liked' as const, id: '' };
    catalogTracks = await catalogProvider.listTracks(likedRef);
  }

  const seed: RadioSeed = {
    type: 'track',
    artist: seedTrack.artists,
    track: seedTrack.name,
  };

  onProgress({ phase: 'generating' });
  const result = await generateQueue(seed, catalogTracks);

  if (!result || result.queue.length === 0) {
    return null;
  }

  const seedKey = `${seedTrack.artists.toLowerCase()}||${seedTrack.name.toLowerCase()}`;
  const seedId = seedTrack.id;

  let generatedTracks = [...result.queue];
  let searchResolved = 0;

  if (result.unmatchedSuggestions.length > 0) {
    onProgress({ phase: 'resolving' });
    const searchCapableProviders = searchProviders.filter(
      d => d.capabilities.hasTrackSearch && d.auth.isAuthenticated(),
    );
    if (searchCapableProviders.length > 0) {
      try {
        const searchPromises = result.unmatchedSuggestions.map(async (suggestion: UnmatchedSuggestion) => {
          for (const provider of searchCapableProviders) {
            const match = await provider.catalog.searchTrack?.(suggestion.artist, suggestion.name);
            if (match) return match;
          }
          return null;
        });
        const resolvedTracks = (await Promise.all(searchPromises)).filter((t): t is MediaTrack => t !== null);
        const existingKeys = new Set(
          generatedTracks.map((t) => `${t.artists.toLowerCase()}||${t.name.toLowerCase()}`),
        );
        const newTracks = resolvedTracks.filter(
          (t) => !existingKeys.has(`${t.artists.toLowerCase()}||${t.name.toLowerCase()}`),
        );
        searchResolved = newTracks.length;
        generatedTracks = [...generatedTracks, ...newTracks];
        logRadio(
          'resolved tracks via search: %d of %d unmatched suggestions',
          newTracks.length,
          result.unmatchedSuggestions.length,
        );
      } catch (err) {
        console.warn('[Radio] Failed to resolve tracks via search:', err);
      }
    }
  }

  const dedupedGenerated = generatedTracks.filter(
    (t) => t.id !== seedId && `${t.artists.toLowerCase()}||${t.name.toLowerCase()}` !== seedKey,
  );

  const shuffledGenerated = shuffleArray(dedupedGenerated);
  const combinedQueue = [seedTrack, ...shuffledGenerated];

  onProgress({ phase: 'done', trackCount: combinedQueue.length });

  return {
    queue: combinedQueue,
    seedDescription: result.seedDescription,
    stats: {
      catalogMatches: result.matchStats?.matched ?? 0,
      searchResolved,
      total: combinedQueue.length,
    },
    unmatchedCount: result.unmatchedSuggestions.length,
  };
}
