/**
 * Provider registry: holds all available music providers (Spotify, Dropbox, etc.).
 * Used by the app to resolve the active provider by id.
 */

import type { ProviderId } from '@/types/domain';
import type { ProviderDescriptor, ProviderRegistry } from '@/types/providers';

import { InvalidProviderDescriptorError, type RequiredProviderAdapter } from './errors';

const REQUIRED_ADAPTERS: readonly RequiredProviderAdapter[] = ['auth', 'catalog', 'playback'];

export class ProviderRegistryImpl implements ProviderRegistry {
  private providers = new Map<ProviderId, ProviderDescriptor>();

  register(descriptor: ProviderDescriptor): void {
    for (const adapter of REQUIRED_ADAPTERS) {
      const value = descriptor[adapter];
      if (typeof value !== 'object' || value === null) {
        throw new InvalidProviderDescriptorError(descriptor.id, adapter);
      }
    }
    this.providers.set(descriptor.id, descriptor);
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
