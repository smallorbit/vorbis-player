/**
 * Provider registry: holds all available music providers (Spotify, Dropbox, etc.).
 * Used by the app to resolve the active provider by id.
 *
 * There is exactly one variability mechanism on the provider contract:
 * optional-method presence. Capability flags that mirror a method are derived
 * here at registration time, so they can never disagree with the adapter;
 * only genuinely behavioral flags (no-op methods, display labels) are
 * declared by providers, and those are validated against the adapter.
 */

import type { ProviderId } from '@/types/domain';
import type {
  ProviderCapabilities,
  ProviderDescriptor,
  ProviderRegistration,
  ProviderRegistry,
} from '@/types/providers';

import {
  InvalidProviderDescriptorError,
  ProviderCapabilityMismatchError,
  type RequiredProviderAdapter,
} from './errors';

const REQUIRED_ADAPTERS: readonly RequiredProviderAdapter[] = ['auth', 'catalog', 'playback'];

function deriveCapabilities(registration: ProviderRegistration): ProviderCapabilities {
  const { catalog } = registration;
  return {
    ...registration.capabilities,
    hasLikedCollection: typeof catalog.getLikedCount === 'function',
    hasSaveTrack:
      typeof catalog.setTrackSaved === 'function' && typeof catalog.isTrackSaved === 'function',
    hasSaveAlbum:
      typeof catalog.setAlbumSaved === 'function' && typeof catalog.isAlbumSaved === 'function',
    hasTrackSearch: typeof catalog.searchTrack === 'function',
  };
}

/** Behavioral flags still promise a method exists — enforce the agreement. */
function validateDeclaredCapabilities(registration: ProviderRegistration): void {
  const { capabilities, playback, id } = registration;
  if (capabilities.hasNativeQueueSync && typeof playback.onQueueChanged !== 'function') {
    throw new ProviderCapabilityMismatchError(id, 'hasNativeQueueSync', 'playback.onQueueChanged');
  }
  if (capabilities.hasContextPlaybackFallback && typeof playback.playCollection !== 'function') {
    throw new ProviderCapabilityMismatchError(id, 'hasContextPlaybackFallback', 'playback.playCollection');
  }
}

export class ProviderRegistryImpl implements ProviderRegistry {
  private providers = new Map<ProviderId, ProviderDescriptor>();

  register(registration: ProviderRegistration): void {
    for (const adapter of REQUIRED_ADAPTERS) {
      const value = registration[adapter];
      if (typeof value !== 'object' || value === null) {
        throw new InvalidProviderDescriptorError(registration.id, adapter);
      }
    }
    validateDeclaredCapabilities(registration);
    this.providers.set(registration.id, {
      ...registration,
      capabilities: deriveCapabilities(registration),
    });
  }

  get(id: ProviderId): ProviderDescriptor | undefined {
    return this.providers.get(id);
  }

  getAll(): ProviderDescriptor[] {
    return Array.from(this.providers.values());
  }

  has(id: ProviderId): boolean {
    return this.providers.has(id);
  }
}

/** Singleton registry instance — providers register during module initialization. */
export const providerRegistry = new ProviderRegistryImpl();
