import { providerRegistry } from '@/providers/registry';
import type { MediaTrack, ProviderId } from '@/types/domain';

export async function fetchLikedForProvider(
  provider: ProviderId,
  signal?: AbortSignal,
): Promise<MediaTrack[]> {
  const catalog = providerRegistry.get(provider)?.catalog;
  if (!catalog) return [];
  return catalog.listTracks({ provider, kind: 'liked' }, signal);
}
