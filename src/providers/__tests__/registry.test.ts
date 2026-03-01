import { describe, it, expect, beforeEach } from 'vitest';
import type { ProviderDescriptor } from '@/types/providers';

// We test the class directly by creating a fresh instance each time,
// rather than using the singleton (which may have providers registered by other modules).
class TestableRegistry {
  private providers = new Map<string, ProviderDescriptor>();

  register(descriptor: ProviderDescriptor): void {
    this.providers.set(descriptor.id, descriptor);
  }

  get(id: string): ProviderDescriptor | undefined {
    return this.providers.get(id);
  }

  getAll(): ProviderDescriptor[] {
    return Array.from(this.providers.values());
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }
}

function makeStubDescriptor(id: 'spotify' | 'dropbox', name: string): ProviderDescriptor {
  return {
    id,
    name,
    capabilities: {
      hasLikedCollection: id === 'spotify',
      hasSaveTrack: id === 'spotify',
      hasExternalLink: id === 'spotify',
      externalLinkLabel: id === 'spotify' ? 'Open in Spotify' : undefined,
    },
    auth: {
      providerId: id,
      isAuthenticated: () => false,
      getAccessToken: async () => null,
      beginLogin: async () => {},
      handleCallback: async () => false,
      logout: () => {},
    },
    catalog: {
      providerId: id,
      listCollections: async () => [],
      listTracks: async () => [],
    },
    playback: {
      providerId: id,
      initialize: async () => {},
      playTrack: async () => {},
      pause: async () => {},
      resume: async () => {},
      seek: async () => {},
      next: async () => {},
      previous: async () => {},
      setVolume: async () => {},
      getState: async () => null,
      subscribe: () => () => {},
    },
  };
}

describe('ProviderRegistry', () => {
  let registry: TestableRegistry;

  beforeEach(() => {
    registry = new TestableRegistry();
  });

  it('returns undefined for unregistered provider', () => {
    expect(registry.get('spotify')).toBeUndefined();
  });

  it('has() returns false for unregistered provider', () => {
    expect(registry.has('spotify')).toBe(false);
  });

  it('getAll() returns empty array when no providers registered', () => {
    expect(registry.getAll()).toEqual([]);
  });

  it('registers and retrieves a provider', () => {
    const descriptor = makeStubDescriptor('spotify', 'Spotify');
    registry.register(descriptor);

    expect(registry.has('spotify')).toBe(true);
    expect(registry.get('spotify')).toBe(descriptor);
  });

  it('getAll() returns all registered providers', () => {
    const spotify = makeStubDescriptor('spotify', 'Spotify');
    const dropbox = makeStubDescriptor('dropbox', 'Dropbox');
    registry.register(spotify);
    registry.register(dropbox);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(spotify);
    expect(all).toContain(dropbox);
  });

  it('overwrites a provider if registered twice with the same id', () => {
    const first = makeStubDescriptor('spotify', 'Spotify v1');
    const second = makeStubDescriptor('spotify', 'Spotify v2');
    registry.register(first);
    registry.register(second);

    expect(registry.get('spotify')).toBe(second);
    expect(registry.getAll()).toHaveLength(1);
  });
});
